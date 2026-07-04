import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const YAHOO_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

// Yahoo requires a crumb + cookie for authenticated endpoints (quoteSummary, v7 quote).
let yahooCrumb: string | null = null;
let yahooCookie: string | null = null;
let yahooCrumbFetchedAt = 0;
const YAHOO_CRUMB_TTL = 30 * 60 * 1000;

async function getYahooCrumb(): Promise<{ crumb: string; cookie: string } | null> {
  const now = Date.now();
  if (yahooCrumb && yahooCookie && now - yahooCrumbFetchedAt < YAHOO_CRUMB_TTL) {
    return { crumb: yahooCrumb, cookie: yahooCookie };
  }
  try {
    const seed = await fetch("https://fc.yahoo.com/", {
      headers: { "User-Agent": YAHOO_UA, "Accept": "*/*" },
      redirect: "manual",
    });
    const setCookie = seed.headers.get("set-cookie") || "";
    const cookie = setCookie
      .split(/,(?=[^ ]+=)/)
      .map((c) => c.split(";")[0].trim())
      .filter(Boolean)
      .join("; ");
    if (!cookie) return null;
    const crumbResp = await fetch("https://query2.finance.yahoo.com/v1/test/getcrumb", {
      headers: { "User-Agent": YAHOO_UA, "Cookie": cookie, "Accept": "*/*" },
    });
    if (!crumbResp.ok) return null;
    const crumb = (await crumbResp.text()).trim();
    if (!crumb || crumb.length > 32) return null;
    yahooCrumb = crumb;
    yahooCookie = cookie;
    yahooCrumbFetchedAt = now;
    return { crumb, cookie };
  } catch (e) {
    console.error("getYahooCrumb error", e);
    return null;
  }
}

type Fundamentals = {
  symbol: string;
  sector: string | null;
  pe_ratio: number | null;
  forward_pe: number | null;
  eps: number | null;
  dividend_yield: number | null;
  revenue_growth: number | null;
  profit_margins: number | null;
  debt_to_equity: number | null;
  eps_beat_streak: number;
  eps_miss_streak: number;
  fcf_growth: number | null;
  sector_avg_pe: number | null;
  fundamental_score: number | null;
};

// Fetch Yahoo quoteSummary for a single symbol. Returns null on failure.
async function fetchOne(symbol: string, auth: { crumb: string; cookie: string }): Promise<Fundamentals | null> {
  try {
    const modules = "financialData,summaryProfile,earningsHistory,defaultKeyStatistics,summaryDetail,cashflowStatementHistory";
    const url = `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(symbol)}?modules=${modules}&crumb=${encodeURIComponent(auth.crumb)}`;
    const r = await fetch(url, {
      headers: {
        "User-Agent": YAHOO_UA,
        "Accept": "application/json",
        "Cookie": auth.cookie,
      },
    });
    if (!r.ok) return null;
    const j = await r.json();
    const result = j?.quoteSummary?.result?.[0];
    if (!result) return null;
    const fd = result.financialData || {};
    const sp = result.summaryProfile || {};
    const eh = result.earningsHistory?.history || [];
    const sd = result.summaryDetail || {};
    const ks = result.defaultKeyStatistics || {};
    const cf = result.cashflowStatementHistory?.cashflowStatements || [];

    // EPS beat/miss streaks — walk from most recent quarter backwards.
    // Yahoo returns earningsHistory in chronological order (oldest → newest),
    // so reverse to iterate newest first.
    const surprises = [...eh].reverse().map((q: any) => {
      const est = q?.epsEstimate?.raw;
      const act = q?.epsActual?.raw;
      if (typeof est !== "number" || typeof act !== "number") return null;
      if (act > est) return "beat";
      if (act < est) return "miss";
      return "match";
    });
    let beat = 0, miss = 0;
    for (const s of surprises) {
      if (s === "beat") beat++;
      else break;
    }
    for (const s of surprises) {
      if (s === "miss") miss++;
      else break;
    }

    // FCF growth YoY: compare most recent annual FCF vs. prior year.
    // Yahoo cashflowStatementHistory returns entries newest -> oldest.
    let fcfGrowth: number | null = null;
    const fcf0 = cf?.[0]?.totalCashFromOperatingActivities?.raw;
    const cap0 = cf?.[0]?.capitalExpenditures?.raw;
    const fcf1 = cf?.[1]?.totalCashFromOperatingActivities?.raw;
    const cap1 = cf?.[1]?.capitalExpenditures?.raw;
    if (typeof fcf0 === "number" && typeof fcf1 === "number") {
      // capex is reported as a negative; free cash flow = operating cash + capex.
      const cur = fcf0 + (typeof cap0 === "number" ? cap0 : 0);
      const prev = fcf1 + (typeof cap1 === "number" ? cap1 : 0);
      if (prev !== 0 && Math.abs(prev) > 1) fcfGrowth = (cur - prev) / Math.abs(prev);
    }

    return {
      symbol,
      sector: sp?.sector ?? null,
      pe_ratio:
        typeof sd?.trailingPE?.raw === "number" ? sd.trailingPE.raw :
        typeof ks?.forwardPE?.raw === "number" ? ks.forwardPE.raw : null,
      forward_pe: typeof ks?.forwardPE?.raw === "number" ? ks.forwardPE.raw : null,
      eps: typeof ks?.trailingEps?.raw === "number" ? ks.trailingEps.raw : null,
      dividend_yield: typeof sd?.dividendYield?.raw === "number" ? sd.dividendYield.raw * 100 : null,
      revenue_growth: typeof fd?.revenueGrowth?.raw === "number" ? fd.revenueGrowth.raw : null,
      profit_margins: typeof fd?.profitMargins?.raw === "number" ? fd.profitMargins.raw : null,
      debt_to_equity: typeof fd?.debtToEquity?.raw === "number" ? fd.debtToEquity.raw : null,
      eps_beat_streak: beat,
      eps_miss_streak: miss,
      fcf_growth: fcfGrowth,
      sector_avg_pe: null, // filled after batch pass
      fundamental_score: null, // filled by scoreFundamental below
    };
  } catch {
    return null;
  }
}

