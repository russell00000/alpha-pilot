import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { z } from "https://esm.sh/zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ----- In-memory caches (per edge instance) -----
const memCache = new Map<string, { ts: number; data: unknown }>();
function cacheGet<T>(key: string, ttlMs: number): T | null {
  const e = memCache.get(key);
  if (!e) return null;
  if (Date.now() - e.ts > ttlMs) { memCache.delete(key); return null; }
  return e.data as T;
}
function cacheSet(key: string, data: unknown) {
  memCache.set(key, { ts: Date.now(), data });
}

// Fetch the investing philosophy from the database
async function fetchPhilosophy(authHeader: string): Promise<string> {
  const cached = cacheGet<string>("philosophy", 10 * 60 * 1000);
  if (cached !== null) return cached;
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: philosophy, error } = await supabase
      .from("investing_philosophy")
      .select("*")
      .limit(1)
      .single();

    if (error || !philosophy) {
      console.log("Failed to fetch philosophy:", error);
      cacheSet("philosophy", "");
      return "";
    }

    const out = `
## INVESTING PHILOSOPHY
${philosophy.philosophy_text}

## RISK GUIDANCE
${philosophy.risk_guidance}

## COMMUNICATION STYLE
${philosophy.market_insights_style}
`;
    cacheSet("philosophy", out);
    return out;
  } catch (error) {
    console.error("Error fetching philosophy:", error);
    return "";
  }
}

// All securities - 250+ stocks covering all major sectors
const TOP_STOCKS = [
  // Mega Cap Tech
  'AAPL', 'MSFT', 'GOOGL', 'GOOG', 'AMZN', 'NVDA', 'META', 'TSLA', 'AVGO', 'ORCL',
  // Large Cap Tech
  'CRM', 'ADBE', 'CSCO', 'ACN', 'IBM', 'INTC', 'AMD', 'QCOM', 'TXN', 'NOW',
  'INTU', 'AMAT', 'MU', 'LRCX', 'SNPS', 'CDNS', 'KLAC', 'MRVL', 'ADI', 'NXPI',
  'MCHP', 'ON', 'SWKS', 'MPWR', 'FTNT', 'PANW', 'CRWD', 'ZS', 'OKTA', 'DDOG',
  // International Tech
  'ASML', 'TSM', 'SAP', 'SONY', 'BABA', 'JD', 'PDD', 'BIDU', 'NIO', 'LI', 'XPEV',
  // Growth Tech
  'ARM', 'PLTR', 'SNOW', 'NET', 'SHOP', 'SQ', 'COIN', 'HOOD', 'SOFI', 'AFRM',
  'RBLX', 'U', 'SNAP', 'PINS', 'SPOT', 'TTD', 'ROKU', 'ZM', 'DOCU', 'TWLO',
  // Consumer Tech
  'NFLX', 'DIS', 'WBD', 'PARA', 'CMCSA', 'CHTR', 'TMUS', 'VZ', 'T',
  // Rideshare & Delivery
  'UBER', 'LYFT', 'DASH', 'ABNB', 'BKNG', 'EXPE', 'MAR', 'HLT',
  // EV & Auto
  'RIVN', 'LCID', 'F', 'GM', 'TM', 'HMC', 'RACE',
  // Healthcare & Pharma
  'UNH', 'LLY', 'JNJ', 'MRK', 'ABBV', 'PFE', 'TMO', 'ABT', 'DHR', 'BMY',
  'AMGN', 'GILD', 'VRTX', 'REGN', 'MRNA', 'BIIB', 'ILMN', 'DXCM', 'ISRG', 'SYK',
  'MDT', 'BDX', 'ZBH', 'BSX', 'EW', 'ALGN', 'HOLX', 'IDXX', 'MTD', 'A',
  'CI', 'ELV', 'HUM', 'CVS', 'MCK', 'CAH', 'ABC', 'VEEV', 'ZTS', 'IQV',
  // Financials
  'BRK.B', 'JPM', 'V', 'MA', 'BAC', 'WFC', 'C', 'GS', 'MS', 'SCHW',
  'AXP', 'BLK', 'SPGI', 'CME', 'ICE', 'CB', 'MMC', 'AON', 'PGR', 'TRV',
  'MET', 'AIG', 'PRU', 'AFL', 'ALL', 'USB', 'PNC', 'TFC', 'COF', 'DFS',
  // Consumer Staples
  'PG', 'KO', 'PEP', 'COST', 'WMT', 'PM', 'MO', 'MDLZ', 'CL', 'KMB',
  'GIS', 'K', 'HSY', 'KHC', 'SJM', 'CPB', 'MKC', 'CHD', 'CLX', 'EL',
  // Consumer Discretionary
  'HD', 'MCD', 'NKE', 'SBUX', 'TJX', 'LOW', 'TGT', 'ROST', 'ORLY', 'AZO',
  'BBY', 'DG', 'DLTR', 'ULTA', 'LULU', 'GPS', 'ANF', 'VFC', 'PVH', 'RL',
  'CMG', 'DPZ', 'YUM', 'DARDEN', 'WEN', 'QSR',
  // Industrials
  'CAT', 'DE', 'HON', 'UNP', 'UPS', 'FDX', 'RTX', 'BA', 'LMT', 'NOC',
  'GD', 'GE', 'MMM', 'EMR', 'ITW', 'PH', 'ROK', 'ETN', 'JCI', 'CARR',
  'OTIS', 'TT', 'IR', 'CMI', 'PCAR', 'FAST', 'WM', 'RSG', 'VRSK', 'CPRT',
  // Energy
  'XOM', 'CVX', 'COP', 'EOG', 'SLB', 'MPC', 'PSX', 'VLO', 'OXY', 'DVN',
  'HES', 'FANG', 'PXD', 'HAL', 'BKR', 'KMI', 'WMB', 'OKE', 'EP', 'TRGP',
  // Utilities
  'NEE', 'DUK', 'SO', 'D', 'AEP', 'EXC', 'SRE', 'XEL', 'ED', 'WEC',
  'ES', 'AWK', 'DTE', 'PPL', 'FE', 'AES', 'NRG', 'EVRG', 'ATO', 'NI',
  // REITs
  'PLD', 'AMT', 'CCI', 'EQIX', 'PSA', 'O', 'WELL', 'DLR', 'SPG', 'VICI',
  'AVB', 'EQR', 'VTR', 'ARE', 'MAA', 'UDR', 'ESS', 'INVH', 'SUI', 'ELS',
  // Materials
  'LIN', 'APD', 'SHW', 'ECL', 'DD', 'NEM', 'FCX', 'DOW', 'NUE', 'STLD',
  'VMC', 'MLM', 'ALB', 'PPG', 'IFF', 'FMC', 'CE', 'EMN', 'CF', 'MOS',
  // Telecom
  'TMUS', 'VZ', 'T', 'LUMN', 'USM', 'SATS',
  // Additional Popular
  'PYPL', 'EBAY', 'ETSY', 'W', 'CHWY', 'PTON', 'GME', 'AMC', 'BBBY', 'BB',
  'SPCE', 'RKLB', 'LUNR', 'ASTS', 'IONQ', 'QUBT', 'RGTI', 'AI', 'UPST', 'PATH'
];

