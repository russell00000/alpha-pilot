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
  fundamental_score: number | null;
};

// Fetch Yahoo quoteSummary for a single symbol. Returns null on failure.
async function fetchOne(symbol: string, auth: { crumb: string; cookie: string }): Promise<Fundamentals | null> {
  try {
    const modules = "financialData,summaryProfile,earningsHistory,defaultKeyStatistics,summaryDetail";
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
      fundamental_score: null, // filled by scoreFundamental below
    };
  } catch {
    return null;
  }
}

// Recentered rubric (fixed benchmark, not response-average):
//   profit margin: >=30 = +2, >=20 = +1, <10 = -1, <0 = -2
//   debt/equity:   <=0.1 = +2, <=0.3 = +1, >1 = -1, >2 = -2
//   revenue growth:>=25% = +2, >=15% = +1, <5% = -1, <0 = -2
//   P/E vs 20:     <10 = +2, <15 = +1, >30 = -1, >45 = -2
//   EPS streak:    unchanged (>=3 = +/-2, >=2 = +/-1)
// Sum -10..+10, then × 0.6 to align with technical -6..+6 scale.
function scoreFundamental(f: Fundamentals): number | null {
  let c = 0, n = 0;
  if (f.revenue_growth != null) {
    const g = f.revenue_growth;
    let s = 0;
    if (g >= 0.25) s = 2; else if (g >= 0.15) s = 1;
    else if (g < 0) s = -2; else if (g < 0.05) s = -1;
    c += s; n++;
  }
  if (f.eps_beat_streak > 0 || f.eps_miss_streak > 0) {
    let s = 0;
    if (f.eps_beat_streak >= 3) s = 2;
    else if (f.eps_beat_streak >= 2) s = 1;
    else if (f.eps_miss_streak >= 3) s = -2;
    else if (f.eps_miss_streak >= 2) s = -1;
    c += s; n++;
  }
  if (f.profit_margins != null) {
    const m = f.profit_margins;
    let s = 0;
    if (m >= 0.30) s = 2; else if (m >= 0.20) s = 1;
    else if (m < 0) s = -2; else if (m < 0.10) s = -1;
    c += s; n++;
  }
  if (f.pe_ratio != null && f.pe_ratio > 0) {
    const p = f.pe_ratio;
    let s = 0;
    if (p < 10) s = 2; else if (p < 15) s = 1;
    else if (p > 45) s = -2; else if (p > 30) s = -1;
    c += s; n++;
  }
  if (f.debt_to_equity != null) {
    const de = f.debt_to_equity > 5 ? f.debt_to_equity / 100 : f.debt_to_equity;
    let s = 0;
    if (de <= 0.1) s = 2; else if (de <= 0.3) s = 1;
    else if (de > 2) s = -2; else if (de > 1) s = -1;
    c += s; n++;
  }
  if (n === 0) return null;
  return c * 0.6;
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

    // Score each row.
    for (const r of rows) {
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