import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Finnhub IPO calendar returns upcoming + recently completed IPOs.
// Docs: https://finnhub.io/docs/api/ipo-calendar
type FinnhubIpo = {
  date: string;
  exchange: string;
  name: string;
  numberOfShares?: number;
  price?: string;
  status?: string;
  symbol: string;
  totalSharesValue?: number;
};

const fmt = (d: Date) => d.toISOString().slice(0, 10);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const apiKey = Deno.env.get("FINNHUB_API_KEY");
    if (!apiKey) throw new Error("FINNHUB_API_KEY not configured");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Window: last 60 days through next 30 days — catches both freshly-priced
    // IPOs and upcoming listings.
    const now = new Date();
    const from = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
    const to = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const url = `https://finnhub.io/api/v1/calendar/ipo?from=${fmt(from)}&to=${fmt(to)}&token=${apiKey}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Finnhub IPO calendar failed: ${res.status}`);
    const payload = (await res.json()) as { ipoCalendar?: FinnhubIpo[] };
    const ipos = payload.ipoCalendar ?? [];

    // Deduplicate by symbol; skip rows without a real ticker.
    const seen = new Set<string>();
    const rows = ipos
      .filter((i) => i.symbol && /^[A-Z0-9.\-]{1,10}$/.test(i.symbol.toUpperCase()))
      .filter((i) => {
        const s = i.symbol.toUpperCase();
        if (seen.has(s)) return false;
        seen.add(s);
        return true;
      })
      .map((i) => ({
        symbol: i.symbol.toUpperCase(),
        name: i.name || i.symbol.toUpperCase(),
        exchange: i.exchange ?? null,
        ipo_date: i.date ?? null,
        source: "finnhub_ipo",
        is_active: true,
      }));

    if (rows.length === 0) {
      return new Response(JSON.stringify({ success: true, inserted: 0, message: "no IPOs in window" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { error } = await supabase
      .from("securities")
      .upsert(rows, { onConflict: "symbol", ignoreDuplicates: false });
    if (error) throw error;

    return new Response(
      JSON.stringify({ success: true, upserted: rows.length, window: { from: fmt(from), to: fmt(to) } }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("sync-ipos error", err);
    return new Response(
      JSON.stringify({ success: false, error: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});