// 60+ ETFs covering all major categories
const TOP_ETFS = [
  // Major Index
  'SPY', 'QQQ', 'DIA', 'IWM', 'IWF', 'IWD', 'VTI', 'VOO', 'VTV', 'VUG',
  // Sector ETFs
  'XLK', 'XLF', 'XLE', 'XLV', 'XLI', 'XLY', 'XLP', 'XLB', 'XLU', 'XLRE',
  'VGT', 'VFH', 'VHT', 'VIS', 'VCR', 'VDC', 'VAW', 'VPU', 'VNQ',
  // Tech & Semiconductor
  'SOXX', 'SMH', 'IGV', 'SKYY', 'HACK', 'BOTZ', 'ROBO', 'ARKK', 'ARKW', 'ARKG',
  // Leveraged & Inverse
  'TQQQ', 'SQQQ', 'SPXL', 'SPXS', 'SOXL', 'SOXS', 'UPRO', 'SDOW', 'UVXY', 'VXX',
  // Fixed Income
  'BND', 'AGG', 'LQD', 'HYG', 'TLT', 'IEF', 'SHY', 'TIP', 'VCSH', 'VCIT',
  // International
  'EFA', 'VEA', 'VWO', 'EEM', 'IEFA', 'IEMG', 'VT', 'VXUS', 'FXI', 'EWJ',
  // Commodities
  'GLD', 'SLV', 'GDX', 'GDXJ', 'USO', 'UNG', 'DBA', 'DBC', 'PDBC', 'CPER',
  // Dividend
  'SCHD', 'VYM', 'DVY', 'VIG', 'SDY', 'NOBL', 'DGRO', 'DGRW', 'HDV', 'SPYD',
  // Thematic
  'ICLN', 'TAN', 'QCLN', 'LIT', 'DRIV', 'JETS', 'KWEB', 'MCHI', 'XBI', 'IBB'
];

// Mutual Funds
const MUTUAL_FUNDS = [
  'VFIAX', 'FXAIX', 'VTSAX', 'SWPPX', 'VBTLX', 'VXUS', 'FCNTX', 'FBALX', 'VWELX', 'VWINX',
  'VTMGX', 'VTIAX', 'VIGAX', 'VVIAX', 'VGSLX', 'VGHCX', 'VWUAX', 'VMVAX', 'VSMAX', 'VEMAX',
  'FSKAX', 'FSMAX', 'FSPSX', 'FEMKX', 'FXNAX', 'FBNDX', 'FTBFX', 'FXSTX', 'FSPTX', 'FSPHX'
];

// Crypto - Top 20 by market cap
const CRYPTO = [
  'BTC-USD', 'ETH-USD', 'BNB-USD', 'XRP-USD', 'SOL-USD', 'ADA-USD', 'DOGE-USD', 'TRX-USD',
  'TON11419-USD', 'LINK-USD', 'MATIC-USD', 'DOT-USD', 'LTC-USD', 'SHIB-USD', 'BCH-USD',
  'AVAX-USD', 'XLM-USD', 'UNI7083-USD', 'ATOM-USD', 'FIL-USD'
];

interface QuoteData {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  high52Week: number;
  low52Week: number;
  volume: number;
  marketCap: number;
}

// Extract potential ticker symbols from user messages
function extractTickers(messages: { role: string; content: string }[]): string[] {
  const lastUserMsg = [...messages].reverse().find(m => m.role === "user")?.content || "";
  // Match $TICKER notation and standalone uppercase words 2-5 chars
  const found: string[] = [];
  
  // First priority: explicit $TICKER mentions
  const dollarPattern = /\$([A-Z]{1,5})\b/gi;
  let match;
  while ((match = dollarPattern.exec(lastUserMsg)) !== null) {
    found.push(match[1].toUpperCase());
  }
  
  // Second: uppercase words that look like tickers (must be fully uppercase in original text)
  const wordPattern = /\b([A-Z]{2,5})\b/g;
  while ((match = wordPattern.exec(lastUserMsg)) !== null) {
    found.push(match[1]);
  }
  
  // Extensive skip list of common English words that could be mistaken for tickers
  const skipWords = new Set([
    "I", "A", "THE", "AND", "OR", "FOR", "IN", "ON", "AT", "TO", "IS", "IT", "OF", "MY", "ME",
    "DO", "IF", "SO", "UP", "AN", "AS", "BY", "WE", "HE", "BE", "NO", "AM", "US", "GO", "HI",
    "OK", "BUY", "SELL", "HOLD", "ANY", "ALL", "CAN", "HAS", "HOW", "WHY", "NOT", "BUT", "ARE",
    "WAS", "HAS", "ITS", "YOU", "YOUR", "WHAT", "BEST", "GOOD", "LIKE", "THINK", "ABOUT",
    "WOULD", "SHOULD", "PRICE", "STOCK", "TODAY", "WITH", "FROM", "THAT", "THIS", "THAN",
    "HAVE", "BEEN", "WILL", "WHEN", "THEN", "THEM", "THEY", "THEIR", "ALSO", "JUST", "MORE",
    "SOME", "INTO", "OVER", "SUCH", "TAKE", "ONLY", "COME", "MADE", "FIND", "BACK", "MUCH",
    "GOING", "WELL", "EVEN", "HERE", "GIVE", "MOST", "TELL", "DOES", "WANT", "BEEN", "LOOK",
    "VERY", "MAKE", "LIKE", "LONG", "KNOW", "NEXT", "USED", "WORK", "CALL", "EACH", "HIGH",
    "SAID", "HELP", "LINE", "TURN", "MOVE", "LIVE", "REAL", "LEFT", "SAME", "KEEP", "NEED",
    "STILL", "YEAR", "LAST", "NEWS", "RATE", "DOWN", "WENT", "NEAR", "FUND", "DEAR",
    "YES", "ETF", "IPO", "GDP", "CEO", "CFO", "COO", "CTO", "SEC", "FED", "USA", "NYSE",
    "NINGS", "EARN", "LOSS", "GAIN", "DROP", "RISE", "FALL", "MANY", "MUCH", "WERE", "WHAT",
    "FREE", "OPEN", "CLOSE", "BULL", "BEAR", "PUTS", "GETS", "RISK", "SAFE", "PLAN", "SAVE",
    "INFO", "DATA", "SHOW", "SEES", "PAYS", "OWNS", "RUNS", "WINS", "LOST", "SOLD", "GREW",
    "READ", "PICK", "SURE", "PART", "PLAY", "SENT", "COST", "CASH", "DEBT", "LOAN"
  ]);
  
  return [...new Set(found)].filter(t => !skipWords.has(t) && t.length >= 2);
}

