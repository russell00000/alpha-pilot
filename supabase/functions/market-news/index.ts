import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface NewsArticle {
  title: string;
  source: string;
  time: string;
  category: string;
  url: string;
  summary?: string;
  image?: string;
  domain?: string;
}

const CATEGORIES = ["general", "forex", "crypto", "merger"] as const;
const PER_SOURCE_CAP = 2; // never more than N articles from the same outlet
const MAX_ARTICLES = 18;

// In-memory cache: news is identical for every visitor, so cache the
// finished payload for 5 minutes to keep Finnhub calls flat under load.
let NEWS_CACHE: { t: number; body: string } | null = null;
const NEWS_TTL_MS = 5 * 60 * 1000;

function hostname(u: string): string {
  try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return ""; }
}

function timeAgo(epochSec: number): string {
  const diffMs = Date.now() - epochSec * 1000;
  const m = Math.floor(diffMs / 60000);
  if (m < 1) return "Just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function classify(headline: string, summary: string): string {
  const c = `${headline} ${summary}`.toLowerCase();
  if (/(crypto|bitcoin|ethereum|btc|eth|solana)/.test(c)) return "Crypto";
  if (/(tech|apple|google|nvidia|microsoft|\bai\b|semiconductor|chip|meta\b|amazon)/.test(c)) return "Tech";
  if (/(fed|rate|inflation|economy|gdp|jobs|cpi|ppi|fomc)/.test(c)) return "Economy";
  if (/(oil|gold|commodity|copper|natural gas|opec)/.test(c)) return "Commodities";
  if (/(earn|revenue|profit|quarter|guidance|eps)/.test(c)) return "Earnings";
  if (/(merger|acquisition|buyout|deal|spinoff)/.test(c)) return "M&A";
  if (/(forex|dollar|yen|euro|currency|yuan)/.test(c)) return "Forex";
  return "Markets";
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (NEWS_CACHE && Date.now() - NEWS_CACHE.t < NEWS_TTL_MS) {
      return new Response(NEWS_CACHE.body, {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
          "Cache-Control": "public, max-age=120, s-maxage=300",
          "X-Cache": "HIT",
        },
        status: 200,
      });
    }

    const FINNHUB_API_KEY = Deno.env.get('FINNHUB_API_KEY');
    if (!FINNHUB_API_KEY) {
      throw new Error("News API not configured");
    }

    // Pull from multiple Finnhub category feeds in parallel for source/topic variety.
    const responses = await Promise.all(
      CATEGORIES.map((c) =>
        fetch(`https://finnhub.io/api/v1/news?category=${c}&token=${FINNHUB_API_KEY}`)
          .then((r) => (r.ok ? r.json() : []))
          .catch(() => []),
      ),
    );

    const merged: any[] = [];
    for (const list of responses) if (Array.isArray(list)) merged.push(...list);

    // Dedupe by URL and by normalized headline.
    const seenUrls = new Set<string>();
    const seenTitles = new Set<string>();
    const deduped: any[] = [];
    for (const a of merged) {
      if (!a?.url || !a?.headline) continue;
      const urlKey = a.url.split("?")[0];
      const titleKey = String(a.headline).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
      if (seenUrls.has(urlKey) || seenTitles.has(titleKey)) continue;
      seenUrls.add(urlKey);
      seenTitles.add(titleKey);
      deduped.push(a);
    }

    // Sort newest first.
    deduped.sort((a, b) => (b.datetime ?? 0) - (a.datetime ?? 0));

    // Round-robin by source so no outlet dominates the top of the list.
    const bySource = new Map<string, any[]>();
    for (const a of deduped) {
      const key = (a.source || hostname(a.url) || "Unknown").toString();
      if (!bySource.has(key)) bySource.set(key, []);
      bySource.get(key)!.push(a);
    }
    const queues = Array.from(bySource.values());
    const counts = new Map<string, number>();
    const ordered: any[] = [];
    let progressed = true;
    while (ordered.length < MAX_ARTICLES && progressed) {
      progressed = false;
      for (const q of queues) {
        if (!q.length) continue;
        const next = q[0];
        const src = (next.source || hostname(next.url) || "Unknown").toString();
        if ((counts.get(src) ?? 0) >= PER_SOURCE_CAP) { q.shift(); continue; }
        ordered.push(q.shift());
        counts.set(src, (counts.get(src) ?? 0) + 1);
        progressed = true;
        if (ordered.length >= MAX_ARTICLES) break;
      }
    }

    const articles: NewsArticle[] = ordered.map((a) => {
      const domain = hostname(a.url);
      const sum = (a.summary ?? "").toString();
      return {
        title: a.headline,
        source: a.source || domain || "Unknown",
        time: timeAgo(a.datetime ?? Math.floor(Date.now() / 1000)),
        category: classify(a.headline ?? "", sum),
        url: a.url,
        summary: sum ? sum.substring(0, 180) + (sum.length > 180 ? "…" : "") : undefined,
        image: a.image || undefined,
        domain,
      };
    });

    const payload = JSON.stringify({ data: articles });
    NEWS_CACHE = { t: Date.now(), body: payload };
    return new Response(payload, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=120, s-maxage=300',
        'X-Cache': 'MISS',
      },
      status: 200,
    });

  } catch (error) {
    console.error("Error fetching market news:", error);
    
    const errorMessage = error instanceof Error ? error.message : "Failed to fetch news";
    
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        data: [] 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 // Return 200 with error in body to handle gracefully on frontend
      }
    );
  }
});
