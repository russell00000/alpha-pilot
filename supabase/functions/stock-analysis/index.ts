import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { z } from "https://esm.sh/zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const cache = new Map<string, { ts: number; data: unknown }>();
const cacheGet = <T,>(key: string, ttlMs: number): T | null => {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > ttlMs) {
    cache.delete(key);
    return null;
  }
  return entry.data as T;
};
const cacheSet = (key: string, data: unknown) => cache.set(key, { ts: Date.now(), data });

async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = 2500) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

const RequestSchema = z.object({
  symbol: z.string().min(1).max(15),
  price: z.union([z.number(), z.string()]).optional(),
  change: z.union([z.number(), z.string()]).optional(),
  changePercent: z.number().optional(),
  week52High: z.union([z.number(), z.string()]).optional(),
  week52Low: z.union([z.number(), z.string()]).optional(),
  volume: z.union([z.number(), z.string()]).optional(),
});

// Fetch real fundamentals — Finnhub is primary (Yahoo's quoteSummary now requires
// a crumb/cookie and returns 401 from edge runtimes). Pulls profile, metric, quote,
// price-target, and recommendation in parallel and merges into one normalized blob.
async function fetchFundamentals(symbol: string) {
  const sym = symbol.toUpperCase();
  const cacheKey = `fundamentals:${sym}`;
  const cached = cacheGet<unknown>(cacheKey, 10 * 60 * 1000);
  if (cached) return cached;

  const apiKey = Deno.env.get("FINNHUB_API_KEY");
  if (!apiKey) {
    console.error("FINNHUB_API_KEY not configured");
    return null;
  }

  const base = "https://finnhub.io/api/v1";
  const auth = `token=${apiKey}`;
  const j = async (path: string) => {
    try {
      const r = await fetchWithTimeout(`${base}/${path}&${auth}`, {}, 3500);
      if (!r.ok) {
        console.log("Finnhub", path, "status", r.status);
        return null;
      }
      return await r.json();
    } catch (e) {
      console.error("Finnhub fetch error", path, e);
      return null;
    }
  };

  const [profile, metricResp, quote, targetResp, recArr] = await Promise.all([
    j(`stock/profile2?symbol=${sym}`),
    j(`stock/metric?symbol=${sym}&metric=all`),
    j(`quote?symbol=${sym}`),
    j(`stock/price-target?symbol=${sym}`),
    j(`stock/recommendation?symbol=${sym}`),
  ]);

  if (!profile && !metricResp && !quote) return null;

  const m = metricResp?.metric ?? {};
  const num = (x: unknown): number | null =>
    typeof x === "number" && Number.isFinite(x) ? x : null;

  // Finnhub returns ratios as raw numbers (e.g. ROE 0.27 means 27%, but margin
  // fields are often already in %). Normalize the "growth/margin" set to fractions
  // so the model sees the same scale Yahoo used to provide.
  const pct = (x: unknown): number | null => {
    const n = num(x);
    if (n == null) return null;
    // Finnhub margins/growth come back as percent numbers (e.g. 12.4 = 12.4%).
    return n / 100;
  };

  const rec = Array.isArray(recArr) && recArr.length > 0 ? recArr[0] : null;
  const totalRec = rec
    ? (rec.strongBuy ?? 0) + (rec.buy ?? 0) + (rec.hold ?? 0) + (rec.sell ?? 0) + (rec.strongSell ?? 0)
    : 0;
  const recMean = rec && totalRec > 0
    ? ((rec.strongBuy * 1) + (rec.buy * 2) + (rec.hold * 3) + (rec.sell * 4) + (rec.strongSell * 5)) / totalRec
    : null;
  const recKey = recMean == null
    ? null
    : recMean <= 1.5 ? "strong_buy" : recMean <= 2.5 ? "buy" : recMean <= 3.5 ? "hold" : recMean <= 4.5 ? "sell" : "strong_sell";

  // Market cap from profile is in millions (USD).
  const marketCap = num(profile?.marketCapitalization);
  const marketCapUsd = marketCap != null ? marketCap * 1e6 : null;

  const out = {
    companyName: profile?.name || sym,
    sector: profile?.finnhubIndustry || null,
    industry: profile?.finnhubIndustry || null,
    country: profile?.country || null,
    marketCap: marketCapUsd,
    marketCapFmt: marketCapUsd != null
      ? marketCapUsd >= 1e12 ? `${(marketCapUsd / 1e12).toFixed(2)}T`
        : marketCapUsd >= 1e9 ? `${(marketCapUsd / 1e9).toFixed(2)}B`
        : marketCapUsd >= 1e6 ? `${(marketCapUsd / 1e6).toFixed(2)}M`
        : `${marketCapUsd.toFixed(0)}`
      : null,
    currency: profile?.currency || "USD",
    regularMarketPrice: num(quote?.c),
    fiftyTwoWeekHigh: num(m["52WeekHigh"]),
    fiftyTwoWeekLow: num(m["52WeekLow"]),
    // valuation
    trailingPE: num(m.peTTM) ?? num(m.peAnnual),
    forwardPE: num(m.peNormalizedAnnual) ?? num(m.peExclExtraTTM),
    pegRatio: num(m.pegRatio),
    priceToBook: num(m.pbAnnual) ?? num(m.pbQuarterly),
    priceToSales: num(m.psTTM) ?? num(m.psAnnual),
    enterpriseValue: num(m.enterpriseValue),
    evToRevenue: num(m["currentEv/freeCashFlowTTM"]),
    evToEbitda: num(m["currentEv/ebitdaTTM"]),
    // per-share
    trailingEps: num(m.epsTTM) ?? num(m.epsAnnual),
    forwardEps: num(m.epsNormalizedAnnual),
    bookValue: num(m.bookValuePerShareAnnual) ?? num(m.bookValuePerShareQuarterly),
    // profitability / growth (returned as fractions, like Yahoo did)
    profitMargin: pct(m.netProfitMarginTTM) ?? pct(m.netProfitMarginAnnual),
    operatingMargin: pct(m.operatingMarginTTM) ?? pct(m.operatingMarginAnnual),
    grossMargin: pct(m.grossMarginTTM) ?? pct(m.grossMarginAnnual),
    returnOnEquity: pct(m.roeTTM) ?? pct(m.roeRfy),
    returnOnAssets: pct(m.roaTTM) ?? pct(m.roaRfy),
    revenueGrowth: pct(m.revenueGrowthTTMYoy) ?? pct(m.revenueGrowth5Y),
    earningsGrowth: pct(m.epsGrowthTTMYoy) ?? pct(m.epsGrowth5Y),
    earningsQGrowthYoY: pct(m.epsGrowthQuarterlyYoy),
    revenueTTM: num(m.revenuePerShareTTM) != null && num(m.sharesOutstanding) != null
      ? (num(m.revenuePerShareTTM)! * num(m.sharesOutstanding)! * 1e6)
      : null,
    ebitda: num(m.ebitdPerShareTTM) != null && num(m.sharesOutstanding) != null
      ? (num(m.ebitdPerShareTTM)! * num(m.sharesOutstanding)! * 1e6)
      : null,
    grossProfitTTM: null,
    // balance sheet / cash
    totalCash: null,
    totalDebt: null,
    debtToEquity: num(m["totalDebt/totalEquityAnnual"]) ?? num(m["longTermDebt/equityAnnual"]),
    currentRatio: num(m.currentRatioAnnual) ?? num(m.currentRatioQuarterly),
    quickRatio: num(m.quickRatioAnnual) ?? num(m.quickRatioQuarterly),
    freeCashflow: num(m.freeCashFlowAnnual) ?? num(m.freeCashFlowTTM),
    operatingCashflow: num(m.cashFlowPerShareTTM) != null && num(m.sharesOutstanding) != null
      ? (num(m.cashFlowPerShareTTM)! * num(m.sharesOutstanding)! * 1e6)
      : null,
    // dividends
    dividendYield: pct(m.dividendYieldIndicatedAnnual) ?? pct(m.currentDividendYieldTTM),
    payoutRatio: pct(m.payoutRatioTTM) ?? pct(m.payoutRatioAnnual),
    // analyst
    targetMeanPrice: num(targetResp?.targetMean),
    targetHighPrice: num(targetResp?.targetHigh),
    targetLowPrice: num(targetResp?.targetLow),
    numberOfAnalystOpinions: num(targetResp?.numberOfAnalysts) ?? (totalRec || null),
    recommendationKey: recKey,
    recommendationMean: recMean,
    analystTrend: rec
      ? {
          strongBuy: rec.strongBuy,
          buy: rec.buy,
          hold: rec.hold,
          sell: rec.sell,
          strongSell: rec.strongSell,
        }
      : null,
    // risk
    beta: num(m.beta),
    shortPercentOfFloat: null,
    heldPercentInsiders: null,
    heldPercentInstitutions: null,
  };

  cacheSet(cacheKey, out);
  return out;
}