// On-demand lookup for tickers not in our pre-fetched set
async function fetchOnDemandQuotes(tickers: string[], existingSymbols: Set<string>): Promise<string> {
  // Fetch live data for every requested ticker — even if it's in the pre-fetched
  // set — so the model always sees fresh, deep info (profile, sector, etc.) for
  // anything the user explicitly asks about.
  const missing = tickers;
  if (missing.length === 0) return "";
  
  console.log("On-demand lookup for tickers:", missing);
  
  const results: string[] = [];
  const seen = new Set<string>();
  for (const ticker of missing.slice(0, 8)) {
    if (seen.has(ticker)) continue;
    seen.add(ticker);
    const detail = await fetchTickerDetail(ticker);
    if (detail) results.push(detail);
  }
  
  if (results.length === 0) return "";
  return `\n\nON-DEMAND LOOKUPS (real-time data for requested tickers):\n${results.join('\n\n')}\n`;
}

// Map a sector name to a representative sector ETF for benchmark comparisons.
const SECTOR_ETF_MAP: Record<string, string> = {
  "Technology": "XLK",
  "Financial Services": "XLF",
  "Financial": "XLF",
  "Healthcare": "XLV",
  "Consumer Cyclical": "XLY",
  "Consumer Defensive": "XLP",
  "Energy": "XLE",
  "Industrials": "XLI",
  "Basic Materials": "XLB",
  "Utilities": "XLU",
  "Real Estate": "XLRE",
  "Communication Services": "XLC",
};

interface ForecastStats {
  symbol: string;
  name: string;
  currentPrice: number;
  return1M: number | null;
  return3M: number | null;
  return6M: number | null;
  return1Y: number | null;
  cagr3Y: number | null;
  cagr5Y: number | null;
  annualVol: number | null;
  maxDrawdown: number | null;
  sharpe: number | null;
  sma50: number | null;
  sma200: number | null;
  rsi14: number | null;
  trend: string;
  sector?: string;
  industry?: string;
  forwardPE?: string;
  pegRatio?: string;
  earningsGrowth?: string;
  revenueGrowth?: string;
  recommendationMean?: number;
  targetMean?: number;
  targetHigh?: number;
  targetLow?: number;
  numAnalysts?: number;
  upgradesLast90d?: number;
  downgradesLast90d?: number;
  earningsTrendNextQ?: string;
  earningsTrendNextY?: string;
  sectorBenchmark?: { symbol: string; return1Y: number | null; return3M: number | null };
  headlines: string[];
}

function calcReturn(prices: number[], lookbackDays: number): number | null {
  if (prices.length < lookbackDays + 1) return null;
  const recent = prices[prices.length - 1];
  const past = prices[prices.length - 1 - lookbackDays];
  if (!recent || !past) return null;
  return ((recent - past) / past) * 100;
}

function calcCAGR(prices: number[], years: number): number | null {
  const need = Math.round(252 * years);
  if (prices.length < need + 1) return null;
  const end = prices[prices.length - 1];
  const start = prices[prices.length - 1 - need];
  if (!start || !end) return null;
  return (Math.pow(end / start, 1 / years) - 1) * 100;
}

function calcVolatility(prices: number[]): number | null {
  if (prices.length < 30) return null;
  const rets: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    if (prices[i - 1] > 0) rets.push(Math.log(prices[i] / prices[i - 1]));
  }
  const mean = rets.reduce((a, b) => a + b, 0) / rets.length;
  const variance = rets.reduce((a, b) => a + (b - mean) ** 2, 0) / rets.length;
  return Math.sqrt(variance) * Math.sqrt(252) * 100;
}

function calcMaxDrawdown(prices: number[]): number | null {
  if (prices.length < 30) return null;
  let peak = prices[0];
  let maxDD = 0;
  for (const p of prices) {
    if (p > peak) peak = p;
    const dd = (p - peak) / peak;
    if (dd < maxDD) maxDD = dd;
  }
  return maxDD * 100;
}

function calcSMA(prices: number[], window: number): number | null {
  if (prices.length < window) return null;
  const slice = prices.slice(-window);
  return slice.reduce((a, b) => a + b, 0) / window;
}

function calcRSI(prices: number[], period = 14): number | null {
  if (prices.length < period + 1) return null;
  let gains = 0, losses = 0;
  for (let i = prices.length - period; i < prices.length; i++) {
    const diff = prices[i] - prices[i - 1];
    if (diff >= 0) gains += diff; else losses -= diff;
  }
  const avgG = gains / period;
  const avgL = losses / period;
  if (avgL === 0) return 100;
  const rs = avgG / avgL;
  return 100 - 100 / (1 + rs);
}

