// stock-why-moved: given a ticker, returns a 2-3 sentence explanation of
// today's price move, grounded in the last 72h of company news from
// Finnhub and the live change % from Yahoo. Cached in-memory per symbol
// for 15 minutes so repeat page loads are instant.

import "https://deno.land/x/xhr@0.1.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type CacheEntry = { t: number; payload: unknown };
const cache = new Map<string, CacheEntry>();
const TTL_MS = 15 * 60 * 1000;

const YAHOO_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

async function fetchQuote(symbol: string) {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=5d&interval=1d`;
    const r = await fetch(url, { headers: { "User-Agent": YAHOO_UA } });
    if (!r.ok) return null;
    const j = await r.json();
    const meta = j?.chart?.result?.[0]?.meta;
    if (!meta) return null;
    const price = meta.regularMarketPrice;
    const prev = meta.chartPreviousClose ?? meta.previousClose;
    const changePct = prev ? ((price - prev) / prev) * 100 : null;
    return { price, prev, changePct };
  } catch { return null; }
}

async function fetchCompanyNews(symbol: string, apiKey: string) {
  const to = new Date();
  const from = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  try {
    const url = `https://finnhub.io/api/v1/company-news?symbol=${encodeURIComponent(symbol)}&from=${fmt(from)}&to=${fmt(to)}&token=${apiKey}`;
    const r = await fetch(url);
    if (!r.ok) return [];
    const arr = await r.json();
    if (!Array.isArray(arr)) return [];
    // Newest first, cap to 8 headlines for the prompt.
    return arr
      .sort((a: any, b: any) => (b.datetime ?? 0) - (a.datetime ?? 0))
      .slice(0, 8)
      .map((n: any) => ({
        title: String(n.headline ?? "").slice(0, 240),
        summary: String(n.summary ?? "").slice(0, 400),
        source: String(n.source ?? ""),
        url: String(n.url ?? ""),
        datetime: n.datetime ?? 0,
      }));
  } catch { return []; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { symbol } = await req.json();
    if (!symbol || typeof symbol !== "string") {
      return new Response(JSON.stringify({ error: "symbol required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const sym = symbol.toUpperCase();
    const key = `why:${sym}:${new Date().toISOString().slice(0, 13)}`; // hour bucket

    const hit = cache.get(key);
    if (hit && Date.now() - hit.t < TTL_MS) {
      return new Response(JSON.stringify(hit.payload), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const FINNHUB = Deno.env.get("FINNHUB_API_KEY");
    const LOVABLE = Deno.env.get("LOVABLE_API_KEY");

    const [quote, headlines] = await Promise.all([
      fetchQuote(sym),
      FINNHUB ? fetchCompanyNews(sym, FINNHUB) : Promise.resolve([]),
    ]);

    const changePct = quote?.changePct ?? null;
    const direction = changePct == null
      ? "moved sideways"
      : changePct > 0.2 ? "rose" : changePct < -0.2 ? "fell" : "traded flat";
    const magnitude = changePct != null ? `${changePct > 0 ? "+" : ""}${changePct.toFixed(2)}%` : "n/a";

    let summary = "";

    if (LOVABLE) {
      const prompt = `The stock ${sym} ${direction} ${magnitude} today.

Recent company headlines (newest first):
${headlines.length ? headlines.map((h, i) => `${i + 1}. ${h.title}${h.summary ? " — " + h.summary : ""} (${h.source})`).join("\n") : "No fresh company-specific headlines were available."}

Write 2-3 tight sentences explaining WHY ${sym} likely moved that way today. Ground your explanation in the headlines when they match the direction. If the headlines don't obviously drive the move, say the move looks tied to broad market / sector flow and name one plausible macro factor. Never say "I don't know" — give a decisive read. No hedging language. No preamble.`;

      try {
        const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${LOVABLE}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [
              { role: "system", content: "You are a decisive equity strategist who explains daily stock moves in plain English." },
              { role: "user", content: prompt },
            ],
            max_tokens: 220,
          }),
        });
        if (r.ok) {
          const j = await r.json();
          summary = String(j?.choices?.[0]?.message?.content ?? "").trim();
        } else if (r.status === 429) {
          summary = "Analysis temporarily rate-limited — try again in a minute.";
        } else if (r.status === 402) {
          summary = "AI credits exhausted for this workspace.";
        }
      } catch (e) {
        console.error("AI gateway error", e);
      }
    }

    if (!summary) {
      summary = headlines.length
        ? `${sym} ${direction} ${magnitude} today. Recent headlines: ${headlines.slice(0, 2).map((h) => h.title).join(" — ")}.`
        : `${sym} ${direction} ${magnitude} today with no company-specific headlines standing out — the move looks tied to broader market flow.`;
    }

    const payload = {
      symbol: sym,
      changePct,
      summary,
      headlines: headlines.slice(0, 5),
      generatedAt: new Date().toISOString(),
    };
    cache.set(key, { t: Date.now(), payload });

    return new Response(JSON.stringify(payload), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("stock-why-moved error", err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});