// Fetch the investing philosophy from the database (read-only, public endpoint)
async function fetchPhilosophy() {
  const cached = cacheGet<unknown>("investing-philosophy", 30 * 60 * 1000);
  if (cached) return cached;

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const { data: philosophy, error } = await supabase
      .from("investing_philosophy")
      .select("*")
      .limit(1)
      .single();

    if (error || !philosophy) {
      console.log("Failed to fetch philosophy:", error);
      return null;
    }

    cacheSet("investing-philosophy", philosophy);
    return philosophy;
  } catch (error) {
    console.error("Error fetching philosophy:", error);
    return null;
  }
}

// Repair common JSON issues from LLM output: literal control chars inside string
// literals (raw newlines/tabs/carriage returns) and trailing commas.
function sanitizeJsonString(s: string): string {
  let out = "";
  let inStr = false;
  let escape = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (inStr) {
      if (escape) { out += ch; escape = false; continue; }
      if (ch === "\\") { out += ch; escape = true; continue; }
      if (ch === '"') { out += ch; inStr = false; continue; }
      if (ch === "\n") { out += "\\n"; continue; }
      if (ch === "\r") { out += "\\r"; continue; }
      if (ch === "\t") { out += "\\t"; continue; }
      const code = ch.charCodeAt(0);
      if (code < 0x20) { out += "\\u" + code.toString(16).padStart(4, "0"); continue; }
      out += ch;
    } else {
      if (ch === '"') { inStr = true; }
      out += ch;
    }
  }
  // Remove trailing commas before } or ]
  return out.replace(/,(\s*[}\]])/g, "$1");
}

