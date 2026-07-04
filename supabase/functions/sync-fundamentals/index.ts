import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const YAHOO_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

type Fundamentals = {
  symbol: string;
  sector: string | null;
  pe_ratio: number | null;
  revenue_growth: number | null;
  profit_margins: number | null;
  debt_to_equity: number | null;
  eps_beat_streak: number;
  eps_miss_streak: number;
};

// Fetch Yahoo quoteSummary for a single symbol. Returns null on failure.
async function fetchOne(symbol: string): Promise<Fundamentals | null> {
  try {
    const modules = "financialData,summaryProfile,earningsHistory,defaultKeyStatistics,summaryDetail";
    const url = `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(symbol)}?modules=${modules}`;
    const r = await fetch(url, {
      headers: { "User-Agent": YAHOO_UA, "Accept": "application/json" },
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
      revenue_growth: typeof fd?.revenueGrowth?.raw === "number" ? fd.revenueGrowth.raw : null,
      profit_margins: typeof fd?.profitMargins?.raw === "number" ? fd.profitMargins.raw : null,
      debt_to_equity: typeof fd?.debtToEquity?.raw === "number" ? fd.debtToEquity.raw : null,
      eps_beat_streak: beat,
      eps_miss_streak: miss,
    };
  } catch {
    return null;
  }
}

async function runBatch(symbols: string[], concurrency = 10): Promise<Fundamentals[]> {
  const out: Fundamentals[] = [];
  let cursor = 0;
  const workers = Array.from({ length: concurrency }, async () => {
    while (cursor < symbols.length) {
      const idx = cursor++;
      const sym = symbols[idx];
      const row = await fetchOne(sym);
      if (row) out.push(row);
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
    try {
      const text = await req.text();
      if (text) {
        const body = JSON.parse(text);
        if (Array.isArray(body?.symbols)) requested = body.symbols;
      }
    } catch { /* ignore */ }

    let symbols: string[];
    if (requested && requested.length > 0) {
      symbols = requested.map((s) => String(s).toUpperCase());
    } else {
      const { data: securities } = await supabase
        .from("securities")
        .select("symbol")
        .eq("is_active", true);
      symbols = (securities ?? []).map((s: any) => String(s.symbol).toUpperCase());
    }

    // Dedupe.
    symbols = Array.from(new Set(symbols)).filter((s) => /^[A-Z0-9.\-]{1,10}$/.test(s));

    if (symbols.length === 0) {
      return new Response(JSON.stringify({ success: true, upserted: 0, message: "no symbols" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const rows = await runBatch(symbols, 10);

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
      JSON.stringify({ success: true, requested: symbols.length, upserted: rows.length }),
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