// v2 rubric — six metrics, each -2..+2. Sum (max ±12), divide by 2 for ±6.
// P/E is sector-relative when a sector average is available.
function scoreFundamental(f: Fundamentals): number | null {
  let c = 0, n = 0;

  // Revenue growth YoY
  if (f.revenue_growth != null) {
    const g = f.revenue_growth;
    let s = 0;
    if (g >= 0.20) s = 2;
    else if (g >= 0.10) s = 1;
    else if (g < 0) s = -2;
    else if (g < 0.05) s = -1;
    c += s; n++;
  }

  // Profit margin
  if (f.profit_margins != null) {
    const m = f.profit_margins;
    let s = 0;
    if (m >= 0.25) s = 2;
    else if (m >= 0.15) s = 1;
    else if (m < 0) s = -2;
    else if (m < 0.05) s = -1;
    c += s; n++;
  }

  // P/E vs sector avg
  if (f.pe_ratio != null && f.pe_ratio > 0) {
    const p = f.pe_ratio;
    const avg = f.sector_avg_pe;
    let s = 0;
    if (avg != null && avg > 0) {
      const rel = (p - avg) / avg;
      if (rel <= -0.30) s = 2;
      else if (rel <= -0.10) s = 1;
      else if (rel >= 0.30) s = -2;
      else if (rel >= 0.10) s = -1;
    } else {
      // Fallback: fixed benchmark 20 when no sector average is known.
      if (p < 10) s = 2;
      else if (p < 15) s = 1;
      else if (p > 45) s = -2;
      else if (p > 30) s = -1;
    }
    c += s; n++;
  }

  // Debt to equity (Yahoo returns as percentage, e.g. 79.5 for 0.795)
  if (f.debt_to_equity != null) {
    const de = f.debt_to_equity > 5 ? f.debt_to_equity / 100 : f.debt_to_equity;
    let s = 0;
    if (de <= 0.3) s = 2;
    else if (de <= 0.6) s = 1;
    else if (de > 2.0) s = -2;
    else if (de > 1.0) s = -1;
    c += s; n++;
  }

  // EPS beat/miss streak
  if (f.eps_beat_streak > 0 || f.eps_miss_streak > 0) {
    let s = 0;
    if (f.eps_beat_streak >= 3) s = 2;
    else if (f.eps_beat_streak >= 2) s = 1;
    else if (f.eps_miss_streak >= 3) s = -2;
    else if (f.eps_miss_streak >= 2) s = -1;
    c += s; n++;
  }

  // Free cash flow growth YoY
  if (f.fcf_growth != null) {
    const g = f.fcf_growth;
    let s = 0;
    if (g >= 0.20) s = 2;
    else if (g >= 0.10) s = 1;
    else if (g <= -0.20) s = -2;
    else if (g < 0) s = -1;
    c += s; n++;
  }

  if (n === 0) return null;
  // Sum is -12..+12 across 6 metrics; divide by 2 to land on -6..+6.
  return c / 2;
}

