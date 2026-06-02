import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SECTOR_ETF_MAP: Record<string, string> = {
  "Technology": "XLK", "Financial Services": "XLF", "Financial": "XLF",
  "Healthcare": "XLV", "Consumer Cyclical": "XLY", "Consumer Defensive": "XLP",
  "Energy": "XLE", "Industrials": "XLI", "Basic Materials": "XLB",
  "Utilities": "XLU", "Real Estate": "XLRE", "Communication Services": "XLC",
};

// ----- In-memory cache (per edge instance) -----
const CACHE_TTL_MS = 30 * 60 * 1000; // 30m forecasts; price moves slowly at 12-mo horizon
const cache = new Map<string, { ts: number; data: unknown }>();
function cacheGet<T>(key: string): T | null {
  const e = cache.get(key);
  if (!e) return null;
  if (Date.now() - e.ts > CACHE_TTL_MS) { cache.delete(key); return null; }
  return e.data as T;
}
function cacheSet(key: string, data: unknown) {
  cache.set(key, { ts: Date.now(), data });
}

interface PriceSeries { closes: number[]; timestamps: number[] }

async function fetchPriceSeries(sym: string, range = "3y"): Promise<PriceSeries> {
  const key = `prices:${sym}:${range}`;
  const cached = cacheGet<PriceSeries>(key);
  if (cached) return cached;
  try {
    const r = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${sym}?interval=1d&range=${range}`,
      { headers: { "User-Agent": "Mozilla/5.0" } },
    );
    if (!r.ok) return { closes: [], timestamps: [] };
    const data = await r.json();
    const result = data?.chart?.result?.[0];
    const rawCloses = (result?.indicators?.quote?.[0]?.close ?? []) as Array<number | null>;
    const rawTs = (result?.timestamp ?? []) as number[];
    const closes: number[] = [];
    const timestamps: number[] = [];
    for (let i = 0; i < rawCloses.length; i++) {
      const c = rawCloses[i];
      if (typeof c === "number" && c > 0) {
        closes.push(c);
        timestamps.push(rawTs[i] ?? 0);
      }
    }
    const out = { closes, timestamps };
    cacheSet(key, out);
    return out;
  } catch {
    return { closes: [], timestamps: [] };
  }
}

const ret = (p: number[], d: number) => {
  if (p.length < d + 1) return null;
  const a = p[p.length - 1 - d], b = p[p.length - 1];
  return !a || !b ? null : ((b - a) / a) * 100;
};
const cagr = (p: number[], y: number) => {
  const n = Math.round(252 * y);
  if (p.length < n + 1) return null;
  const a = p[p.length - 1 - n], b = p[p.length - 1];
  return !a || !b ? null : (Math.pow(b / a, 1 / y) - 1) * 100;
};
const sma = (p: number[], w: number) =>
  p.length < w ? null : p.slice(-w).reduce((a, b) => a + b, 0) / w;
// EWMA-style volatility: weight recent regime more heavily (lambda=0.94 RiskMetrics-style).
const volatility = (p: number[], windowDays = 252) => {
  if (p.length < 30) return null;
  const slice = p.slice(-Math.min(windowDays, p.length));
  const r: number[] = [];
  for (let i = 1; i < slice.length; i++) if (slice[i - 1] > 0) r.push(Math.log(slice[i] / slice[i - 1]));
  if (r.length < 20) return null;
  const lambda = 0.94;
  let variance = r.reduce((a, b) => a + b * b, 0) / r.length;
  for (const x of r) variance = lambda * variance + (1 - lambda) * x * x;
  return Math.sqrt(variance) * Math.sqrt(252) * 100;
};
const maxDD = (p: number[]) => {
  if (p.length < 30) return null;
  let peak = p[0], dd = 0;
  for (const x of p) {
    if (x > peak) peak = x;
    const d = (x - peak) / peak;
    if (d < dd) dd = d;
  }
  return dd * 100;
};
const sharpe = (p: number[], rf = 0.045) => {
  if (p.length < 60) return null;
  const r: number[] = [];
  for (let i = 1; i < p.length; i++) if (p[i - 1] > 0) r.push((p[i] - p[i - 1]) / p[i - 1]);
  const m = r.reduce((a, b) => a + b, 0) / r.length;
  const v = r.reduce((a, b) => a + (b - m) ** 2, 0) / r.length;
  const sd = Math.sqrt(v);
  return sd === 0 ? null : ((m * 252) - rf) / (sd * Math.sqrt(252));
};
const rsi = (p: number[], period = 14) => {
  if (p.length < period + 1) return null;
  let g = 0, l = 0;
  for (let i = p.length - period; i < p.length; i++) {
    const d = p[i] - p[i - 1];
    if (d >= 0) g += d; else l -= d;
  }
  const ag = g / period, al = l / period;
  if (al === 0) return 100;
  return 100 - 100 / (1 + ag / al);
};

// Parse % strings like "12.3%" or "+8%" into number; null otherwise.
function parsePct(s?: string): number | null {
  if (!s) return null;
  const m = s.match(/-?\d+(\.\d+)?/);
  return m ? Number(m[0]) : null;
}

async function buildForecast(symbol: string) {
  const cacheKey = `forecast:${symbol}`;
  const cached = cacheGet<unknown>(cacheKey);
  if (cached) return cached;

  const candidates = symbol.includes("-") ? [symbol] : [symbol, `${symbol}-USD`];
  for (const sym of candidates) {
    // Parallelize: prices + fundamentals + (sector benchmark fetched lazily after sector known)
    const [series, summaryResp] = await Promise.all([
      fetchPriceSeries(sym, "3y"),
      fetch(
        `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${sym}?modules=assetProfile,summaryDetail,defaultKeyStatistics,financialData,recommendationTrend,upgradeDowngradeHistory,price`,
        { headers: { "User-Agent": "Mozilla/5.0" } },
      ),
    ]);
    const prices = series.closes;
    const timestamps = series.timestamps;
    if (prices.length < 30) continue;
    const cp = prices[prices.length - 1];

    let sector: string | undefined, industry: string | undefined, name = sym;
    let forwardPE: string | undefined, earningsGrowth: string | undefined, revenueGrowth: string | undefined;
    let recommendationMean: number | undefined, targetMean: number | undefined,
      targetHigh: number | undefined, targetLow: number | undefined, numAnalysts: number | undefined;
    let upgradesLast90d = 0, downgradesLast90d = 0;

    if (summaryResp.ok) {
      const sd = await summaryResp.json();
      const r0 = sd?.quoteSummary?.result?.[0];
      const ap = r0?.assetProfile, ks = r0?.defaultKeyStatistics, fd = r0?.financialData, pr = r0?.price;
      const udh = r0?.upgradeDowngradeHistory?.history ?? [];
      if (ap?.sector) sector = ap.sector;
      if (ap?.industry) industry = ap.industry;
      if (pr?.shortName || pr?.longName) name = pr.shortName || pr.longName;
      if (ks?.forwardPE?.fmt) forwardPE = ks.forwardPE.fmt;
      if (fd?.earningsGrowth?.fmt) earningsGrowth = fd.earningsGrowth.fmt;
      if (fd?.revenueGrowth?.fmt) revenueGrowth = fd.revenueGrowth.fmt;
      if (typeof fd?.recommendationMean?.raw === "number") recommendationMean = fd.recommendationMean.raw;
      if (typeof fd?.targetMeanPrice?.raw === "number") targetMean = fd.targetMeanPrice.raw;
      if (typeof fd?.targetHighPrice?.raw === "number") targetHigh = fd.targetHighPrice.raw;
      if (typeof fd?.targetLowPrice?.raw === "number") targetLow = fd.targetLowPrice.raw;
      if (typeof fd?.numberOfAnalystOpinions?.raw === "number") numAnalysts = fd.numberOfAnalystOpinions.raw;
      const cutoff = Math.floor(Date.now() / 1000) - 90 * 86400;
      for (const h of udh as Array<{ epochGradeDate?: number; action?: string }>) {
        if (!h.epochGradeDate || h.epochGradeDate < cutoff) continue;
        if (h.action === "up") upgradesLast90d++;
        else if (h.action === "down") downgradesLast90d++;
      }
    }

    const sma50 = sma(prices, 50);
    const sma200 = sma(prices, 200);
    const trend =
      sma50 && sma200
        ? cp > sma50 && sma50 > sma200
          ? "STRONG UPTREND"
          : cp < sma50 && sma50 < sma200
            ? "DOWNTREND"
            : cp > sma200
              ? "ABOVE LONG-TERM TREND"
              : "BELOW LONG-TERM TREND"
        : "INSUFFICIENT HISTORY";

    const return1Y = ret(prices, 252);
    const return3M = ret(prices, 63);
    const cagr3Y = cagr(prices, 3);
    const cagr5Y = cagr(prices, 5);
    const annualVolFast = volatility(prices, 63); // 3-month regime
    const annualVolLong = volatility(prices, 252); // 1Y baseline
    const annualVol =
      annualVolFast != null && annualVolLong != null
        ? annualVolFast * 0.6 + annualVolLong * 0.4
        : annualVolLong ?? annualVolFast;
    const ddVal = maxDD(prices);
    const sharpeVal = sharpe(prices);
    const rsiVal = rsi(prices);

    // Kick off sector benchmark fetch in parallel with forecast math.
    const benchSym = sector ? SECTOR_ETF_MAP[sector] : undefined;
    const benchPromise = benchSym
      ? fetchPriceSeries(benchSym, "2y").then(s => s.closes)
      : Promise.resolve<number[]>([]);

    // ---------- BLENDED DRIFT MODEL ----------
    // Convert each signal to an annualized expected return, then weight-blend.
    // 1) Analyst implied annual return (12-mo target → annualized).
    const analystImplied = targetMean ? ((targetMean - cp) / cp) * 100 : null;
    // 2) Long-run base rate (3Y CAGR, fall back to 5Y).
    const baseRate = cagr3Y ?? cagr5Y ?? return1Y ?? 8;
    // 3) Forward EPS growth as a proxy for fundamental drift.
    const epsGrowth = parsePct(earningsGrowth);
    // 4) Recent momentum (3M return annualized but dampened — momentum mean-reverts).
    const momentumAnn = return3M != null ? Math.max(-30, Math.min(30, (return3M ?? 0) * 2)) : 0;
    // 5) Trend regime adjustment.
    const regime =
      trend === "STRONG UPTREND" ? 4 :
      trend === "ABOVE LONG-TERM TREND" ? 1 :
      trend === "BELOW LONG-TERM TREND" ? -1 :
      trend === "DOWNTREND" ? -4 : 0;
    // 6) Mean-reversion correction from RSI extremes.
    const rsiAdj = rsiVal == null ? 0 : rsiVal > 70 ? -3 : rsiVal < 30 ? 3 : 0;

    // Weights: analyst > base rate > eps > momentum > regime/rsi.
    // Skip missing signals by re-normalizing weights.
    const signals: Array<{ value: number; w: number }> = [];
    if (analystImplied != null) signals.push({ value: analystImplied, w: 0.40 });
    signals.push({ value: baseRate, w: 0.25 });
    if (epsGrowth != null) signals.push({ value: Math.max(-30, Math.min(60, epsGrowth)), w: 0.15 });
    signals.push({ value: momentumAnn, w: 0.10 });
    signals.push({ value: regime + rsiAdj, w: 0.10 });
    const wSum = signals.reduce((a, s) => a + s.w, 0);
    let driftAnnPct = signals.reduce((a, s) => a + s.value * s.w, 0) / wSum;
    // Cap extremes — no model should imply > 80% or < -40% in 12 months.
    driftAnnPct = Math.max(-40, Math.min(80, driftAnnPct));

    // ---------- GBM-STYLE PROJECTION ----------
    // mu = annualized log drift; sigma = annualized log vol.
    const mu = Math.log(1 + driftAnnPct / 100);
    const sigma = (annualVol ?? 25) / 100;
    // 1.28 sigma ≈ 80% confidence interval (top/bottom decile).
    const Z = 1.282;
    // 12 monthly projection points (and one weekly resolution series for the chart).
    const projectionWeekly: Array<{ t: number; date: number; base: number; bull: number; bear: number }> = [];
    const nowSec = Math.floor(Date.now() / 1000);
    const weeks = 52;
    for (let i = 0; i <= weeks; i++) {
      const tYears = i / 52;
      const baseP = cp * Math.exp(mu * tYears);
      const sd = sigma * Math.sqrt(tYears);
      const bullP = baseP * Math.exp(Z * sd);
      const bearP = baseP * Math.exp(-Z * sd);
      projectionWeekly.push({
        t: i,
        date: nowSec + i * 7 * 86400,
        base: +baseP.toFixed(2),
        bull: +bullP.toFixed(2),
        bear: +bearP.toFixed(2),
      });
    }
    const last = projectionWeekly[projectionWeekly.length - 1];
    let base = last.base;
    let bull = last.bull;
    let bear = last.bear;

    // If analyst high/low exist and our band is tighter than analyst dispersion,
    // widen toward analyst extremes (analysts often capture qualitative scenarios our vol model misses).
    if (targetHigh && targetHigh > bull) {
      bull = (bull + targetHigh) / 2;
      // Rescale the weekly bull path
      const scale = bull / last.bull;
      for (const p of projectionWeekly) {
        p.bull = +(cp + (p.bull - cp) * scale).toFixed(2);
      }
    }
    if (targetLow && targetLow < bear) {
      bear = (bear + targetLow) / 2;
      const scale = bear / last.bear;
      for (const p of projectionWeekly) {
        p.bear = +(cp + (p.bear - cp) * scale).toFixed(2);
      }
    }

    // Confidence: scale on analyst count, signal alignment, and band width.
    const bandPct = ((bull - bear) / cp) * 100;
    const aligned =
      analystImplied != null &&
      ((analystImplied > 0 && trend.includes("UPTREND")) ||
        (analystImplied < 0 && trend.includes("DOWNTREND")));
    const epsAligned = epsGrowth != null && analystImplied != null && Math.sign(epsGrowth) === Math.sign(analystImplied);
    let confScore = 0;
    if ((numAnalysts ?? 0) >= 20) confScore += 2;
    else if ((numAnalysts ?? 0) >= 10) confScore += 1;
    if (aligned) confScore += 1;
    if (epsAligned) confScore += 1;
    if (bandPct < 30) confScore += 1;
    else if (bandPct > 80) confScore -= 1;
    const confidence = confScore >= 4 ? "High" : confScore >= 2 ? "Medium" : "Low";

    // Recent history slice (last ~6 months daily) for the chart.
    const HIST_DAYS = 126;
    const histStart = Math.max(0, prices.length - HIST_DAYS);
    const history = prices.slice(histStart).map((price, i) => ({
      date: timestamps[histStart + i] ?? nowSec,
      price: +price.toFixed(2),
    }));

    // Resolve sector benchmark now (already in-flight).
    const bp = await benchPromise;
    const sectorBenchmark = benchSym
      ? { symbol: benchSym, return1Y: ret(bp, 252), return3M: ret(bp, 63) }
      : undefined;

    const out = {
      symbol: sym,
      name,
      currentPrice: cp,
      base: +base.toFixed(2),
      bull: +bull.toFixed(2),
      bear: +bear.toFixed(2),
      confidence,
      indicators: {
        return1Y, cagr3Y, cagr5Y,
        annualVol: annualVol == null ? null : +annualVol.toFixed(1),
        maxDrawdown: ddVal,
        sharpe: sharpeVal, rsi14: rsiVal, trend, forwardPE,
        earningsGrowth, revenueGrowth, targetMean, numAnalysts,
        upgradesLast90d, downgradesLast90d, sector,
        driftAnnPct: +driftAnnPct.toFixed(1),
        modelBandPct: +bandPct.toFixed(1),
      },
      sectorBenchmark,
      recommendationMean,
      industry,
      history,
      projection: projectionWeekly,
    };
    cacheSet(cacheKey, out);
    return out;
  }
  return null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const url = new URL(req.url);
    let symbol = url.searchParams.get("symbol");
    if (!symbol && req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      symbol = body?.symbol;
    }
    if (!symbol || typeof symbol !== "string" || symbol.length > 20) {
      return new Response(JSON.stringify({ error: "symbol required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const forecast = await buildForecast(symbol.toUpperCase());
    if (!forecast) {
      return new Response(JSON.stringify({ error: "No data for symbol" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ forecast }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("stock-forecast error:", e);
    return new Response(JSON.stringify({ error: "Failed to build forecast" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});