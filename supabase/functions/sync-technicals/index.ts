// sync-technicals: nightly refresh of price + technical indicators for the
// full universe. Uses Yahoo v7 batch quote for price/volume/marketCap
// (up to 100 symbols per call) and Yahoo chart per-symbol for the daily
// candles needed to compute RSI(14), MACD(12/26/9), SMA50, SMA200.
// Sharded via {offset, limit} body params so cron can run 4 shards in parallel.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const YAHOO_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

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
    const cookie = setCookie.split(/,(?=[^ ]+=)/).map((c) => c.split(";")[0].trim()).filter(Boolean).join("; ");
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
  } catch { return null; }
}

// ---------------- Indicators ----------------

function sma(values: number[], period: number): number | null {
  if (values.length < period) return null;
  let s = 0;
  for (let i = values.length - period; i < values.length; i++) s += values[i];
  return s / period;
}

function rsi(values: number[], period = 14): number | null {
  if (values.length < period + 1) return null;
  let gains = 0, losses = 0;
  for (let i = 1; i <= period; i++) {
    const d = values[i] - values[i - 1];
    if (d >= 0) gains += d; else losses -= d;
  }
  let avgGain = gains / period;
  let avgLoss = losses / period;
  for (let i = period + 1; i < values.length; i++) {
    const d = values[i] - values[i - 1];
    const g = d > 0 ? d : 0;
    const l = d < 0 ? -d : 0;
    avgGain = (avgGain * (period - 1) + g) / period;
    avgLoss = (avgLoss * (period - 1) + l) / period;
  }
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

function ema(values: number[], period: number): number[] {
  const out: number[] = [];
  const k = 2 / (period + 1);
  let prev = values[0];
  out.push(prev);
  for (let i = 1; i < values.length; i++) {
    prev = values[i] * k + prev * (1 - k);
    out.push(prev);
  }
  return out;
}

function macd(values: number[]): { hist: number; prevHist: number } | null {
  if (values.length < 35) return null;
  const ema12 = ema(values, 12);
  const ema26 = ema(values, 26);
  const macdLine: number[] = ema12.map((v, i) => v - ema26[i]);
  const signalLine = ema(macdLine.slice(-Math.min(macdLine.length, 100)), 9);
  const line = macdLine.slice(-signalLine.length);
  const hist = line[line.length - 1] - signalLine[signalLine.length - 1];
  const prevHist = line[line.length - 2] - signalLine[signalLine.length - 2];
  return { hist, prevHist };
}

// ---------------- Scoring (matches Screener rubric) ----------------

function technicalScore(input: {
  price: number | null; rsi: number | null; macdHist: number | null; macdPrev: number | null;
  sma50: number | null; sma200: number | null; volume: number | null; avgVolume: number | null;
}): number | null {
  let c = 0, n = 0;
  if (input.rsi != null) {
    let s: number;
    if (input.rsi < 30) s = 2; else if (input.rsi < 45) s = 1;
    else if (input.rsi <= 55) s = 0; else if (input.rsi <= 70) s = -1; else s = -2;
    c += s; n++;
  }
  if (input.macdHist != null && input.macdPrev != null) {
    const h = input.macdHist, ph = input.macdPrev;
    let s: number;
    if (ph <= 0 && h > 0) s = 2;
    else if (h > 0 && h > ph) s = 2;
    else if (h > 0) s = 1;
    else if (ph >= 0 && h < 0) s = -2;
    else if (h < 0 && h < ph) s = -2;
    else if (h < 0) s = -1;
    else s = 0;
    c += s; n++;
  }
  if (input.price != null && input.sma50 != null && input.sma200 != null) {
    const p = input.price;
    let s: number;
    if (p > input.sma50 && p > input.sma200 && input.sma50 > input.sma200) s = 2;
    else if (p > input.sma50 && p > input.sma200) s = 1;
    else if (p < input.sma50 && p < input.sma200 && input.sma50 < input.sma200) s = -2;
    else if (p < input.sma50 && p < input.sma200) s = -1;
    else s = 0;
    c += s; n++;
  }
  if (n === 0) return null;
  if (input.volume != null && input.avgVolume != null && input.avgVolume > 0) {
    const ratio = input.volume / input.avgVolume;
    if (ratio > 1.5) c += c >= 0 ? 1 : -1;
    else if (ratio < 0.5) c += c >= 0 ? -0.5 : 0.5;
  }
  return c;
}

// ---------------- Yahoo fetchers ----------------

type QuoteRow = { symbol: string; price: number | null; changePct: number | null; volume: number | null; avgVolume: number | null; marketCap: number | null; high52: number | null; low52: number | null; };

async function batchQuote(symbols: string[], auth: { crumb: string; cookie: string }): Promise<QuoteRow[]> {
  const url = `https://query2.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbols.join(","))}&crumb=${encodeURIComponent(auth.crumb)}`;
  try {
    const r = await fetch(url, { headers: { "User-Agent": YAHOO_UA, "Cookie": auth.cookie, "Accept": "application/json" } });
    if (!r.ok) return [];
    const j = await r.json();
    const arr = j?.quoteResponse?.result ?? [];
    return arr.map((q: any) => ({
      symbol: String(q.symbol).toUpperCase(),
      price: q.regularMarketPrice ?? null,
      changePct: q.regularMarketChangePercent ?? null,
      volume: q.regularMarketVolume ?? null,
      avgVolume: q.averageDailyVolume3Month ?? q.averageDailyVolume10Day ?? null,
      marketCap: q.marketCap ?? null,
      high52: q.fiftyTwoWeekHigh ?? null,
      low52: q.fiftyTwoWeekLow ?? null,
    }));
  } catch { return []; }
}

async function fetchDailyCloses(symbol: string, auth: { crumb: string; cookie: string }): Promise<number[] | null> {
  try {
    const url = `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1y&interval=1d&crumb=${encodeURIComponent(auth.crumb)}`;
    const r = await fetch(url, { headers: { "User-Agent": YAHOO_UA, "Cookie": auth.cookie, "Accept": "application/json" } });
    if (!r.ok) return null;
    const j = await r.json();
    const closes = j?.chart?.result?.[0]?.indicators?.quote?.[0]?.close ?? [];
    const clean = (closes as (number | null)[]).filter((v): v is number => typeof v === "number" && !isNaN(v));
    return clean.length ? clean : null;
  } catch { return null; }
}

// ---------------- Runner ----------------

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    let offset = 0, limit = 2000;
    try {
      const body = await req.json();
      if (typeof body?.offset === "number") offset = body.offset;
      if (typeof body?.limit === "number") limit = Math.min(body.limit, 3000);
    } catch { /* no body */ }

    const { data: uni } = await supabase
      .from("securities_universe")
      .select("symbol, asset_type")
      .eq("is_active", true)
      .order("symbol")
      .range(offset, offset + limit - 1);

    const symbols = (uni ?? []).map((r: any) => r.symbol as string);
    const isEtf = new Map<string, boolean>((uni ?? []).map((r: any) => [r.symbol, r.asset_type === "etf"]));
    if (symbols.length === 0) {
      return new Response(JSON.stringify({ success: true, message: "no symbols in shard" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const auth = await getYahooCrumb();
    if (!auth) return new Response(JSON.stringify({ error: "crumb failed" }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    // Step 1: batch quotes in chunks of 100.
    const quoteMap = new Map<string, QuoteRow>();
    for (let i = 0; i < symbols.length; i += 100) {
      const chunk = symbols.slice(i, i + 100);
      const rows = await batchQuote(chunk, auth);
      for (const r of rows) quoteMap.set(r.symbol, r);
      await new Promise((r) => setTimeout(r, 80));
    }

    // Step 2: per-symbol chart for indicators (concurrency 8).
    const outputs: Record<string, unknown>[] = [];
    let cursor = 0;
    const workers = Array.from({ length: 8 }, async () => {
      while (cursor < symbols.length) {
        const idx = cursor++;
        const sym = symbols[idx];
        const q = quoteMap.get(sym);
        if (!q?.price) continue;

        let rsiVal: number | null = null;
        let macdRes: { hist: number; prevHist: number } | null = null;
        let sma50: number | null = null, sma200: number | null = null;

        // ETFs skip indicator computation to keep the sync fast; they still
        // get price/market cap. Uncomment to include:
        if (!isEtf.get(sym)) {
          const closes = await fetchDailyCloses(sym, auth);
          if (closes && closes.length >= 20) {
            rsiVal = rsi(closes, 14);
            macdRes = macd(closes);
            sma50 = sma(closes, 50);
            sma200 = sma(closes, 200);
          }
          await new Promise((r) => setTimeout(r, 25));
        }

        const techScore = technicalScore({
          price: q.price, rsi: rsiVal, macdHist: macdRes?.hist ?? null, macdPrev: macdRes?.prevHist ?? null,
          sma50, sma200, volume: q.volume, avgVolume: q.avgVolume,
        });

        outputs.push({
          symbol: sym,
          price: q.price,
          change_pct: q.changePct,
          volume: q.volume,
          avg_volume: q.avgVolume,
          market_cap: q.marketCap,
          rsi_14: rsiVal,
          macd_hist: macdRes?.hist ?? null,
          macd_prev_hist: macdRes?.prevHist ?? null,
          sma_50: sma50,
          sma_200: sma200,
          fifty_two_week_high: q.high52,
          fifty_two_week_low: q.low52,
          technical_score: techScore,
          updated_at: new Date().toISOString(),
        });
      }
    });
    await Promise.all(workers);

    // Upsert.
    const CHUNK = 300;
    for (let i = 0; i < outputs.length; i += CHUNK) {
      const slice = outputs.slice(i, i + CHUNK);
      const { error } = await supabase.from("technicals").upsert(slice, { onConflict: "symbol" });
      if (error) console.error("upsert error", error);
    }

    return new Response(
      JSON.stringify({ success: true, offset, limit, processed: outputs.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("sync-technicals error", err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});