function calcSharpe(prices: number[], rf = 0.045): number | null {
  if (prices.length < 60) return null;
  const rets: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    if (prices[i - 1] > 0) rets.push((prices[i] - prices[i - 1]) / prices[i - 1]);
  }
  const mean = rets.reduce((a, b) => a + b, 0) / rets.length;
  const variance = rets.reduce((a, b) => a + (b - mean) ** 2, 0) / rets.length;
  const sd = Math.sqrt(variance);
  if (sd === 0) return null;
  return ((mean * 252) - rf) / (sd * Math.sqrt(252));
}

async function fetchPrices(sym: string, range = "5y"): Promise<number[]> {
  try {
    const r = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${sym}?interval=1d&range=${range}`,
      { headers: { 'User-Agent': 'Mozilla/5.0' } },
    );
    if (!r.ok) return [];
    const data = await r.json();
    const closes = data?.chart?.result?.[0]?.indicators?.quote?.[0]?.close ?? [];
    return (closes as Array<number | null>).filter((c): c is number => typeof c === 'number' && c > 0);
  } catch {
    return [];
  }
}

async function fetchForecastStats(ticker: string): Promise<ForecastStats | null> {
  const cached = cacheGet<ForecastStats | null>(`forecast:${ticker}`, 10 * 60 * 1000);
  if (cached !== null && cached !== undefined) return cached;
  const candidates = ticker.includes('-') ? [ticker] : [ticker, `${ticker}-USD`];
  for (const sym of candidates) {
    try {
      const prices = await fetchPrices(sym, "2y");
      if (prices.length < 30) continue;
      const currentPrice = prices[prices.length - 1];

      // Pull fundamentals + analyst data + news in parallel
      const [summaryResp, newsResp] = await Promise.all([
        fetch(
          `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${sym}?modules=assetProfile,summaryDetail,defaultKeyStatistics,financialData,recommendationTrend,earningsTrend,upgradeDowngradeHistory,price`,
          { headers: { 'User-Agent': 'Mozilla/5.0' } },
        ),
        fetch(
          `https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(sym)}&quotesCount=0&newsCount=5`,
          { headers: { 'User-Agent': 'Mozilla/5.0' } },
        ),
      ]);

      let sector: string | undefined;
      let industry: string | undefined;
      let name = sym;
      let forwardPE: string | undefined;
      let pegRatio: string | undefined;
      let earningsGrowth: string | undefined;
      let revenueGrowth: string | undefined;
      let recommendationMean: number | undefined;
      let targetMean: number | undefined;
      let targetHigh: number | undefined;
      let targetLow: number | undefined;
      let numAnalysts: number | undefined;
      let upgradesLast90d = 0;
      let downgradesLast90d = 0;
      let earningsTrendNextQ: string | undefined;
      let earningsTrendNextY: string | undefined;

      if (summaryResp.ok) {
        const sd = await summaryResp.json();
        const r0 = sd?.quoteSummary?.result?.[0];
        const ap = r0?.assetProfile;
        const ks = r0?.defaultKeyStatistics;
        const fd = r0?.financialData;
        const pr = r0?.price;
        const rt = r0?.recommendationTrend?.trend ?? [];
        const et = r0?.earningsTrend?.trend ?? [];
        const udh = r0?.upgradeDowngradeHistory?.history ?? [];
        if (ap?.sector) sector = ap.sector;
        if (ap?.industry) industry = ap.industry;
        if (pr?.shortName || pr?.longName) name = pr.shortName || pr.longName;
        if (ks?.forwardPE?.fmt) forwardPE = ks.forwardPE.fmt;
        if (ks?.pegRatio?.fmt) pegRatio = ks.pegRatio.fmt;
        if (fd?.earningsGrowth?.fmt) earningsGrowth = fd.earningsGrowth.fmt;
        if (fd?.revenueGrowth?.fmt) revenueGrowth = fd.revenueGrowth.fmt;
        if (typeof fd?.recommendationMean?.raw === 'number') recommendationMean = fd.recommendationMean.raw;
        if (typeof fd?.targetMeanPrice?.raw === 'number') targetMean = fd.targetMeanPrice.raw;
        if (typeof fd?.targetHighPrice?.raw === 'number') targetHigh = fd.targetHighPrice.raw;
        if (typeof fd?.targetLowPrice?.raw === 'number') targetLow = fd.targetLowPrice.raw;
        if (typeof fd?.numberOfAnalystOpinions?.raw === 'number') numAnalysts = fd.numberOfAnalystOpinions.raw;
        // Earnings growth estimates
        const nextQ = et.find((t: { period?: string }) => t?.period === '+1q');
        const nextY = et.find((t: { period?: string }) => t?.period === '+1y');
        if (nextQ?.earningsEstimate?.growth?.fmt) earningsTrendNextQ = nextQ.earningsEstimate.growth.fmt;
        if (nextY?.earningsEstimate?.growth?.fmt) earningsTrendNextY = nextY.earningsEstimate.growth.fmt;
        // Upgrades/downgrades in last 90 days
        const cutoff = Math.floor(Date.now() / 1000) - 90 * 86400;
        for (const h of udh as Array<{ epochGradeDate?: number; action?: string }>) {
          if (!h.epochGradeDate || h.epochGradeDate < cutoff) continue;
          if (h.action === 'up') upgradesLast90d++;
          else if (h.action === 'down') downgradesLast90d++;
        }
      }

      const headlines: string[] = [];
      if (newsResp.ok) {
        const nd = await newsResp.json();
        const items = (nd?.news ?? []).slice(0, 5) as Array<{ title?: string; publisher?: string }>;
          for (const n of items) if (n.title) headlines.push(`${n.title} (${n.publisher ?? 'src'})`);
      }

      // Sector benchmark
      let sectorBenchmark: ForecastStats['sectorBenchmark'];
      if (sector && SECTOR_ETF_MAP[sector]) {
        const benchSym = SECTOR_ETF_MAP[sector];
        const benchPrices = await fetchPrices(benchSym, "2y");
        sectorBenchmark = {
          symbol: benchSym,
          return1Y: calcReturn(benchPrices, 252),
          return3M: calcReturn(benchPrices, 63),
        };
      }

      const sma50 = calcSMA(prices, 50);
      const sma200 = calcSMA(prices, 200);
      const trend =
        sma50 && sma200
          ? currentPrice > sma50 && sma50 > sma200
            ? "STRONG UPTREND (golden cross territory)"
            : currentPrice < sma50 && sma50 < sma200
              ? "DOWNTREND (death cross territory)"
              : currentPrice > sma200
                ? "ABOVE LONG-TERM TREND"
                : "BELOW LONG-TERM TREND"
          : "INSUFFICIENT HISTORY";

      const result: ForecastStats = {
        symbol: sym,
        name,
        currentPrice,
        return1M: calcReturn(prices, 21),
        return3M: calcReturn(prices, 63),
        return6M: calcReturn(prices, 126),
        return1Y: calcReturn(prices, 252),
        cagr3Y: calcCAGR(prices, 3),
        cagr5Y: calcCAGR(prices, 5),
        annualVol: calcVolatility(prices),
        maxDrawdown: calcMaxDrawdown(prices),
        sharpe: calcSharpe(prices),
        sma50,
        sma200,
        rsi14: calcRSI(prices),
        trend,
        sector,
        industry,
        forwardPE,
        pegRatio,
        earningsGrowth,
        revenueGrowth,
        recommendationMean,
        targetMean,
        targetHigh,
        targetLow,
        numAnalysts,
        upgradesLast90d,
        downgradesLast90d,
        earningsTrendNextQ,
        earningsTrendNextY,
        sectorBenchmark,
        headlines,
      };
      cacheSet(`forecast:${ticker}`, result);
      return result;
    } catch (e) {
      console.log(`fetchForecastStats failed for ${sym}:`, e);
    }
  }
  return null;
}

function formatForecast(f: ForecastStats): string {
  const pct = (v: number | null | undefined, d = 1) =>
    v == null || !isFinite(v) ? 'N/A' : `${v >= 0 ? '+' : ''}${v.toFixed(d)}%`;
  const num = (v: number | null | undefined, d = 2) =>
    v == null || !isFinite(v) ? 'N/A' : v.toFixed(d);
  const recLabel = (r?: number) => {
    if (r == null) return 'N/A';
    if (r < 1.5) return `Strong Buy (${r.toFixed(2)})`;
    if (r < 2.5) return `Buy (${r.toFixed(2)})`;
    if (r < 3.5) return `Hold (${r.toFixed(2)})`;
    if (r < 4.5) return `Underperform (${r.toFixed(2)})`;
    return `Sell (${r.toFixed(2)})`;
  };
  const impliedUpside =
    f.targetMean && f.currentPrice
      ? ((f.targetMean - f.currentPrice) / f.currentPrice) * 100
      : null;

  const lines: string[] = [];
  lines.push(`■ ${f.symbol} — ${f.name} @ $${f.currentPrice.toFixed(2)}`);
  if (f.sector) lines.push(`  Sector/Industry: ${f.sector}${f.industry ? ' / ' + f.industry : ''}`);
  lines.push(`  Historical returns: 1M ${pct(f.return1M)} | 3M ${pct(f.return3M)} | 6M ${pct(f.return6M)} | 1Y ${pct(f.return1Y)} | 3Y CAGR ${pct(f.cagr3Y)} | 5Y CAGR ${pct(f.cagr5Y)}`);
  lines.push(`  Risk: Annualized vol ${pct(f.annualVol)} | Max DD ${pct(f.maxDrawdown)} | Sharpe ${num(f.sharpe, 2)}`);
  lines.push(`  Trend: ${f.trend} | SMA50 $${num(f.sma50)} | SMA200 $${num(f.sma200)} | RSI14 ${num(f.rsi14, 1)}`);
  const valParts: string[] = [];
  if (f.forwardPE) valParts.push(`Fwd P/E ${f.forwardPE}`);
  if (f.pegRatio) valParts.push(`PEG ${f.pegRatio}`);
  if (f.earningsGrowth) valParts.push(`EPS growth ${f.earningsGrowth}`);
  if (f.revenueGrowth) valParts.push(`Rev growth ${f.revenueGrowth}`);
  if (valParts.length) lines.push(`  Fundamentals: ${valParts.join(' • ')}`);
  const fwdParts: string[] = [];
  if (f.earningsTrendNextQ) fwdParts.push(`Next Q EPS est ${f.earningsTrendNextQ}`);
  if (f.earningsTrendNextY) fwdParts.push(`Next Y EPS est ${f.earningsTrendNextY}`);
  if (fwdParts.length) lines.push(`  Forward outlook: ${fwdParts.join(' • ')}`);
  if (f.numAnalysts) {
    lines.push(
      `  Analyst consensus (${f.numAnalysts} analysts): ${recLabel(f.recommendationMean)} | Target $${num(f.targetMean)} (low $${num(f.targetLow)} / high $${num(f.targetHigh)})${impliedUpside != null ? ` → implied ${pct(impliedUpside)}` : ''}`,
    );
  }
  lines.push(`  Recent rating actions (90d): ${f.upgradesLast90d} upgrades, ${f.downgradesLast90d} downgrades`);
  if (f.sectorBenchmark) {
    lines.push(`  Sector benchmark ${f.sectorBenchmark.symbol}: 3M ${pct(f.sectorBenchmark.return3M)} | 1Y ${pct(f.sectorBenchmark.return1Y)}`);
  }
  if (f.headlines.length) {
    lines.push(`  Industry signals (headlines):`);
    for (const h of f.headlines.slice(0, 3)) lines.push(`    - ${h}`);
  }
  return lines.join('\n');
}

// Resolve a free-text query (company name or symbol) to Yahoo Finance tickers.
async function resolveSymbols(query: string): Promise<string[]> {
  try {
    const url = `https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=5&newsCount=0`;
    const r = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
    });
    if (!r.ok) return [];
    const data = await r.json();
    const quotes = (data?.quotes ?? []) as Array<{ symbol?: string; quoteType?: string }>;
    return quotes
      .filter(q => q.symbol && ['EQUITY', 'ETF', 'MUTUALFUND', 'CRYPTOCURRENCY', 'INDEX'].includes(q.quoteType || ''))
      .map(q => q.symbol as string);
  } catch (e) {
    console.log('resolveSymbols failed:', e);
    return [];
  }
}

// Rich detail for a single ticker: live quote + company profile + recent news headline.
async function fetchTickerDetail(ticker: string): Promise<string | null> {
  const cached = cacheGet<string | null>(`detail:${ticker}`, 5 * 60 * 1000);
  if (cached !== undefined && cached !== null) return cached;
  const candidates = ticker.includes('-') ? [ticker] : [ticker, `${ticker}-USD`];
  for (const sym of candidates) {
    try {
      const chartResp = await fetch(
        `https://query1.finance.yahoo.com/v8/finance/chart/${sym}?interval=1d&range=1mo`,
        { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' } },
      );
      if (!chartResp.ok) continue;
      const chartData = await chartResp.json();
      const result = chartData.chart?.result?.[0];
      if (!result) continue;
      const meta = result.meta;
      const price = meta.regularMarketPrice || meta.previousClose;
      if (!price) continue;
      const previousClose = meta.chartPreviousClose || meta.previousClose;
      const change = price - previousClose;
      const changePercent = previousClose ? (change / previousClose) * 100 : 0;
      const changeStr = changePercent >= 0 ? `+${changePercent.toFixed(2)}%` : `${changePercent.toFixed(2)}%`;
      const distFromHigh = meta.fiftyTwoWeekHigh ? ((price - meta.fiftyTwoWeekHigh) / meta.fiftyTwoWeekHigh * 100).toFixed(1) : 'N/A';

      // Pull profile + key stats in parallel (best-effort; failures don't block)
      let profileLine = '';
      let newsLine = '';
      try {
        const [summaryResp, newsResp] = await Promise.all([
          fetch(
            `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${sym}?modules=assetProfile,summaryDetail,defaultKeyStatistics,financialData`,
            { headers: { 'User-Agent': 'Mozilla/5.0' } },
          ),
          fetch(
            `https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(sym)}&quotesCount=0&newsCount=3`,
            { headers: { 'User-Agent': 'Mozilla/5.0' } },
          ),
        ]);
        if (summaryResp.ok) {
          const sd = await summaryResp.json();
          const r0 = sd?.quoteSummary?.result?.[0];
          const ap = r0?.assetProfile;
          const sm = r0?.summaryDetail;
          const ks = r0?.defaultKeyStatistics;
          const fd = r0?.financialData;
          const parts: string[] = [];
          if (ap?.sector) parts.push(`Sector: ${ap.sector}`);
          if (ap?.industry) parts.push(`Industry: ${ap.industry}`);
          if (ap?.country) parts.push(`HQ: ${ap.country}`);
          if (sm?.marketCap?.fmt) parts.push(`Mkt Cap: ${sm.marketCap.fmt}`);
          if (sm?.trailingPE?.fmt) parts.push(`P/E: ${sm.trailingPE.fmt}`);
          if (ks?.forwardPE?.fmt) parts.push(`Fwd P/E: ${ks.forwardPE.fmt}`);
          if (sm?.dividendYield?.fmt) parts.push(`Div Yield: ${sm.dividendYield.fmt}`);
          if (fd?.recommendationKey) parts.push(`Street: ${fd.recommendationKey}`);
          if (fd?.targetMeanPrice?.fmt) parts.push(`Analyst Target: ${fd.targetMeanPrice.fmt}`);
          if (parts.length) profileLine = `\n  ${parts.join(' • ')}`;
          if (ap?.longBusinessSummary) {
            const summary = String(ap.longBusinessSummary).slice(0, 320).replace(/\s+/g, ' ');
            profileLine += `\n  About: ${summary}${ap.longBusinessSummary.length > 320 ? '…' : ''}`;
          }
        }
        if (newsResp.ok) {
          const nd = await newsResp.json();
          const items = (nd?.news ?? []).slice(0, 3) as Array<{ title?: string; publisher?: string; providerPublishTime?: number }>;
          if (items.length) {
            const headlines = items
              .filter(n => n.title)
              .map(n => `    - "${n.title}" (${n.publisher ?? 'source'})`)
              .join('\n');
            if (headlines) newsLine = `\n  Recent headlines:\n${headlines}`;
          }
        }
      } catch (e) {
        console.log('detail enrichment failed:', e);
      }

      const out = `${sym} (${meta.shortName || meta.longName || sym}): $${price.toFixed(2)} ${changeStr}, 52W High: $${meta.fiftyTwoWeekHigh?.toFixed(2) || 'N/A'} (${distFromHigh}% from high), 52W Low: $${meta.fiftyTwoWeekLow?.toFixed(2) || 'N/A'}, Vol: ${meta.regularMarketVolume?.toLocaleString() || 'N/A'}${profileLine}${newsLine}`;
      cacheSet(`detail:${ticker}`, out);
      return out;
    } catch (e) {
      console.log(`fetchTickerDetail failed for ${sym}:`, e);
    }
  }
  return null;
}

