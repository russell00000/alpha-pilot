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

async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = 3500) {
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

// Fetch real fundamentals from Yahoo Finance so the model isn't hallucinating numbers.
async function fetchFundamentals(symbol: string) {
  const cacheKey = `fundamentals:${symbol.toUpperCase()}`;
  const cached = cacheGet<unknown>(cacheKey, 10 * 60 * 1000);
  if (cached) return cached;

  const modules = [
    "price",
    "summaryDetail",
    "defaultKeyStatistics",
    "financialData",
    "assetProfile",
    "recommendationTrend",
  ].join(",");
  const url = `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(symbol)}?modules=${modules}`;
  try {
    const res = await fetchWithTimeout(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
        Accept: "application/json",
      },
    });
    if (!res.ok) {
      console.log("Yahoo quoteSummary status:", res.status);
      return null;
    }
    const json = await res.json();
    const r = json?.quoteSummary?.result?.[0];
    if (!r) return null;

    const v = (x: any) => (x && typeof x === "object" && "raw" in x ? x.raw : x ?? null);
    const fmt = (x: any) => (x && typeof x === "object" && "fmt" in x ? x.fmt : null);

    const price = r.price ?? {};
    const sd = r.summaryDetail ?? {};
    const ks = r.defaultKeyStatistics ?? {};
    const fd = r.financialData ?? {};
    const ap = r.assetProfile ?? {};
    const recTrend = r.recommendationTrend?.trend?.[0] ?? null;

    const out = {
      companyName: v(price.longName) || v(price.shortName) || symbol,
      sector: ap.sector || null,
      industry: ap.industry || null,
      country: ap.country || null,
      marketCap: v(price.marketCap),
      marketCapFmt: fmt(price.marketCap),
      currency: price.currency || "USD",
      regularMarketPrice: v(price.regularMarketPrice),
      fiftyTwoWeekHigh: v(sd.fiftyTwoWeekHigh),
      fiftyTwoWeekLow: v(sd.fiftyTwoWeekLow),
      // valuation
      trailingPE: v(sd.trailingPE),
      forwardPE: v(sd.forwardPE) ?? v(ks.forwardPE),
      pegRatio: v(ks.pegRatio),
      priceToBook: v(ks.priceToBook),
      priceToSales: v(sd.priceToSalesTrailing12Months),
      enterpriseValue: v(ks.enterpriseValue),
      evToRevenue: v(ks.enterpriseToRevenue),
      evToEbitda: v(ks.enterpriseToEbitda),
      // per-share
      trailingEps: v(ks.trailingEps),
      forwardEps: v(ks.forwardEps),
      bookValue: v(ks.bookValue),
      // profitability / growth
      profitMargin: v(fd.profitMargins),
      operatingMargin: v(fd.operatingMargins),
      grossMargin: v(fd.grossMargins),
      returnOnEquity: v(fd.returnOnEquity),
      returnOnAssets: v(fd.returnOnAssets),
      revenueGrowth: v(fd.revenueGrowth),
      earningsGrowth: v(fd.earningsGrowth),
      earningsQGrowthYoY: v(ks.earningsQuarterlyGrowth),
      revenueTTM: v(fd.totalRevenue),
      ebitda: v(fd.ebitda),
      grossProfitTTM: v(fd.grossProfits),
      // balance sheet / cash
      totalCash: v(fd.totalCash),
      totalDebt: v(fd.totalDebt),
      debtToEquity: v(fd.debtToEquity),
      currentRatio: v(fd.currentRatio),
      quickRatio: v(fd.quickRatio),
      freeCashflow: v(fd.freeCashflow),
      operatingCashflow: v(fd.operatingCashflow),
      // dividends
      dividendYield: v(sd.dividendYield),
      payoutRatio: v(sd.payoutRatio),
      // analyst
      targetMeanPrice: v(fd.targetMeanPrice),
      targetHighPrice: v(fd.targetHighPrice),
      targetLowPrice: v(fd.targetLowPrice),
      numberOfAnalystOpinions: v(fd.numberOfAnalystOpinions),
      recommendationKey: fd.recommendationKey || null,
      recommendationMean: v(fd.recommendationMean),
      analystTrend: recTrend
        ? {
            strongBuy: recTrend.strongBuy,
            buy: recTrend.buy,
            hold: recTrend.hold,
            sell: recTrend.sell,
            strongSell: recTrend.strongSell,
          }
        : null,
      // risk
      beta: v(sd.beta) ?? v(ks.beta),
      shortPercentOfFloat: v(ks.shortPercentOfFloat),
      heldPercentInsiders: v(ks.heldPercentInsiders),
      heldPercentInstitutions: v(ks.heldPercentInstitutions),
    };
    cacheSet(cacheKey, out);
    return out;
  } catch (e) {
    console.error("fetchFundamentals error:", e);
    return null;
  }
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

    const systemPrompt = `You are an expert investment analyst following a specific investing philosophy.

## YOUR INVESTING PHILOSOPHY
${philosophy?.philosophy_text || "Focus on capital preservation and growth through research-driven analysis."}

## RISK GUIDANCE
${philosophy?.risk_guidance || "Risk should be balanced with reward potential. Ideal risk to reward ratio is 1:3."}

## ANALYSIS REQUIREMENTS
You are producing an in-depth equity research note. Be rigorous, decisive, and specific.
You will be given a FUNDAMENTALS JSON block with real, current data pulled directly from the market.
CRITICAL ACCURACY RULES:
- Use ONLY the numbers provided in the FUNDAMENTALS block. Do not invent EPS, P/E, growth rates, margins, debt, FCF, market cap, or analyst targets.
- If a specific metric is missing (null/undefined), say "not disclosed" rather than guessing.
- When you cite a number, it must match the FUNDAMENTALS block (you may round sensibly, e.g. 2.345B -> $2.35B).
- Reconcile your price target math with the actual trailingEps / forwardEps / revenueTTM / freeCashflow given. Show the arithmetic.
- When you reference sector comps, only name comps you are confident exist in the same sector/industry as the company. Do not fabricate multiples for comps — frame them as "typical sector range" if you don't have exact figures.
- Compare your base target to the analyst consensus targetMeanPrice when available, and explain the gap.
Cover, at minimum:
1. A clear investment thesis (2-3 sentences) — what is the core view and why.
2. Business overview — what the company does, primary revenue drivers, competitive moat.
3. Fundamental analysis — valuation (P/E vs sector & history), growth, margins, balance sheet, cash flow quality. Reference concrete numbers when possible.
4. Technical & price-action read — trend vs 52-week range, momentum, support/resistance inferred from 52w high/low, volume context.
5. Bull case — 3-4 specific catalysts or drivers that could push the stock to the upside target.
6. Bear case — 3-4 specific risks or headwinds that could derail the thesis.
7. Catalysts to watch — upcoming events, earnings, macro, product cycles.
8. Price target derivation — show the math. Pick a primary valuation method (forward P/E, EV/EBITDA, EV/Sales, DCF, or sum-of-the-parts) appropriate to the sector, state the multiple or discount rate used, the forward earnings/revenue/FCF estimate it is applied to, and how that produces the base, bull, and bear targets. Reference 1-2 named comps where useful. Numbers must reconcile with the targets you return.
9. Position sizing & risk — suggest how this fits a portfolio given the risk level.
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
  "positionSizing": "1-2 sentence guidance on how this fits a diversified portfolio given the risk level."
}

Return ONLY the JSON. Be decisive, specific, and grounded in the investing philosophy.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        max_tokens: 3200,
        response_format: { type: "json_object" },
      }),
    });

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
        analysis = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("No JSON found in response");
      }
    } catch (parseError) {
      console.error("Failed to parse AI response:", parseError);
      // Return a default analysis if parsing fails
      analysis = {
        recommendation: "HOLD",
        confidence: "LOW",
        reasoning: "Unable to generate analysis at this time.",
        priceTarget: parseFloat(price) || 0,
        riskLevel: "MEDIUM"
      };
    }

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
