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

// 20-day ATR% — average true range as % of price. High readings mark
// whipsaw names where directional tech signals are noisy.
function atrPct(highs: number[], lows: number[], closes: number[], period = 20): number | null {
  if (highs.length < period + 1 || lows.length < period + 1 || closes.length < period + 1) return null;
  const trs: number[] = [];
  for (let i = closes.length - period; i < closes.length; i++) {
    const h = highs[i], l = lows[i], pc = closes[i - 1];
    if (h == null || l == null || pc == null) continue;
    trs.push(Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc)));
  }
  if (trs.length === 0) return null;
  const atr = trs.reduce((a, b) => a + b, 0) / trs.length;
  const last = closes[closes.length - 1];
  if (!last || last <= 0) return null;
  return (atr / last) * 100;
}

// ---------------- Scoring (matches Screener rubric) ----------------

// v3 rubric: RSI ±2, MACD ±2 (magnitude aware), MA/cross ±2, volume ±1,
// extension vs SMA200 ±2. Sum max ±9, normalize to ±6 by multiplying by 6/9.
function volumeSubScore(volume: number | null, avgVolume: number | null, changePct: number | null): number {
  if (volume == null || avgVolume == null || avgVolume <= 0 || changePct == null) return 0;
  const ratio = volume / avgVolume;
  if (ratio < 1.5) return 0;
  return changePct >= 0 ? 1 : -1;
}

