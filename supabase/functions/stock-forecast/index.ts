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
    // Parallelize: prices (Yahoo chart) + fundamentals (Finnhub — Yahoo's
    // quoteSummary now returns 401 "Invalid Crumb" from edge runtimes, so we use
    // Finnhub for profile/metric/price-target/recommendation/upgrade-downgrade).
    const fhKey = Deno.env.get("FINNHUB_API_KEY") ?? "";
    const fh = async (path: string) => {
      if (!fhKey) return null;
      try {
        const r = await fetch(`https://finnhub.io/api/v1/${path}&token=${fhKey}`);
        if (!r.ok) return null;
        return await r.json();
      } catch {
        return null;
      }
    };
    const cutoffSec = Math.floor(Date.now() / 1000) - 90 * 86400;
    const fromIso = new Date(cutoffSec * 1000).toISOString().slice(0, 10);
    const toIso = new Date().toISOString().slice(0, 10);
    const [series, profile, metricResp, targetResp, recArr, udArr] = await Promise.all([
      fetchPriceSeries(sym, "2y"),
      fh(`stock/profile2?symbol=${sym}`),
      fh(`stock/metric?symbol=${sym}&metric=all`),
      fh(`stock/price-target?symbol=${sym}`),
      fh(`stock/recommendation?symbol=${sym}`),
      fh(`stock/upgrade-downgrade?symbol=${sym}&from=${fromIso}&to=${toIso}`),
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
    let beta: number | undefined, profitMargin: number | undefined, roe: number | undefined,
      debtToEquity: number | undefined, pegRatio: number | undefined, fcfYield: number | undefined,
      priceToBook: number | undefined, marketCap: number | undefined;

    const m = metricResp?.metric ?? {};
    const numv = (x: unknown): number | undefined =>
      typeof x === "number" && Number.isFinite(x) ? x : undefined;
    if (profile?.name) name = profile.name;
    if (profile?.finnhubIndustry) { sector = profile.finnhubIndustry; industry = profile.finnhubIndustry; }
    // Finnhub marketCapitalization is in millions USD.
    if (typeof profile?.marketCapitalization === "number") marketCap = profile.marketCapitalization * 1e6;

    const fpe = numv(m.peNormalizedAnnual) ?? numv(m.peExclExtraTTM) ?? numv(m.peTTM);
    if (fpe != null) forwardPE = `${fpe.toFixed(2)}`;
    const eg = numv(m.epsGrowthTTMYoy) ?? numv(m.epsGrowth5Y);
    if (eg != null) earningsGrowth = `${eg.toFixed(2)}%`;
    const rg = numv(m.revenueGrowthTTMYoy) ?? numv(m.revenueGrowth5Y);
    if (rg != null) revenueGrowth = `${rg.toFixed(2)}%`;
    beta = numv(m.beta);
    pegRatio = numv(m.pegRatio);
    priceToBook = numv(m.pbAnnual) ?? numv(m.pbQuarterly);
    // Finnhub margins/ROE come back as percentages already.
    profitMargin = numv(m.netProfitMarginTTM) ?? numv(m.netProfitMarginAnnual);
    roe = numv(m.roeTTM) ?? numv(m.roeRfy);
    debtToEquity = numv(m["totalDebt/totalEquityAnnual"]) ?? numv(m["longTermDebt/equityAnnual"]);
    const fcf = numv(m.freeCashFlowTTM) ?? numv(m.freeCashFlowAnnual);
    if (fcf != null && marketCap && marketCap > 0) fcfYield = (fcf / marketCap) * 100;

    targetMean = numv(targetResp?.targetMean);
    targetHigh = numv(targetResp?.targetHigh);
    targetLow = numv(targetResp?.targetLow);
    numAnalysts = numv(targetResp?.numberOfAnalysts);

    if (Array.isArray(recArr) && recArr.length > 0) {
      const rec = recArr[0];
      const total = (rec.strongBuy ?? 0) + (rec.buy ?? 0) + (rec.hold ?? 0) + (rec.sell ?? 0) + (rec.strongSell ?? 0);
      if (total > 0) {
        recommendationMean = (rec.strongBuy * 1 + rec.buy * 2 + rec.hold * 3 + rec.sell * 4 + rec.strongSell * 5) / total;
        if (numAnalysts == null) numAnalysts = total;
      }
    }
    if (Array.isArray(udArr)) {
      for (const h of udArr as Array<{ toGrade?: string; fromGrade?: string; action?: string }>) {
        const a = (h.action || "").toLowerCase();
        if (a === "up" || a === "upgrade") upgradesLast90d++;
        else if (a === "down" || a === "downgrade") downgradesLast90d++;
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

    // 7) Quality premium from fundamentals: high ROE, healthy margins, reasonable leverage,
    //    attractive FCF yield, and reasonable PEG add to drift expectation.
    let qualityAdj = 0, qualityCount = 0;
    if (roe != null)         { qualityAdj += Math.max(-3, Math.min(4, (roe - 12) / 5)); qualityCount++; }
    if (profitMargin != null){ qualityAdj += Math.max(-3, Math.min(3, (profitMargin - 10) / 5)); qualityCount++; }
    if (fcfYield != null)    { qualityAdj += Math.max(-2, Math.min(4, (fcfYield - 3) / 1.5)); qualityCount++; }
    if (debtToEquity != null){ qualityAdj += debtToEquity > 200 ? -3 : debtToEquity > 100 ? -1 : debtToEquity < 50 ? 1 : 0; qualityCount++; }
    if (pegRatio != null && pegRatio > 0) { qualityAdj += pegRatio < 1 ? 3 : pegRatio < 1.5 ? 1 : pegRatio < 2.5 ? 0 : -2; qualityCount++; }
    // 8) Valuation pull: cheap forward PE → tail boost, rich PE → drag.
    const fpeNum = parsePct(forwardPE);
    const valuationAdj = fpeNum == null ? 0 : fpeNum < 12 ? 3 : fpeNum < 18 ? 1 : fpeNum < 25 ? 0 : fpeNum < 35 ? -2 : -4;

    // Weights now favor fundamentals + analyst consensus + base rate.
    const signals: Array<{ value: number; w: number }> = [];
    if (analystImplied != null) signals.push({ value: analystImplied, w: 0.32 });
    signals.push({ value: baseRate, w: 0.20 });
    if (epsGrowth != null) signals.push({ value: Math.max(-30, Math.min(60, epsGrowth)), w: 0.18 });
    if (qualityCount > 0)  signals.push({ value: qualityAdj, w: 0.10 });
    signals.push({ value: valuationAdj, w: 0.08 });
    signals.push({ value: momentumAnn, w: 0.07 });
    signals.push({ value: regime + rsiAdj, w: 0.05 });
    const wSum = signals.reduce((a, s) => a + s.w, 0);
    let driftAnnPct = signals.reduce((a, s) => a + s.value * s.w, 0) / wSum;
    // Cap extremes — tighter, realistic 12-mo outcomes for ALL names.
    // Scale slightly by cap so micro/small caps can still move more, but no one moonshots.
    const mc = marketCap ?? 0;
    const sizeFactor = mc > 200e9 ? 0.85 : mc > 50e9 ? 0.95 : mc > 10e9 ? 1.05 : 1.15;
    const driftCapHi = 50 * sizeFactor;
    const driftCapLo = -35 * sizeFactor;
    driftAnnPct = Math.max(driftCapLo, Math.min(driftCapHi, driftAnnPct));

    // ---------- GBM-STYLE PROJECTION ----------
    // mu = annualized log drift; sigma = annualized log vol shrunk toward a long-run
    // equity prior so realized 12-mo bands aren't dominated by short-term noise.
    const mu = Math.log(1 + driftAnnPct / 100);
    const rawVol = annualVol ?? 25;
    // Long-run equity vol prior (~22%, scaled by beta when available, nudged by size).
    const sizeVolMult = mc > 200e9 ? 0.85 : mc > 50e9 ? 0.95 : mc > 10e9 ? 1.0 : 1.15;
    const volPrior = 22 * (beta != null && beta > 0 ? Math.max(0.5, Math.min(1.8, beta)) : 1) * sizeVolMult;
    // Heavier shrinkage toward the prior (65/35) — empirically tightens forecasts
    // for ALL names and avoids blow-out bands from transient vol spikes.
    const blendedVolPct = rawVol * 0.35 + volPrior * 0.65;
    const sigma = blendedVolPct / 100;
    // 1.04 sigma ≈ 70% confidence interval — tighter, higher-conviction band
    // than the previous 80% (1.28σ) range.
    const Z = 1.036;
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
    else if ((numAnalysts ?? 0) >= 5) confScore += 0.5;
    if (aligned) confScore += 1;
    if (epsAligned) confScore += 1;
    if (bandPct < 25) confScore += 2;
    else if (bandPct < 40) confScore += 1;
    else if (bandPct > 80) confScore -= 1;
    if (mc > 50e9) confScore += 1;           // big, liquid names = more predictable
    else if (mc > 10e9) confScore += 0.5;    // mid-caps still reasonably stable
    if (qualityCount >= 3) confScore += 1;   // we have enough fundamentals to anchor
    if (recommendationMean != null && recommendationMean <= 2.2) confScore += 0.5;
    const confidence = confScore >= 5 ? "High" : confScore >= 2.5 ? "Medium" : "Low";

    // Recent history slice (last ~6 months daily) for the chart.
    const HIST_DAYS = 126;
    const histStart = Math.max(0, prices.length - HIST_DAYS);
    const history = prices.slice(histStart).map((price, i) => ({
      date: timestamps[histStart + i] ?? nowSec,
      price: +price.toFixed(2),
    }));

    // Sector benchmark is nice-to-have — race it with a 600ms budget so it never blocks the response.
    const bp = await Promise.race<number[]>([
      benchPromise,
      new Promise<number[]>((resolve) => setTimeout(() => resolve([]), 600)),
    ]);
    const sectorBenchmark =
      benchSym && bp.length > 0
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
        beta, pegRatio, priceToBook,
        profitMargin: profitMargin == null ? null : +profitMargin.toFixed(1),
        roe: roe == null ? null : +roe.toFixed(1),
        debtToEquity: debtToEquity == null ? null : +debtToEquity.toFixed(1),
        fcfYield: fcfYield == null ? null : +fcfYield.toFixed(2),
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