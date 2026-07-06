// screener: server-side query over the pre-computed screener_view. Applies
// filters/sort/pagination in SQL, computes final rating in-code per row.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Rating = "strong_buy" | "buy" | "hold" | "sell" | "strong_sell";
function scoreToRating(score: number | null): Rating | null {
  if (score == null) return null;
  // v2 thresholds (combined score range ±6).
  if (score >= 2.5) return "strong_buy";
  if (score >= 1.0) return "buy";
  if (score > -1.0) return "hold";
  if (score > -2.5) return "sell";
  return "strong_sell";
}

// Server-side rating filter uses combined_score ranges directly.
const RATING_RANGES: Record<Rating, [number, number]> = {
  strong_buy:  [2.5, 999],
  buy:         [1.0, 2.5],
  hold:        [-1.0, 1.0],
  sell:        [-2.5, -1.0],
  strong_sell: [-999, -2.5],
};

const SORT_MAP: Record<string, string> = {
  symbol: "symbol",
  name: "name",
  sector: "sector",
  price: "price",
  change_pct: "change_pct",
  market_cap: "market_cap",
  pe_ratio: "pe_ratio",
  volume: "volume",
  dividend_yield: "dividend_yield",
  combined_score: "combined_score",
  technical_score: "technical_score",
  fundamental_score: "fundamental_score",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!);
    const body = req.method === "POST" ? await req.json() : {};

    const q = (body.q ?? "").toString().trim();
    const sector = (body.sector ?? "").toString().trim();
    const assetType = (body.assetType ?? "").toString().trim(); // stock | etf
    const minMarketCap = typeof body.minMarketCap === "number" ? body.minMarketCap : null;
    const maxPE = typeof body.maxPE === "number" ? body.maxPE : null;
    const minPrice = typeof body.minPrice === "number" ? body.minPrice : null;
    const maxPrice = typeof body.maxPrice === "number" ? body.maxPrice : null;
    const minChange = typeof body.minChange === "number" ? body.minChange : null;
    const maxChange = typeof body.maxChange === "number" ? body.maxChange : null;
    const minDivYield = typeof body.minDivYield === "number" ? body.minDivYield : null;
    const rating = (body.rating ?? "").toString() as Rating | "";
    const sort = SORT_MAP[body.sort as string] ?? "market_cap";
    const dir = body.dir === "asc" ? "asc" : "desc";
    const page = Math.max(1, parseInt(String(body.page ?? 1), 10));
    const pageSize = Math.min(200, Math.max(10, parseInt(String(body.pageSize ?? 50), 10)));
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = supabase.from("screener_view").select("*", { count: "exact" });

    // v2 exclusion rules:
    //  - both fundamental and technical scores must be present
    //  - stock only (ETFs/SPACs/funds are excluded from ratings)
    //  - at least 4 quarters of earnings history (beat + miss streak >= 4
    //    is a proxy — we track up to 4)
    //  - average daily volume >= 500,000
    query = query
      .not("fundamental_score", "is", null)
      .not("technical_score", "is", null)
      .not("price", "is", null)
      .eq("asset_type", "stock")
      .gte("avg_volume", 500000);


    if (q) {
      const like = `%${q}%`;
      query = query.or(`symbol.ilike.${like},name.ilike.${like}`);
    }
    if (sector) query = query.eq("sector", sector);
    if (assetType) query = query.eq("asset_type", assetType);
    if (minMarketCap != null) query = query.gte("market_cap", minMarketCap);
    if (maxPE != null) query = query.lte("pe_ratio", maxPE).gt("pe_ratio", 0);
    if (minPrice != null) query = query.gte("price", minPrice);
    if (maxPrice != null) query = query.lte("price", maxPrice);
    if (minChange != null) query = query.gte("change_pct", minChange);
    if (maxChange != null) query = query.lte("change_pct", maxChange);
    if (minDivYield != null) query = query.gte("dividend_yield", minDivYield);
    if (rating && RATING_RANGES[rating]) {
      const [lo, hi] = RATING_RANGES[rating];
      query = query.gte("combined_score", lo).lt("combined_score", hi);
    }

    query = query.order(sort, { ascending: dir === "asc", nullsFirst: false });
    // Stable tiebreaker.
    if (sort !== "symbol") query = query.order("symbol", { ascending: true });
    query = query.range(from, to);

    const { data, error, count } = await query;
    if (error) throw error;

    const rows = (data ?? []).map((r: any) => ({
      ...r,
      rating: r.fundamental_score == null && r.technical_score == null
        ? null
        : scoreToRating(r.combined_score),
    }));

    return new Response(
      JSON.stringify({ success: true, rows, total: count ?? 0, page, pageSize }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("screener error", err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});