function technicalScore(input: {
  price: number | null;
  rsi: number | null;
  macdHist: number | null; macdPrev: number | null;
  sma50: number | null; sma200: number | null;
  sma50Prev: number | null; sma200Prev: number | null;
  volume: number | null; avgVolume: number | null; changePct: number | null;
  atrPct?: number | null;
}): { score: number | null; volumeSub: number } {
  let c = 0, n = 0;

  // RSI(14): oversold bullish, overbought bearish.
  if (input.rsi != null) {
    let s = 0;
    if (input.rsi < 30) s = 2;
    else if (input.rsi < 40) s = 1;
    else if (input.rsi > 70) s = -2;
    else if (input.rsi > 60) s = -1;
    c += s; n++;
  }

  // MACD histogram: direction + widening magnitude.
  if (input.macdHist != null && input.macdPrev != null) {
    const h = input.macdHist, ph = input.macdPrev;
    let s = 0;
    if (h > 0 && ph > 0 && h > ph) s = 2;         // positive & widening
    else if (h > 0 && ph <= 0) s = 1;              // just crossed positive
    else if (h > 0) s = 1;                         // positive but narrowing
    else if (h < 0 && ph < 0 && h < ph) s = -2;    // negative & widening
    else if (h < 0 && ph >= 0) s = -1;             // just crossed negative
    else if (h < 0) s = -1;                        // negative but narrowing
    c += s; n++;
  }

  // Price vs SMA50/SMA200 with golden/death cross detection.
  if (input.price != null && input.sma50 != null && input.sma200 != null) {
    const p = input.price;
    const above50 = p > input.sma50;
    const above200 = p > input.sma200;
    const goldenCross =
      input.sma50Prev != null && input.sma200Prev != null &&
      input.sma50Prev <= input.sma200Prev && input.sma50 > input.sma200;
    const deathCross =
      input.sma50Prev != null && input.sma200Prev != null &&
      input.sma50Prev >= input.sma200Prev && input.sma50 < input.sma200;
    let s = 0;
    if (goldenCross && above50 && above200) s = 2;
    else if (above50 && above200) s = 1;
    else if (deathCross && !above50 && !above200) s = -2;
    else if (!above50 && !above200) s = -1;
    c += s; n++;
  }

  // Extension vs SMA200: penalize stocks trading far above (or reward far
  // below) the long-term trend. This is what catches "great fundamentals
  // but blow-off top" names like MU near a cyclical peak.
  if (input.price != null && input.sma200 != null && input.sma200 > 0) {
    const ratio = input.price / input.sma200;
    let s = 0;
    if (ratio >= 2.5) s = -3;         // ≥150% above = blow-off top territory
    else if (ratio >= 2.0) s = -2;    // >100% above 200-day = extremely stretched
    else if (ratio >= 1.5) s = -1;    // >50% above = stretched
    else if (ratio <= 0.5) s = 2;     // >50% below = deep-value opportunity
    else if (ratio <= 0.75) s = 1;    // >25% below
    c += s; n++;
  }

  const volSub = volumeSubScore(input.volume, input.avgVolume, input.changePct);
  c += volSub; // volume can bump ±1 regardless of other n count

  if (n === 0) return { score: null, volumeSub: volSub };
  // Max raw sum is ±10 (RSI 2 + MACD 2 + MA 2 + extension 3 + volume 1);
  // scale to the ±6 band used by fundamentals.
  let scaled = (c * 6) / 10;
  // Volatility cap: on very choppy names (ATR% > 8) tech signals are
  // unreliable — cap magnitude at ±1 so they don't drive strong ratings.
  if (input.atrPct != null && input.atrPct > 8) {
    scaled = Math.max(-1, Math.min(1, scaled));
  }
  return { score: scaled, volumeSub: volSub };
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

// Full OHLC pull for ATR + price-sanity fallback.
async function fetchDailyOHLC(symbol: string, auth: { crumb: string; cookie: string }): Promise<{ highs: number[]; lows: number[]; closes: number[] } | null> {
  try {
    const url = `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1y&interval=1d&crumb=${encodeURIComponent(auth.crumb)}`;
    const r = await fetch(url, { headers: { "User-Agent": YAHOO_UA, "Cookie": auth.cookie, "Accept": "application/json" } });
    if (!r.ok) return null;
    const j = await r.json();
    const q = j?.chart?.result?.[0]?.indicators?.quote?.[0];
    if (!q) return null;
    const highs = (q.high ?? []).filter((v: any) => typeof v === "number" && !isNaN(v));
    const lows = (q.low ?? []).filter((v: any) => typeof v === "number" && !isNaN(v));
    const closes = (q.close ?? []).filter((v: any) => typeof v === "number" && !isNaN(v));
    if (!closes.length) return null;
    return { highs, lows, closes };
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
        let sma50Prev: number | null = null, sma200Prev: number | null = null;
        let atrValue: number | null = null;

        // Compute indicators for stocks AND ETFs — ETFs price like equities
        // so RSI/MACD/SMA/ATR all apply, and it's the only score they get.
        {
          const ohlc = await fetchDailyOHLC(sym, auth);
          const closes = ohlc?.closes ?? null;
          if (closes && closes.length >= 20) {
            rsiVal = rsi(closes, 14);
            macdRes = macd(closes);
            sma50 = sma(closes, 50);
            sma200 = sma(closes, 200);
            // Prior-day SMAs so we can detect golden/death cross transitions.
            sma50Prev = closes.length > 50 ? sma(closes.slice(0, -1), 50) : null;
            sma200Prev = closes.length > 200 ? sma(closes.slice(0, -1), 200) : null;
            if (ohlc) atrValue = atrPct(ohlc.highs, ohlc.lows, ohlc.closes, 20);

            // Price sanity: if the batch-quote price is >20% off the last
            // daily close, prefer the chart close (catches the phantom
            // $975 MU-style glitch).
            const lastClose = closes[closes.length - 1];
            if (q.price != null && lastClose && Math.abs(q.price - lastClose) / lastClose > 0.20) {
              console.warn(`price mismatch ${sym}: quote=${q.price} lastClose=${lastClose} — using lastClose`);
              q.price = lastClose;
            }
          }
          await new Promise((r) => setTimeout(r, 25));
        }

        const { score: techScore, volumeSub } = technicalScore({
          price: q.price, rsi: rsiVal,
          macdHist: macdRes?.hist ?? null, macdPrev: macdRes?.prevHist ?? null,
          sma50, sma200, sma50Prev, sma200Prev,
          volume: q.volume, avgVolume: q.avgVolume, changePct: q.changePct,
          atrPct: atrValue,
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
          sma_50_prev: sma50Prev,
          sma_200_prev: sma200Prev,
          volume_score: volumeSub,
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