// Finnhub proxy — keeps the API key server-side while serving quotes,
// fundamentals, crypto candles and index proxies to the client.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const KEY = Deno.env.get("FINNHUB_API_KEY") ?? "";
const BASE = "https://finnhub.io/api/v1";

// Cheap in-memory cache so bursty clients don't burn the rate limit.
const cache = new Map<string, { at: number; value: unknown }>();
const cached = async <T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> => {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < ttlMs) return hit.value as T;
  const value = await load();
  cache.set(key, { at: Date.now(), value });
  return value;
};

const getJson = async (url: string): Promise<any> => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`finnhub ${res.status}`);
  return await res.json();
};

// Run promises with limited concurrency (Finnhub free tier ~30 req/s).
const pool = async <T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> => {
  const out: R[] = [];
  for (let i = 0; i < items.length; i += limit) {
    out.push(...(await Promise.all(items.slice(i, i + limit).map(fn))));
  }
  return out;
};

const quote = (symbol: string) =>
  cached(`q:${symbol}`, 10_000, async () => {
    const q = await getJson(`${BASE}/quote?symbol=${encodeURIComponent(symbol)}&token=${KEY}`);
    if (typeof q?.c !== "number" || q.c === 0) return null;
    return {
      symbol,
      c: q.c,
      d: typeof q.d === "number" ? q.d : 0,
      dp: typeof q.dp === "number" ? q.dp : 0,
      h: q.h ?? null,
      l: q.l ?? null,
      o: q.o ?? null,
      pc: q.pc ?? null,
      t: q.t ?? null,
    };
  });

const COINGECKO_IDS: Record<string, string> = {
  AVAX: "avalanche-2",
  LINK: "chainlink",
  DOGE: "dogecoin",
  BTC: "bitcoin",
  ETH: "ethereum",
  SOL: "solana",
  XRP: "ripple",
  ADA: "cardano",
};

// Finnhub crypto candles require a paid plan, so CoinGecko backs up crypto.
const coingeckoQuote = async (symbol: string) => {
  const id = COINGECKO_IDS[symbol];
  if (!id) return null;
  const json = await getJson(
    `https://api.coingecko.com/api/v3/simple/price?ids=${id}&vs_currencies=usd&include_24hr_change=true`,
  );
  const entry = json?.[id];
  if (!entry || typeof entry.usd !== "number") return null;
  const c = entry.usd;
  const dp = typeof entry.usd_24h_change === "number" ? entry.usd_24h_change : 0;
  const pc = dp ? c / (1 + dp / 100) : c;
  return { symbol, c, d: c - pc, dp, h: null, l: null, o: pc, pc };
};

const cryptoQuote = (symbol: string) =>
  cached(`c:${symbol}`, 30_000, async () => {
    const pair = `BINANCE:${symbol}USDT`;
    const now = Math.floor(Date.now() / 1000);
    const from = now - 60 * 60 * 24 * 8;
    const candle = await getJson(
      `${BASE}/crypto/candle?symbol=${encodeURIComponent(pair)}&resolution=D&from=${from}&to=${now}&token=${KEY}`,
    ).catch(() => null);
    const closes: number[] = Array.isArray(candle?.c) ? candle.c : [];
    if (closes.length === 0) return await coingeckoQuote(symbol);
    const c = closes[closes.length - 1];
    const pc = closes.length > 1 ? closes[closes.length - 2] : c;
    return {
      symbol,
      c,
      d: c - pc,
      dp: pc ? ((c - pc) / pc) * 100 : 0,
      h: Array.isArray(candle?.h) ? candle.h[candle.h.length - 1] : null,
      l: Array.isArray(candle?.l) ? candle.l[candle.l.length - 1] : null,
      o: Array.isArray(candle?.o) ? candle.o[candle.o.length - 1] : null,
      pc,
      sparkline: closes.slice(-30),
    };
  });

const metric = (symbol: string) =>
  cached(`m:${symbol}`, 6 * 60 * 60_000, async () => {
    const [profile, metrics] = await Promise.all([
      getJson(`${BASE}/stock/profile2?symbol=${encodeURIComponent(symbol)}&token=${KEY}`).catch(() => null),
      getJson(`${BASE}/stock/metric?symbol=${encodeURIComponent(symbol)}&metric=all&token=${KEY}`).catch(() => null),
    ]);
    const m = metrics?.metric ?? {};
    return {
      symbol,
      // Finnhub reports market cap in millions.
      marketCap: typeof profile?.marketCapitalization === "number" ? profile.marketCapitalization * 1e6 : null,
      // 10-day average volume, in millions of shares.
      volume: typeof m["10DayAverageTradingVolume"] === "number" ? m["10DayAverageTradingVolume"] * 1e6 : null,
      industry: profile?.finnhubIndustry ?? null,
      name: profile?.name ?? null,
    };
  });

// Finnhub's free tier has no index coverage, so liquid ETFs stand in.
const INDEX_PROXIES = [
  { key: "SPX", label: "S&P 500", proxy: "SPY" },
  { key: "NDX", label: "NASDAQ", proxy: "QQQ" },
  { key: "DJI", label: "DOW JONES", proxy: "DIA" },
  { key: "VIX", label: "VIX", proxy: "VIXY" },
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    if (!KEY) throw new Error("FINNHUB_API_KEY is not configured");
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action ?? "quotes");
    const symbols: string[] = Array.isArray(body?.symbols)
      ? body.symbols.map((s: unknown) => String(s).toUpperCase()).filter(Boolean).slice(0, 60)
      : [];

    let data: unknown = [];

    if (action === "quotes") {
      data = (await pool(symbols, 12, (s) => quote(s).catch(() => null))).filter(Boolean);
    } else if (action === "crypto") {
      data = (await pool(symbols, 6, (s) => cryptoQuote(s).catch(() => null))).filter(Boolean);
    } else if (action === "metrics") {
      data = (await pool(symbols, 8, (s) => metric(s).catch(() => null))).filter(Boolean);
    } else if (action === "indices") {
      const quotes = await pool(INDEX_PROXIES, 4, async (i) => {
        const q = await quote(i.proxy).catch(() => null);
        return q ? { key: i.key, label: i.label, proxy: i.proxy, ...q } : null;
      });
      data = quotes.filter(Boolean);
    } else {
      throw new Error(`unknown action: ${action}`);
    }

    return new Response(JSON.stringify({ data }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("finnhub error:", error);
    return new Response(
      JSON.stringify({ data: [], error: error instanceof Error ? error.message : "unknown error" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