// Fetch detailed quote data from Yahoo Finance
async function fetchQuote(symbol: string): Promise<QuoteData | null> {
  try {
    const response = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=5d`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      }
    );
    
    if (!response.ok) return null;
    
    const data = await response.json();
    const result = data.chart?.result?.[0];
    if (!result) return null;
    
    const meta = result.meta;
    const price = meta.regularMarketPrice || meta.previousClose;
    const previousClose = meta.chartPreviousClose || meta.previousClose;
    const change = price - previousClose;
    const changePercent = previousClose ? (change / previousClose) * 100 : 0;
    
    return {
      symbol,
      name: meta.shortName || meta.longName || symbol,
      price,
      change,
      changePercent,
      high52Week: meta.fiftyTwoWeekHigh || 0,
      low52Week: meta.fiftyTwoWeekLow || 0,
      volume: meta.regularMarketVolume || 0,
      marketCap: meta.marketCap || 0
    };
  } catch (e) {
    console.log(`Failed to fetch ${symbol}:`, e);
    return null;
  }
}

// Fetch real-time market data for all platform securities
async function fetchMarketData(): Promise<string> {
  // Only fetch a small set of macro benchmarks — quoting 400+ tickers per chat
  // request was the dominant latency. Specific tickers the user asks about
  // still get a live on-demand fetch later in the pipeline.
  const cached = cacheGet<string>("marketSummary", 60 * 1000);
  if (cached !== null) return cached;

  const BENCHMARKS = ["SPY", "QQQ", "DIA", "IWM", "GLD", "TLT", "BTC-USD", "ETH-USD"];
  try {
    const results = await Promise.all(BENCHMARKS.map(fetchQuote));
    const quotes = results.filter((q): q is QuoteData => q !== null);
    if (quotes.length === 0) { cacheSet("marketSummary", ""); return ""; }

    const fmt = (q: QuoteData) => {
      const c = q.changePercent >= 0 ? `+${q.changePercent.toFixed(2)}%` : `${q.changePercent.toFixed(2)}%`;
      return `${q.symbol} (${q.name}): $${q.price.toFixed(2)} ${c}`;
    };
    const out =
      `\n\n=== MARKET SUMMARY (${new Date().toISOString()}) ===\n` +
      quotes.map(fmt).join("\n") + "\n";
    cacheSet("marketSummary", out);
    return out;
  } catch (e) {
    console.error("Error fetching market summary:", e);
    return "";
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      console.error("LOVABLE_API_KEY is not configured");
      return new Response(JSON.stringify({ error: "Service temporarily unavailable" }), {
        status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Chat is public — no auth required. The function does not read user-specific data.
    const authHeader = req.headers.get("Authorization") ?? "";

    // Validate input
    const MessageSchema = z.object({
      role: z.enum(["user", "assistant", "system"]),
      content: z.string().min(1).max(8000),
    });
    const RequestSchema = z.object({
      messages: z.array(MessageSchema).min(1).max(50),
    });
    let rawBody: unknown;
    try { rawBody = await req.json(); } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const parsed = RequestSchema.safeParse(rawBody);
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: "Invalid request format" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { messages } = parsed.data;

    console.log("Processing chat request with", messages.length, "messages");

    // Extract tickers from user message for on-demand lookup
    const requestedTickers = extractTickers(messages);
    console.log("Detected tickers in message:", requestedTickers);

    // Only do the slower free-text name → symbol resolution when we couldn't
    // pull any tickers out of the user message directly. Saves ~300-800ms.
    const lastUserMsg = [...messages].reverse().find(m => m.role === "user")?.content || "";
    let resolvedFromName: string[] = [];
    if (requestedTickers.length === 0 && lastUserMsg.trim().length > 0) {
      const nameQuery = lastUserMsg.replace(/\$[A-Za-z]{1,6}/g, "").trim().slice(0, 120);
      if (nameQuery.length >= 3) {
        resolvedFromName = await resolveSymbols(nameQuery);
        console.log("Resolved from name:", resolvedFromName);
      }
    }
    const allRequested = Array.from(new Set([...requestedTickers, ...resolvedFromName.slice(0, 2)]));

    // Fetch philosophy and market data in parallel
    const [philosophy, marketData] = await Promise.all([
      fetchPhilosophy(authHeader),
      fetchMarketData()
    ]);
    console.log("Fetched philosophy:", philosophy ? "success" : "none");
    console.log("Fetched market data:", marketData ? "success" : "none");

    // Build set of symbols we already have data for
    const allKnownSymbols = new Set([...TOP_STOCKS, ...TOP_ETFS, ...MUTUAL_FUNDS, ...CRYPTO]);
    
    // Fetch on-demand data for any tickers not in our pre-fetched set
    const onDemandData = await fetchOnDemandQuotes(allRequested, allKnownSymbols);
    if (onDemandData) {
      console.log("On-demand data fetched successfully");
    }

    // Fetch deep forecasting stats for the (up to 4) tickers the user is asking about.
    // This powers data-driven performance predictions (returns, vol, drawdown, momentum,
    // analyst targets, forward EPS estimates, sector benchmark, news signals).
    let forecastBlock = "";
    const forecastPayload: Array<Record<string, unknown>> = [];
    const forecastTickers = allRequested.slice(0, 2);
    if (forecastTickers.length > 0) {
      const forecasts = await Promise.all(forecastTickers.map(fetchForecastStats));
      const valid = forecasts.filter((f): f is ForecastStats => !!f);
      const formatted = valid.map(formatForecast);
      if (formatted.length > 0) {
        forecastBlock = `\n\n=== PERFORMANCE FORECAST INPUTS (computed from 5Y daily history + analyst data) ===\n\n${formatted.join('\n\n')}\n`;
      }
      // Build structured payload for the client chart.
      for (const f of valid) {
        const cp = f.currentPrice;
        // Base case: analyst mean if available, else CAGR-projected, else +8%.
        let base = f.targetMean ?? null;
        if (!base) {
          const cagr = f.cagr3Y ?? f.cagr5Y;
          base = cagr != null ? cp * (1 + cagr / 100) : cp * 1.08;
        }
        // Adjust base ± based on momentum/trend confirmation.
        const momentum = f.return3M ?? 0;
        const trendBoost = f.trend.includes('STRONG UPTREND') ? 0.05 : f.trend.includes('DOWNTREND') ? -0.05 : 0;
        base = base * (1 + Math.max(-0.15, Math.min(0.15, momentum / 100 * 0.3 + trendBoost)));
        // Bull/bear from analyst high/low; widen with vol if missing.
        const vol = f.annualVol ?? 25;
        const bull = f.targetHigh ?? base * (1 + vol / 100);
        const bear = f.targetLow ?? base * (1 - vol / 100);
        // Confidence: high if many analysts AND aligned trend + positive EPS growth.
        const analysts = f.numAnalysts ?? 0;
        const aligned =
          (f.trend.includes('UPTREND') && (f.targetMean ?? cp) > cp) ||
          (f.trend.includes('DOWNTREND') && (f.targetMean ?? cp) < cp);
        const confidence = analysts >= 15 && aligned ? 'High' : analysts >= 8 ? 'Medium' : 'Low';
        forecastPayload.push({
          symbol: f.symbol,
          name: f.name,
          currentPrice: cp,
          base: Number(base.toFixed(2)),
          bull: Number(bull.toFixed(2)),
          bear: Number(bear.toFixed(2)),
          confidence,
          indicators: {
            return1Y: f.return1Y,
            cagr3Y: f.cagr3Y,
            cagr5Y: f.cagr5Y,
            annualVol: f.annualVol,
            maxDrawdown: f.maxDrawdown,
            sharpe: f.sharpe,
            rsi14: f.rsi14,
            trend: f.trend,
            forwardPE: f.forwardPE,
            earningsGrowth: f.earningsGrowth,
            revenueGrowth: f.revenueGrowth,
            targetMean: f.targetMean,
            numAnalysts: f.numAnalysts,
            upgradesLast90d: f.upgradesLast90d,
            downgradesLast90d: f.downgradesLast90d,
            sector: f.sector,
          },
        });
      }
      console.log(`Built forecast block for ${formatted.length} ticker(s)`);
    }

    const systemPrompt = `You are Vantage Copilot—a sharp, conversational investing buddy. You talk like a knowledgeable friend, not a textbook. Keep it concise and real.

${philosophy}

## ABSOLUTE RULES
1. You have LIVE INTERNET DATA for every security via Yahoo Finance (quotes, profile, sector, market cap, P/E, analyst targets, and recent headlines). NEVER say you "can't find" or "don't have data".
2. Use EXACT prices, fundamentals, and headlines from the data blocks below — your training data is outdated.
3. When the user mentions a company by name (e.g. "Palantir", "Rheinmetall", "Nvidia"), the matching ticker and live data appear under ON-DEMAND LOOKUPS. Use it.
4. NEVER claim a stock is "private" or "not traded" unless the data explicitly returns nothing for that name.
5. When relevant, weave in 1 specific data point from the live profile or headlines so the answer feels current ("Recent headline: ...").

## PERFORMANCE FORECASTING FRAMEWORK (use the PERFORMANCE FORECAST INPUTS block)
When the user asks how a security will perform, where it's headed, a price target, or whether to buy/sell/hold, you MUST anchor your answer in the computed stats below. Don't hand-wave.

Synthesize a forecast from FIVE signal categories (weight roughly equally):
  1) Historical trajectory — 3Y/5Y CAGR sets a base-rate expectation. A stock that has compounded at 25%/yr won't suddenly do 5%.
  2) Momentum & trend — 1M/3M/6M/1Y returns, price vs SMA50/SMA200, RSI14. RSI > 70 = overbought caution; < 30 = oversold bounce setup. Trend label tells you regime.
  3) Risk profile — annualized vol, max drawdown, Sharpe. Use these to bracket your forecast (e.g. "expect ±vol% swings, drawdowns up to maxDD% are normal").
  4) Forward fundamentals — Fwd P/E, PEG, EPS/Revenue growth, next-quarter & next-year EPS estimates. These drive the medium-term price.
  5) Analyst consensus & industry signals — consensus rating, mean/high/low targets and implied upside, recent upgrades/downgrades, sector ETF performance, news headlines. Recent upgrades + bullish headlines = tailwind; downgrades + sector lagging = headwind.

