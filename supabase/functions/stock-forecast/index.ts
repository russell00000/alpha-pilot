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

async function fetchPrices(sym: string, range = "5y"): Promise<number[]> {
  try {
    const r = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${sym}?interval=1d&range=${range}`,
      { headers: { "User-Agent": "Mozilla/5.0" } },
    );
    if (!r.ok) return [];
    const data = await r.json();
    const closes = data?.chart?.result?.[0]?.indicators?.quote?.[0]?.close ?? [];
    return (closes as Array<number | null>).filter(
      (c): c is number => typeof c === "number" && c > 0,
    );
  } catch {
    return [];
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
const volatility = (p: number[]) => {
  if (p.length < 30) return null;
  const r: number[] = [];
  for (let i = 1; i < p.length; i++) if (p[i - 1] > 0) r.push(Math.log(p[i] / p[i - 1]));
  const m = r.reduce((a, b) => a + b, 0) / r.length;
  const v = r.reduce((a, b) => a + (b - m) ** 2, 0) / r.length;
  return Math.sqrt(v) * Math.sqrt(252) * 100;
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

async function buildForecast(symbol: string) {
  const candidates = symbol.includes("-") ? [symbol] : [symbol, `${symbol}-USD`];
  for (const sym of candidates) {
    const prices = await fetchPrices(sym, "5y");
    if (prices.length < 30) continue;
    const cp = prices[prices.length - 1];

    const [summaryResp, newsResp] = await Promise.all([
      fetch(
        `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${sym}?modules=assetProfile,summaryDetail,defaultKeyStatistics,financialData,recommendationTrend,upgradeDowngradeHistory,price`,
        { headers: { "User-Agent": "Mozilla/5.0" } },
      ),
      fetch(
        `https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(sym)}&quotesCount=0&newsCount=3`,
        { headers: { "User-Agent": "Mozilla/5.0" } },
      ),
    ]);

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

    if (newsResp.ok) await newsResp.json().catch(() => null);

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
    const cagr3Y = cagr(prices, 3);
    const cagr5Y = cagr(prices, 5);
    const annualVol = volatility(prices);
    const ddVal = maxDD(prices);
    const sharpeVal = sharpe(prices);
    const rsiVal = rsi(prices);

    // Compute targets
    let base = targetMean ?? null;
    if (!base) {
      const c = cagr3Y ?? cagr5Y;
      base = c != null ? cp * (1 + c / 100) : cp * 1.08;
    }
    const momentum = ret(prices, 63) ?? 0;
    const trendBoost = trend.includes("STRONG UPTREND") ? 0.05 : trend.includes("DOWNTREND") ? -0.05 : 0;
    base = base * (1 + Math.max(-0.15, Math.min(0.15, (momentum / 100) * 0.3 + trendBoost)));
    const vol = annualVol ?? 25;
    const bull = targetHigh ?? base * (1 + vol / 100);
    const bear = targetLow ?? base * (1 - vol / 100);

    const aligned =
      (trend.includes("UPTREND") && (targetMean ?? cp) > cp) ||
      (trend.includes("DOWNTREND") && (targetMean ?? cp) < cp);
    const confidence =
      (numAnalysts ?? 0) >= 15 && aligned ? "High" : (numAnalysts ?? 0) >= 8 ? "Medium" : "Low";

    // Sector benchmark
    let sectorBenchmark;
    if (sector && SECTOR_ETF_MAP[sector]) {
      const benchSym = SECTOR_ETF_MAP[sector];
      const bp = await fetchPrices(benchSym, "2y");
      sectorBenchmark = { symbol: benchSym, return1Y: ret(bp, 252), return3M: ret(bp, 63) };
    }

    return {
      symbol: sym,
      name,
      currentPrice: cp,
      base: +base.toFixed(2),
      bull: +bull.toFixed(2),
      bear: +bear.toFixed(2),
      confidence,
      indicators: {
        return1Y, cagr3Y, cagr5Y, annualVol, maxDrawdown: ddVal,
        sharpe: sharpeVal, rsi14: rsiVal, trend, forwardPE,
        earningsGrowth, revenueGrowth, targetMean, numAnalysts,
        upgradesLast90d, downgradesLast90d, sector,
      },
      sectorBenchmark,
      recommendationMean,
      industry,
    };
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