async function runBatch(symbols: string[], auth: { crumb: string; cookie: string }, concurrency = 6): Promise<Fundamentals[]> {
  const out: Fundamentals[] = [];
  let cursor = 0;
  const workers = Array.from({ length: concurrency }, async () => {
    while (cursor < symbols.length) {
      const idx = cursor++;
      const sym = symbols[idx];
      const row = await fetchOne(sym, auth);
      if (row) out.push(row);
      // Small throttle to be polite to Yahoo.
      await new Promise((r) => setTimeout(r, 30));
    }
  });
  await Promise.all(workers);
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Optional body: { symbols?: string[] } lets callers refresh a subset.
    let requested: string[] | null = null;
    let offset = 0, limit = 2000;
    try {
      const text = await req.text();
      if (text) {
        const body = JSON.parse(text);
        if (Array.isArray(body?.symbols)) requested = body.symbols;
        if (typeof body?.offset === "number") offset = body.offset;
        if (typeof body?.limit === "number") limit = Math.min(body.limit, 3000);
      }
    } catch { /* ignore */ }

    let symbols: string[];
    if (requested && requested.length > 0) {
      symbols = requested.map((s) => String(s).toUpperCase());
    } else {
      // Source from securities_universe (full US-listed set), paged for sharded runs.
      const { data: uni } = await supabase
        .from("securities_universe")
        .select("symbol")
        .eq("is_active", true)
        .eq("asset_type", "stock")
        .order("symbol")
        .range(offset, offset + limit - 1);
      symbols = (uni ?? []).map((s: any) => String(s.symbol).toUpperCase());
    }

    // Dedupe.
    symbols = Array.from(new Set(symbols)).filter((s) => /^[A-Z0-9.\-]{1,10}$/.test(s));

    if (symbols.length === 0) {
      return new Response(JSON.stringify({ success: true, upserted: 0, message: "no symbols" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const auth = await getYahooCrumb();
    if (!auth) {
      return new Response(
        JSON.stringify({ error: "failed to obtain Yahoo crumb" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const rows = await runBatch(symbols, auth, 6);

    // Pull sector average P/E from the DB so P/E scoring is relative.
    // Averages the trailing P/E of every profitable ticker in each sector.
    const { data: avgRows } = await supabase
      .from("fundamentals")
      .select("sector, pe_ratio");
    const sectorSum = new Map<string, { sum: number; n: number }>();
    for (const r of avgRows ?? []) {
      const pe = (r as any).pe_ratio;
      const sec = (r as any).sector;
      if (!sec || typeof pe !== "number" || pe <= 0 || pe > 200) continue;
      const agg = sectorSum.get(sec) ?? { sum: 0, n: 0 };
      agg.sum += pe; agg.n++;
      sectorSum.set(sec, agg);
    }
    const sectorAvg = new Map<string, number>();
    for (const [sec, { sum, n }] of sectorSum) {
      if (n >= 3) sectorAvg.set(sec, sum / n);
    }

    // Score each row using sector-relative P/E.
    for (const r of rows) {
      r.sector_avg_pe = r.sector ? sectorAvg.get(r.sector) ?? null : null;
      r.fundamental_score = scoreFundamental(r);
    }

    if (rows.length > 0) {
      // Chunk upserts to keep payload small.
      const CHUNK = 200;
      for (let i = 0; i < rows.length; i += CHUNK) {
        const slice = rows.slice(i, i + CHUNK).map((r) => ({ ...r, updated_at: new Date().toISOString() }));
        const { error } = await supabase
          .from("fundamentals")
          .upsert(slice, { onConflict: "symbol" });
        if (error) {
          console.error("upsert error", error);
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true, requested: symbols.length, upserted: rows.length, offset, limit }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("sync-fundamentals error", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});