Then output an explicit, numerical forecast:
  • 12-month base-case target price + % upside (start from analyst mean target, adjust ±10–20% based on whether momentum/trend/EPS growth confirm or contradict).
  • Bull case and bear case targets (use analyst high/low as guides; tighten with vol/drawdown context).
  • Expected annualized return range (anchor to 3Y/5Y CAGR, adjusted for current regime and forward EPS growth).
  • Confidence level (High / Medium / Low) — High only if trajectory, momentum, fundamentals, AND analyst signals all align.

Hard rules:
  - NEVER set a Buy/Hold base-case target below current price. For Sell: base case must be below current price at a support level (use SMA200 or 52W low as anchor).
  - If forecast inputs are missing for a ticker, fall back to 52W range + live quote logic and say so briefly.
  - Always cite at least 2 specific numbers from the forecast block (e.g. "5Y CAGR of 31%, Sharpe of 1.4, analyst target $X implies +Y%").

## RESPONSE STYLE
- CONCISE: 2-3 short paragraphs max. No bullet-point walls or numbered lists unless asked.
- CONVERSATIONAL: talk like a smart friend. "Hey, so SMCI's sitting at $847 right now..." not "Super Micro Computer Inc. is currently trading at..."
- Lead with your take: rating + current price + 12-mo base-case target in the first sentence. Then a quick "why" backed by 2 stats. Then bull/bear range + confidence.
- Use data to tell a story: "It's pulled back 31% from its high of $1229, which honestly looks like a solid entry if you believe in AI infrastructure."
- NEVER say "I don't have details" or ask "would you like more?" — just give your take.

## LIVE MARKET DATA
${marketData}
${onDemandData}${forecastBlock}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages.map((m: { role: string; content: string }) => ({
            role: m.role,
            content: m.content,
          })),
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI Gateway error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI usage limit reached. Please try again later." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      return new Response(JSON.stringify({ error: "AI service unavailable" }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    console.log("AI Gateway response structure:", JSON.stringify(data, null, 2));
    
    // Handle different response structures from various models
    const aiResponse = data.choices?.[0]?.message?.content 
      || data.message?.content 
      || data.content
      || data.response
      || (typeof data === 'string' ? data : null);
    
    if (!aiResponse) {
      console.error("Could not extract response from AI data:", JSON.stringify(data));
      throw new Error("Failed to parse AI response");
    }
    
    console.log("Successfully generated AI response");

    return new Response(
      JSON.stringify({ response: aiResponse, forecasts: forecastPayload }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in ai-chat function:", error);
    return new Response(
      JSON.stringify({ error: "An error occurred processing your request" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