function fallbackAnalysis(symbol: string, price: number, fundamentals: any) {
  const analystTarget = Number(fundamentals?.targetMeanPrice);
  const forwardEps = Number(fundamentals?.forwardEps);
  const forwardPe = Number(fundamentals?.forwardPE);
  const target = analystTarget > 0
    ? analystTarget
    : forwardEps > 0 && forwardPe > 0
      ? forwardEps * forwardPe
      : price;
  const upside = price > 0 ? ((target - price) / price) * 100 : 0;
  return {
    recommendation: upside >= 12 ? "BUY" : upside <= -8 ? "SELL" : "HOLD",
    confidence: fundamentals ? "MEDIUM" : "LOW",
    reasoning: `${symbol} screens as a ${upside >= 12 ? "BUY" : upside <= -8 ? "SELL" : "HOLD"} based on current price versus the available valuation and analyst data. The view is grounded in live market data and updated fundamentals, with confidence limited when key fields are unavailable.`,
    thesis: `${fundamentals?.companyName || symbol} is assessed on valuation, growth, balance-sheet quality, cash-flow strength, and current market positioning. The key swing factor is whether earnings growth and margins can justify the current multiple relative to risk.`,
    businessOverview: `${fundamentals?.companyName || symbol} operates in ${fundamentals?.sector || "its reported sector"}${fundamentals?.industry ? `, specifically ${fundamentals.industry}` : ""}. Competitive quality is judged through margins, returns, cash generation, and balance-sheet resilience.`,
    fundamentals: `Forward P/E is ${fundamentals?.forwardPE ?? "not disclosed"}, trailing P/E is ${fundamentals?.trailingPE ?? "not disclosed"}, revenue growth is ${fundamentals?.revenueGrowth ?? "not disclosed"}, earnings growth is ${fundamentals?.earningsGrowth ?? "not disclosed"}, and free cash flow is ${fundamentals?.freeCashflow ?? "not disclosed"}. Analyst mean target is ${fundamentals?.targetMeanPrice ?? "not disclosed"} across ${fundamentals?.numberOfAnalystOpinions ?? "not disclosed"} opinions.`,
    technicals: `The current price is $${price.toFixed(2)} versus a 52-week range of $${fundamentals?.fiftyTwoWeekLow ?? "n/a"} to $${fundamentals?.fiftyTwoWeekHigh ?? "n/a"}. That range provides the first practical downside and upside reference points.`,
    bullCase: ["Earnings growth accelerates above current expectations", "Margins expand or hold up better than peers", "Market rerates the stock toward the upper end of its valuation range"],
    bearCase: ["Growth slows below expectations", "Margins compress from cost pressure or weaker pricing", "The valuation multiple contracts if risk appetite weakens"],
    catalysts: ["Next earnings report", "Management guidance update", "Analyst estimate revisions"],
    priceTarget: Number(target.toFixed(2)),
    bullTarget: Number((target * 1.15).toFixed(2)),
    bearTarget: Number((target * 0.8).toFixed(2)),
    priceTargetRationale: analystTarget > 0
      ? `Base target uses the current analyst mean target of $${analystTarget.toFixed(2)} because it aggregates ${fundamentals?.numberOfAnalystOpinions ?? "available"} market estimates and is the fastest reliable external fair-value anchor. Bull case applies a 15% rerating to $${(target * 1.15).toFixed(2)} if growth and margins improve; bear case applies a 20% discount to $${(target * 0.8).toFixed(2)} if estimates fall or the multiple contracts.`
      : `Base target uses forward EPS × forward P/E: ${forwardEps || "not disclosed"} × ${forwardPe || "not disclosed"} ≈ $${target.toFixed(2)}. Bull and bear targets apply a simple rerating around that base to reflect upside execution or downside estimate risk.`,
    riskLevel: fundamentals?.beta && fundamentals.beta > 1.4 ? "HIGH" : "MEDIUM",
    positionSizing: "Use a measured allocation inside a diversified portfolio and scale only if fundamentals and price action continue to confirm the thesis.",
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      console.error("LOVABLE_API_KEY is not configured");
      return new Response(JSON.stringify({ error: "Service temporarily unavailable" }), {
        status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let rawBody: unknown;
    try { rawBody = await req.json(); } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const parsed = RequestSchema.safeParse(rawBody);
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: "Invalid request format" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { symbol, price, change, changePercent, week52High, week52Low, volume } = parsed.data;

    console.log(`Analyzing ${symbol}: price=${price}, change=${changePercent}%, 52wHigh=${week52High}, 52wLow=${week52Low}`);

    // Fetch philosophy + real fundamentals in parallel so the model has hard data to ground on.
    const [philosophy, fundamentals] = await Promise.all([
      fetchPhilosophy(),
      fetchFundamentals(symbol),
    ]);
    console.log("Fetched philosophy:", philosophy ? "success" : "none");
    console.log("Fetched fundamentals:", fundamentals ? "success" : "none");

    const currentPrice = Number.parseFloat(String(price)) || Number(fundamentals?.regularMarketPrice) || 0;
    const analysisCacheKey = `analysis:${symbol.toUpperCase()}:${Math.round(currentPrice * 100)}`;
    const cachedAnalysis = cacheGet<unknown>(analysisCacheKey, 15 * 60 * 1000);
    if (cachedAnalysis) {
      return new Response(
        JSON.stringify({ data: cachedAnalysis }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const systemPrompt = `You are an expert investment analyst following a specific investing philosophy.

## YOUR INVESTING PHILOSOPHY
${philosophy?.philosophy_text || "Focus on capital preservation and growth through research-driven analysis."}

## RISK GUIDANCE
${philosophy?.risk_guidance || "Risk should be balanced with reward potential. Ideal risk to reward ratio is 1:3."}

## ANALYSIS REQUIREMENTS
You are producing a concise equity research note. Be rigorous, decisive, and specific.
You will be given a FUNDAMENTALS JSON block with real, current data pulled directly from the market.
CRITICAL ACCURACY RULES:
- Use ONLY the numbers provided in the FUNDAMENTALS block. Do not invent EPS, P/E, growth rates, margins, debt, FCF, market cap, or analyst targets.
- If a specific metric is missing (null/undefined), say "not disclosed" rather than guessing.
- When you cite a number, it must match the FUNDAMENTALS block (you may round sensibly, e.g. 2.345B -> $2.35B).
- Reconcile your price target math with the actual trailingEps / forwardEps / revenueTTM / freeCashflow given. Show the arithmetic.
- Compare your base target to the analyst consensus targetMeanPrice when available, and explain the gap.
Cover, at minimum:
1. A clear investment thesis.
2. Business overview.
3. Fundamental analysis with concrete metrics.
4. Technical read from current price, 52-week high/low, and volume.
5. Bull case, bear case, catalysts, and risk.
6. Price target derivation — pick the fastest reliable method from the supplied data and show the math.
Be decisive. Never hedge with "it depends" — take a stance grounded in the data.

## COMMUNICATION STYLE
${philosophy?.market_insights_style || "Be helpful and informative, communicating at a level that beginners can understand. Be concise and professional."}`;

    const userPrompt = `Produce a deep-dive research note on ${symbol}${fundamentals?.companyName ? ` (${fundamentals.companyName})` : ""}.

## LIVE MARKET DATA
Current Price: $${price}
Daily Change: ${changePercent !== undefined ? (changePercent > 0 ? '+' : '') + changePercent.toFixed(2) + '%' : 'n/a'}
52-Week High: $${week52High}
52-Week Low: $${week52Low}
Volume: ${volume}

## FUNDAMENTALS (real data — ground every number you cite to this block)
${fundamentals ? JSON.stringify(fundamentals, null, 2) : "Fundamentals unavailable — clearly state that valuation work is based on limited public data and be conservative with specific numeric claims."}

Provide your analysis in the following JSON format only, no other text:
{
  "recommendation": "BUY" or "HOLD" or "SELL",
  "confidence": "HIGH" or "MEDIUM" or "LOW",
  "reasoning": "2-3 sentence executive summary of the investment view.",
  "thesis": "3-4 sentence core investment thesis with the strongest argument for the call.",
  "businessOverview": "2-3 sentences on what the company does, revenue mix, and competitive moat.",
  "fundamentals": "4-6 sentences of fundamental analysis: valuation vs sector and history, growth trajectory, margins, balance sheet quality, cash flow. Reference concrete metrics.",
  "technicals": "3-4 sentences on price action, trend vs 52-week range, momentum, key support/resistance levels, and volume signal.",
  "bullCase": ["specific upside driver 1", "specific upside driver 2", "specific upside driver 3"],
  "bearCase": ["specific risk 1", "specific risk 2", "specific risk 3"],
  "catalysts": ["upcoming catalyst 1 with timing if known", "catalyst 2", "catalyst 3"],
  "priceTarget": number (12-month base-case fair value),
  "bullTarget": number (upside scenario price),
  "bearTarget": number (downside scenario price),
  "priceTargetRationale": "4-6 sentences. MUST include: (a) primary valuation method chosen and WHY it fits this business, (b) the specific multiple/rate used and how it compares to the stock's own 5y history and 1-2 named sector comps, (c) the forward estimate it is applied to (e.g. FY26 EPS ~$X, FY26 revenue ~$Yb, mid-cycle FCF ~$Zb), (d) the arithmetic that produces the base target (e.g. '32x × $9.40 ≈ $300'), (e) what specifically shifts the multiple or estimate to derive bull and bear targets. No generic phrases like 'premium growth justifies premium multiple' without numbers.",
  "riskLevel": "LOW" or "MEDIUM" or "HIGH",
}

Return ONLY the JSON. Be decisive, specific, and grounded in the investing philosophy.`;

    const response = await fetchWithTimeout("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        // Output is shorter now (positionSizing removed) — smaller budget = faster completion.
        max_tokens: 1300,
        response_format: { type: "json_object" },
      }),
    }, 11000);

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Credits exhausted. Please add funds to continue." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      return new Response(JSON.stringify({ error: "AI service unavailable" }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiResponse = await response.json();
    const content = aiResponse.choices?.[0]?.message?.content || "";
    
    console.log("AI response:", content);

    // Parse the JSON from the response
    let analysis;
    try {
      // Try to extract JSON from the response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        analysis = JSON.parse(sanitizeJsonString(jsonMatch[0]));
      } else {
        throw new Error("No JSON found in response");
      }
    } catch (parseError) {
      console.error("Failed to parse AI response:", parseError);
      // Return a default analysis if parsing fails
      analysis = fallbackAnalysis(symbol, currentPrice, fundamentals);
    }

    // Align the Stock page recommendation with the Screener rating so both
    // surfaces show the same call for the same symbol. Screener rating is
    // derived from the pre-computed combined_score in screener_view.
    try {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const sb = createClient(supabaseUrl, serviceKey);
      const { data: sv } = await sb
        .from("screener_view")
        .select("combined_score, fundamental_score, technical_score")
        .eq("symbol", symbol.toUpperCase())
        .maybeSingle();
      const score = sv?.combined_score;
      if (typeof score === "number") {
        const rec = score >= 1.0 ? "BUY" : score <= -1.0 ? "SELL" : "HOLD";
        const conf = Math.abs(score) >= 2.5 ? "HIGH" : Math.abs(score) >= 1.0 ? "MEDIUM" : "LOW";
        (analysis as any).recommendation = rec;
        (analysis as any).confidence = conf;
        (analysis as any).screenerScore = score;
        (analysis as any).fundamentalScore = sv?.fundamental_score ?? null;
        (analysis as any).technicalScore = sv?.technical_score ?? null;
      }
    } catch (e) {
      console.log("screener alignment skipped:", e);
    }

    cacheSet(analysisCacheKey, analysis);

    return new Response(
      JSON.stringify({ data: analysis }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Stock analysis error:", error);
    return new Response(
      JSON.stringify({ error: "An error occurred processing your request" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
