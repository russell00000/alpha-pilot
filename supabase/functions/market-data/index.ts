import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface MarketData {
  symbol: string;
  name: string;
  price: string;
  change: number;
  changePercent: number;
  volume: string;
  sparkline?: number[];
  type: "stock" | "crypto" | "etf" | "mutual_fund";
}

// In-memory cache with longer TTL to reduce API calls
const cache: Map<string, { data: MarketData; timestamp: number }> = new Map();
const CACHE_TTL = 600000; // 10 minutes cache for stocks (most price moves are tiny intraday)
const CRYPTO_CACHE_TTL = 60000; // 1 minute for crypto

// Rate limit tracking
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 100; // Minimum 100ms between Finnhub requests

// Known crypto symbols - these should NOT be looked up via Finnhub
const CRYPTO_SYMBOLS = new Set(["BTC", "ETH", "SOL", "XRP", "ADA", "DOGE", "DOT", "AVAX", "LINK", "MATIC", "USDC"]);

// Crypto symbol to CoinGecko ID mapping
const CRYPTO_ID_MAP: Record<string, string> = {
  BTC: "bitcoin",
  ETH: "ethereum",
  SOL: "solana",
  XRP: "ripple",
  ADA: "cardano",
  DOGE: "dogecoin",
  DOT: "polkadot",
  AVAX: "avalanche-2",
  LINK: "chainlink",
  MATIC: "polygon",
  USDC: "usd-coin",
};

// Extended stock database with names and types
const assetDatabase: Record<string, { name: string; type: "stock" | "etf" | "mutual_fund" }> = {
  // Top 100 Stocks by market cap
  AAPL: { name: "Apple Inc.", type: "stock" },
  MSFT: { name: "Microsoft Corp.", type: "stock" },
  GOOGL: { name: "Alphabet Inc.", type: "stock" },
  AMZN: { name: "Amazon.com Inc.", type: "stock" },
  NVDA: { name: "NVIDIA Corp.", type: "stock" },
  META: { name: "Meta Platforms", type: "stock" },
  TSLA: { name: "Tesla Inc.", type: "stock" },
  BRK: { name: "Berkshire Hathaway", type: "stock" },
  LLY: { name: "Eli Lilly & Co.", type: "stock" },
  V: { name: "Visa Inc.", type: "stock" },
  UNH: { name: "UnitedHealth Group", type: "stock" },
  JPM: { name: "JPMorgan Chase", type: "stock" },
  WMT: { name: "Walmart Inc.", type: "stock" },
  XOM: { name: "Exxon Mobil Corp.", type: "stock" },
  MA: { name: "Mastercard Inc.", type: "stock" },
  JNJ: { name: "Johnson & Johnson", type: "stock" },
  PG: { name: "Procter & Gamble", type: "stock" },
  HD: { name: "Home Depot", type: "stock" },
  AVGO: { name: "Broadcom Inc.", type: "stock" },
  ORCL: { name: "Oracle Corp.", type: "stock" },
  CVX: { name: "Chevron Corp.", type: "stock" },
  MRK: { name: "Merck & Co.", type: "stock" },
  ABBV: { name: "AbbVie Inc.", type: "stock" },
  COST: { name: "Costco Wholesale", type: "stock" },
  KO: { name: "Coca-Cola Co.", type: "stock" },
  PEP: { name: "PepsiCo Inc.", type: "stock" },
  ADBE: { name: "Adobe Inc.", type: "stock" },
  CRM: { name: "Salesforce Inc.", type: "stock" },
  TMO: { name: "Thermo Fisher", type: "stock" },
  BAC: { name: "Bank of America", type: "stock" },
  NFLX: { name: "Netflix Inc.", type: "stock" },
  AMD: { name: "AMD Inc.", type: "stock" },
  CSCO: { name: "Cisco Systems", type: "stock" },
  ACN: { name: "Accenture PLC", type: "stock" },
  MCD: { name: "McDonald's Corp.", type: "stock" },
  LIN: { name: "Linde PLC", type: "stock" },
  ABT: { name: "Abbott Labs", type: "stock" },
  DIS: { name: "Walt Disney Co.", type: "stock" },
  NKE: { name: "Nike Inc.", type: "stock" },
  DHR: { name: "Danaher Corp.", type: "stock" },
  WFC: { name: "Wells Fargo", type: "stock" },
  TXN: { name: "Texas Instruments", type: "stock" },
  PM: { name: "Philip Morris", type: "stock" },
  INTC: { name: "Intel Corp.", type: "stock" },
  INTU: { name: "Intuit Inc.", type: "stock" },
  QCOM: { name: "Qualcomm Inc.", type: "stock" },
  VZ: { name: "Verizon Comm.", type: "stock" },
  IBM: { name: "IBM Corp.", type: "stock" },
  AMGN: { name: "Amgen Inc.", type: "stock" },
  COP: { name: "ConocoPhillips", type: "stock" },
  SPGI: { name: "S&P Global", type: "stock" },
  CAT: { name: "Caterpillar Inc.", type: "stock" },
  RTX: { name: "RTX Corp.", type: "stock" },
  NEE: { name: "NextEra Energy", type: "stock" },
  HON: { name: "Honeywell Int'l", type: "stock" },
  UPS: { name: "United Parcel Service", type: "stock" },
  LOW: { name: "Lowe's Companies", type: "stock" },
  BA: { name: "Boeing Co.", type: "stock" },
  GE: { name: "General Electric", type: "stock" },
  AMAT: { name: "Applied Materials", type: "stock" },
  SBUX: { name: "Starbucks Corp.", type: "stock" },
  ELV: { name: "Elevance Health", type: "stock" },
  PFE: { name: "Pfizer Inc.", type: "stock" },
  T: { name: "AT&T Inc.", type: "stock" },
  BKNG: { name: "Booking Holdings", type: "stock" },
  GS: { name: "Goldman Sachs", type: "stock" },
  DE: { name: "Deere & Co.", type: "stock" },
  MDT: { name: "Medtronic PLC", type: "stock" },
  BLK: { name: "BlackRock Inc.", type: "stock" },
  SYK: { name: "Stryker Corp.", type: "stock" },
  ISRG: { name: "Intuitive Surgical", type: "stock" },
  ADP: { name: "ADP Inc.", type: "stock" },
  VRTX: { name: "Vertex Pharma", type: "stock" },
  GILD: { name: "Gilead Sciences", type: "stock" },
  MDLZ: { name: "Mondelez Int'l", type: "stock" },
  ADI: { name: "Analog Devices", type: "stock" },
  MMC: { name: "Marsh & McLennan", type: "stock" },
  REGN: { name: "Regeneron Pharma", type: "stock" },
  LRCX: { name: "Lam Research", type: "stock" },
  CI: { name: "Cigna Group", type: "stock" },
  CVS: { name: "CVS Health", type: "stock" },
  SCHW: { name: "Charles Schwab", type: "stock" },
  ZTS: { name: "Zoetis Inc.", type: "stock" },
  CME: { name: "CME Group", type: "stock" },
  MO: { name: "Altria Group", type: "stock" },
  KLAC: { name: "KLA Corp.", type: "stock" },
  AON: { name: "Aon PLC", type: "stock" },
  SNPS: { name: "Synopsys Inc.", type: "stock" },
  CB: { name: "Chubb Limited", type: "stock" },
  DUK: { name: "Duke Energy", type: "stock" },
  SO: { name: "Southern Co.", type: "stock" },
  EQIX: { name: "Equinix Inc.", type: "stock" },
  SHW: { name: "Sherwin-Williams", type: "stock" },
  PLD: { name: "Prologis Inc.", type: "stock" },
  MU: { name: "Micron Technology", type: "stock" },
  ITW: { name: "Illinois Tool Works", type: "stock" },
  PYPL: { name: "PayPal Holdings", type: "stock" },
  NOW: { name: "ServiceNow Inc.", type: "stock" },
  // ETFs
  SPY: { name: "SPDR S&P 500 ETF", type: "etf" },
  QQQ: { name: "Invesco QQQ Trust", type: "etf" },
  VTI: { name: "Vanguard Total Stock", type: "etf" },
  VOO: { name: "Vanguard S&P 500", type: "etf" },
  IWM: { name: "iShares Russell 2000", type: "etf" },
  VGT: { name: "Vanguard Info Tech", type: "etf" },
  ARKK: { name: "ARK Innovation ETF", type: "etf" },
  XLF: { name: "Financial Select SPDR", type: "etf" },
  XLE: { name: "Energy Select SPDR", type: "etf" },
  GLD: { name: "SPDR Gold Shares", type: "etf" },
  SLV: { name: "iShares Silver Trust", type: "etf" },
  VNQ: { name: "Vanguard Real Estate", type: "etf" },
  BND: { name: "Vanguard Total Bond", type: "etf" },
  SCHD: { name: "Schwab US Dividend", type: "etf" },
  VYM: { name: "Vanguard High Dividend", type: "etf" },
  EFA: { name: "iShares MSCI EAFE", type: "etf" },
  VEA: { name: "Vanguard FTSE Dev Markets", type: "etf" },
  VWO: { name: "Vanguard FTSE Emerging", type: "etf" },
  AGG: { name: "iShares Core US Aggregate", type: "etf" },
  LQD: { name: "iShares iBoxx IG Corp", type: "etf" },
  // Mutual Funds
  VFIAX: { name: "Vanguard 500 Index", type: "mutual_fund" },
  FXAIX: { name: "Fidelity 500 Index", type: "mutual_fund" },
  VTSAX: { name: "Vanguard Total Stock", type: "mutual_fund" },
  SWPPX: { name: "Schwab S&P 500 Index", type: "mutual_fund" },
  VGTSX: { name: "Vanguard Total Int'l", type: "mutual_fund" },
  VTSMX: { name: "Vanguard Total Stock Market", type: "mutual_fund" },
  VFINX: { name: "Vanguard 500 Index Investor", type: "mutual_fund" },
  FSKAX: { name: "Fidelity Total Market", type: "mutual_fund" },
  SWTSX: { name: "Schwab Total Stock Market", type: "mutual_fund" },
  VBTLX: { name: "Vanguard Total Bond Market", type: "mutual_fund" },
};

// Known mutual fund symbols - these need Yahoo Finance instead of Finnhub
const MUTUAL_FUND_SYMBOLS = new Set(["VFIAX", "FXAIX", "VTSAX", "SWPPX", "VGTSX", "VTSMX", "VFINX", "FSKAX", "SWTSX", "VBTLX"]);

// Check cache for valid data
function getCachedData(symbol: string): MarketData | null {
  const cached = cache.get(symbol);
  if (cached) {
    const ttl = symbol.startsWith("crypto_") ? CRYPTO_CACHE_TTL : CACHE_TTL;
    if (Date.now() - cached.timestamp < ttl) {
      return cached.data;
    }
  }
  return null;
}

// Set cache data
function setCacheData(symbol: string, data: MarketData) {
  cache.set(symbol, { data, timestamp: Date.now() });
}

// Rate-limited fetch with retry
async function rateLimitedFetch(url: string): Promise<Response> {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;
  
  if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
    await new Promise(resolve => setTimeout(resolve, MIN_REQUEST_INTERVAL - timeSinceLastRequest));
  }
  
  lastRequestTime = Date.now();
  return fetch(url);
}

// Generate sparkline data based on price change
function generateSparkline(currentPrice: number, changePercent: number): number[] {
  const points = 24;
  const sparkline: number[] = [];
  const priceChangeRatio = changePercent / 100;
  const startPrice = currentPrice / (1 + priceChangeRatio);
  
  // Create realistic price movement
  for (let i = 0; i < points; i++) {
    const progress = i / (points - 1);
    // Add some randomness while trending toward the final price
    const noise = (Math.random() - 0.5) * Math.abs(currentPrice - startPrice) * 0.3;
    const baseValue = startPrice + (currentPrice - startPrice) * progress;
    sparkline.push(baseValue + noise);
  }
  
  // Ensure last point is close to current price
  sparkline[sparkline.length - 1] = currentPrice;
  
  return sparkline;
}

// Track rate limit status
let finnhubRateLimited = false;
let rateLimitResetTime = 0;

// Fetch stock quote from Yahoo Finance (no rate limits)
async function fetchStockQuoteYahoo(symbol: string): Promise<MarketData | null> {
  // Check cache first
  const cached = getCachedData(symbol);
  if (cached) {
    return cached;
  }

  try {
    // Use 1d interval with 1d range to get today's intraday data for accurate sparkline
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=5m&range=1d`;
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    const data = await response.json();
    
    if (!data.chart || !data.chart.result || data.chart.result.length === 0) {
      return null;
    }
    
    const result = data.chart.result[0];
    const meta = result.meta || {};
    const quote = result.indicators?.quote?.[0] || {};
    const closes = quote.close || [];
    
    const currentPrice = meta.regularMarketPrice || closes[closes.length - 1];
    const previousClose = meta.chartPreviousClose || meta.previousClose;
    
    if (!currentPrice) {
      return null;
    }
    
    const change = previousClose ? (currentPrice - previousClose) : 0;
    const changePercent = previousClose ? ((change / previousClose) * 100) : 0;
    
    // Filter out null values and get valid price points for sparkline
    const validCloses = closes.filter((c: number | null) => c !== null && !isNaN(c));
    // Use intraday closes for sparkline - matches the daily change shown
    const sparklineData = validCloses.length >= 2 
      ? validCloses.slice(-24) 
      : generateSparkline(currentPrice, changePercent);
    
    const assetInfo = assetDatabase[symbol.toUpperCase()] || { name: meta.shortName || symbol, type: "stock" };
    
    const marketData: MarketData = {
      symbol: symbol.toUpperCase(),
      name: assetInfo.name,
      price: currentPrice.toFixed(2),
      change: change,
      changePercent: changePercent,
      volume: formatVolume(meta.regularMarketVolume || 0),
      sparkline: sparklineData,
      type: assetInfo.type,
    };
    
    // Cache the result
    setCacheData(symbol, marketData);
    
    return marketData;
  } catch (error) {
    console.error(`Yahoo Finance error for ${symbol}:`, error);
    const staleCache = cache.get(symbol);
    if (staleCache) return staleCache.data;
    return null;
  }
}

// Fetch stock quote - uses Yahoo Finance primarily (no rate limits)
async function fetchStockQuote(symbol: string, apiKey: string): Promise<MarketData | null> {
  // Check cache first
  const cached = getCachedData(symbol);
  if (cached) {
    return cached;
  }

  // Use Yahoo Finance - no rate limits
  return fetchStockQuoteYahoo(symbol);
}

// Fetch mutual fund quote from Yahoo Finance (Finnhub doesn't support mutual funds)
async function fetchMutualFundQuote(symbol: string): Promise<MarketData | null> {
  // Check cache first
  const cached = getCachedData(`mf_${symbol}`);
  if (cached) {
    return cached;
  }

  try {
    // Mutual funds only update once daily, so use 1d interval but still get today's close
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=5d`;
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    const data = await response.json();
    
    if (!data.chart || !data.chart.result || data.chart.result.length === 0) {
      return null;
    }
    
    const result = data.chart.result[0];
    const meta = result.meta || {};
    const quote = result.indicators?.quote?.[0] || {};
    const closes = quote.close || [];
    const volumes = quote.volume || [];
    
    const currentPrice = meta.regularMarketPrice || closes[closes.length - 1];
    const previousClose = meta.chartPreviousClose || meta.previousClose;
    
    if (!currentPrice) {
      return null;
    }
    
    const change = previousClose ? (currentPrice - previousClose) : 0;
    const changePercent = previousClose ? ((change / previousClose) * 100) : 0;
    const totalVolume = volumes.reduce((sum: number, v: number) => sum + (v || 0), 0);
    
    const assetInfo = assetDatabase[symbol.toUpperCase()] || { name: symbol, type: "mutual_fund" };
    
    // For mutual funds, generate sparkline based on the daily change since they don't have intraday data
    const sparklineData = generateSparkline(currentPrice, changePercent);
    
    const marketData: MarketData = {
      symbol: symbol.toUpperCase(),
      name: assetInfo.name,
      price: currentPrice.toFixed(2),
      change: change,
      changePercent: changePercent,
      volume: formatVolume(totalVolume),
      sparkline: sparklineData,
      type: "mutual_fund",
    };
    
    // Cache the result
    setCacheData(`mf_${symbol}`, marketData);
    
    return marketData;
  } catch (error) {
    console.error(`Error fetching mutual fund ${symbol}:`, error);
    const staleCache = cache.get(`mf_${symbol}`);
    if (staleCache) return staleCache.data;
    return null;
  }
}

function formatVolume(volume: number): string {
  if (volume >= 1_000_000_000) {
    return `${(volume / 1_000_000_000).toFixed(1)}B`;
  }
  if (volume >= 1_000_000) {
    return `${(volume / 1_000_000).toFixed(1)}M`;
  }
  if (volume >= 1_000) {
    return `${(volume / 1_000).toFixed(1)}K`;
  }
  return volume.toString();
}

// Fetch multiple cryptos from CoinGecko with sparkline data
async function fetchCryptoData(): Promise<MarketData[]> {
  try {
    const ids = "bitcoin,ethereum,solana,ripple,cardano,dogecoin,polkadot,avalanche-2,chainlink,polygon";
    const response = await fetch(
      `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${ids}&order=market_cap_desc&sparkline=true&price_change_percentage=24h`
    );
    const data = await response.json();
    
    if (!Array.isArray(data)) {
      console.error("CoinGecko returned invalid data");
      return [];
    }
    
    const symbolMap: Record<string, string> = {
      bitcoin: "BTC",
      ethereum: "ETH",
      solana: "SOL",
      ripple: "XRP",
      cardano: "ADA",
      dogecoin: "DOGE",
      polkadot: "DOT",
      "avalanche-2": "AVAX",
      chainlink: "LINK",
      polygon: "MATIC",
    };
    
    const results = data.map((coin: any) => {
      const result: MarketData = {
        symbol: symbolMap[coin.id] || coin.symbol.toUpperCase(),
        name: coin.name,
        price: coin.current_price.toFixed(coin.current_price < 1 ? 4 : 2),
        change: (coin.current_price * coin.price_change_percentage_24h_in_currency) / 100,
        changePercent: coin.price_change_percentage_24h_in_currency || 0,
        volume: formatVolume(coin.total_volume),
        sparkline: coin.sparkline_in_7d?.price?.slice(-24) || [],
        type: "crypto" as const,
      };
      // Cache crypto data
      setCacheData(`crypto_${result.symbol}`, result);
      return result;
    });
    
    return results;
  } catch (error) {
    console.error("Error fetching crypto data:", error);
    return [];
  }
}

// Search for a specific stock using Finnhub symbol search
async function searchStock(query: string, apiKey: string): Promise<MarketData[]> {
  try {
    const upperQuery = query.toUpperCase().trim();
    
    // If it's a known symbol, fetch it directly
    if (assetDatabase[upperQuery]) {
      const result = await fetchStockQuote(upperQuery, apiKey);
      return result ? [result] : [];
    }
    
    // Use Finnhub symbol search
    const searchUrl = `https://finnhub.io/api/v1/search?q=${encodeURIComponent(query)}&token=${apiKey}`;
    const searchResponse = await rateLimitedFetch(searchUrl);
    const searchData = await searchResponse.json();
    
    if (!searchData.result || searchData.result.length === 0) {
      return [];
    }
    
    const results: MarketData[] = [];
    
    // Fetch quotes for top 3 matches only
    for (const match of searchData.result.slice(0, 3)) {
      const symbol = match.symbol;
      if (symbol.includes('.') || symbol.includes(':')) continue;
      
      const result = await fetchStockQuote(symbol, apiKey);
      if (result) {
        result.name = match.description || result.name;
        results.push(result);
      }
    }
    
    return results;
  } catch (error) {
    console.error("Search error:", error);
    return [];
  }
}

// Get list of all available assets for browsing
function getAssetList(): { symbol: string; name: string; type: string }[] {
  return Object.entries(assetDatabase).map(([symbol, info]) => ({
    symbol,
    name: info.name,
    type: info.type,
  }));
}

// Fetch historical candle data from Yahoo Finance
async function fetchHistoricalData(symbol: string, range: string, _apiKey: string): Promise<{ date: string; price: number; open: number; high: number; low: number; volume: number; displayDate: string }[]> {
  try {
    let yahooRange: string;
    let interval: string;
    
    switch (range) {
      case "1D":
        yahooRange = "1d";
        interval = "2m";
        break;
      case "1W":
        yahooRange = "5d";
        interval = "15m";
        break;
      case "1M":
        yahooRange = "1mo";
        interval = "30m";
        break;
      case "3M":
        yahooRange = "3mo";
        interval = "60m";
        break;
      case "6M":
        yahooRange = "6mo";
        interval = "60m";
        break;
      case "1Y":
        yahooRange = "1y";
        interval = "60m";
        break;
      case "5Y":
        yahooRange = "5y";
        interval = "1d";
        break;
      default:
        yahooRange = "max";
        interval = "1d";
        break;
    }
    
    const yahooSymbol = CRYPTO_SYMBOLS.has(symbol.toUpperCase()) 
      ? `${symbol.toUpperCase()}-USD` 
      : symbol;
    
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${yahooSymbol}?interval=${interval}&range=${yahooRange}`;
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    const data = await response.json();
    
    if (!data.chart || !data.chart.result || data.chart.result.length === 0) {
      return [];
    }
    
    const result = data.chart.result[0];
    const timestamps = result.timestamp || [];
    const quote = result.indicators?.quote?.[0] || {};
    const closes = quote.close || [];
    const opens = quote.open || [];
    const highs = quote.high || [];
    const lows = quote.low || [];
    const volumes = quote.volume || [];
    
    if (timestamps.length === 0 || closes.length === 0) {
      return [];
    }
    
    const results: { date: string; price: number; open: number; high: number; low: number; volume: number; displayDate: string }[] = [];
    
    for (let i = 0; i < timestamps.length; i++) {
      if (closes[i] === null || closes[i] === undefined) continue;
      
      const timestamp = timestamps[i] * 1000;
      const date = new Date(timestamp);
      
      let displayDate: string;
      if (range === "1D") {
        displayDate = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      } else if (range === "1W") {
        displayDate = date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
      } else if (["1M", "3M"].includes(range)) {
        displayDate = date.toLocaleDateString([], { month: 'short', day: 'numeric' });
      } else {
        displayDate = date.toLocaleDateString([], { month: 'short', year: '2-digit' });
      }
      
      results.push({
        date: date.toISOString(),
        price: parseFloat((closes[i] || 0).toFixed(2)),
        open: parseFloat((opens[i] || closes[i] || 0).toFixed(2)),
        high: parseFloat((highs[i] || closes[i] || 0).toFixed(2)),
        low: parseFloat((lows[i] || closes[i] || 0).toFixed(2)),
        volume: volumes[i] || 0,
        displayDate,
      });
    }
    
    return results;
  } catch (error) {
    console.error(`Error fetching Yahoo Finance historical data for ${symbol}:`, error);
    return [];
  }
}

// Fetch stock details including 52-week high/low from Yahoo Finance
async function fetchStockDetails(symbol: string): Promise<{ week52High: number; week52Low: number; marketCap: number; peRatio: number; eps: number; dividend: number; avgVolume: number } | null> {
  try {
    const yahooSymbol = CRYPTO_SYMBOLS.has(symbol.toUpperCase()) 
      ? `${symbol.toUpperCase()}-USD` 
      : symbol;
    
    // We only need the meta info, so range=1d is sufficient and faster
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${yahooSymbol}?interval=1d&range=1d`;
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    const data = await response.json();
    
    if (!data.chart || !data.chart.result || data.chart.result.length === 0) {
      return null;
    }
    
    const result = data.chart.result[0];
    const meta = result.meta || {};
    
    return {
      week52High: meta.fiftyTwoWeekHigh || 0,
      week52Low: meta.fiftyTwoWeekLow || 0,
      marketCap: meta.marketCap || 0,
      peRatio: meta.trailingPE || 0,
      eps: meta.epsTrailingTwelveMonths || 0,
      dividend: meta.dividendYield || 0,
      avgVolume: meta.averageDailyVolume10Day || 0,
    };
  } catch (error) {
    console.error(`Error fetching stock details for ${symbol}:`, error);
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const FINNHUB_API_KEY = Deno.env.get("FINNHUB_API_KEY");
    
    if (!FINNHUB_API_KEY) {
      throw new Error("FINNHUB_API_KEY is not configured");
    }

    let body: any = {};
    try {
      const text = await req.text();
      if (text) body = JSON.parse(text);
    } catch (e) {
      console.log("Failed to parse body:", e);
    }
    
    const { type = "all", search, symbols, historical, symbol, range, details } = body;

    if (details && symbol) {
      const stockDetails = await fetchStockDetails(symbol.toUpperCase());
      return new Response(JSON.stringify({ data: stockDetails }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (historical && symbol && range) {
      const historicalData = await fetchHistoricalData(symbol.toUpperCase(), range, FINNHUB_API_KEY);
      return new Response(JSON.stringify({ data: historicalData }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (search) {
      const searchResults = await searchStock(search, FINNHUB_API_KEY);
      return new Response(JSON.stringify({ data: searchResults }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Lightweight symbol-only search (no quote fetch) for autocomplete.
    // Uses Yahoo Finance's public search endpoint so ANY listed security is reachable.
    if (body.symbolSearch && typeof body.symbolSearch === "string") {
      const q = body.symbolSearch.trim();
      if (!q) {
        return new Response(JSON.stringify({ data: [] }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      try {
        const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(q)}&quotesCount=15&newsCount=0&listsCount=0`;
        const resp = await fetch(url, {
          headers: {
            "User-Agent": "Mozilla/5.0 (compatible; VantageBot/1.0)",
            "Accept": "application/json",
          },
        });
        if (!resp.ok) {
          return new Response(JSON.stringify({ data: [] }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        const json = await resp.json();
        const quotes = Array.isArray(json?.quotes) ? json.quotes : [];
        const mapType = (qt: string, type: string) => {
          const t = (qt || type || "").toLowerCase();
          if (t.includes("etf")) return "etf";
          if (t.includes("mutual")) return "mutual_fund";
          if (t.includes("crypto")) return "crypto";
          if (t.includes("index")) return "index";
          if (t.includes("future")) return "future";
          if (t.includes("currency")) return "currency";
          return "stock";
        };
        const data = quotes
          .filter((q: any) => q && (q.symbol || q.shortname))
          .map((q: any) => ({
            symbol: q.symbol as string,
            name: (q.shortname || q.longname || q.symbol) as string,
            type: mapType(q.quoteType, q.typeDisp),
            exchange: q.exchDisp || q.exchange || null,
          }));
        return new Response(JSON.stringify({ data }), {
          headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "public, max-age=60, s-maxage=300" },
        });
      } catch (e) {
        console.error("symbolSearch error:", e);
        return new Response(JSON.stringify({ data: [] }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    if (symbols && Array.isArray(symbols)) {
      const results: MarketData[] = [];
      const cryptoSymbols: string[] = [];
      const stockSymbols: string[] = [];
      const mutualFundSymbols: string[] = [];
      
      // Increased slice to 50 for better throughput
      for (const sym of symbols.slice(0, 50)) {
        const upperSym = sym.toUpperCase();
        if (CRYPTO_SYMBOLS.has(upperSym)) cryptoSymbols.push(upperSym);
        else if (MUTUAL_FUND_SYMBOLS.has(upperSym)) mutualFundSymbols.push(upperSym);
        else stockSymbols.push(upperSym);
      }
      
      const cryptoPromise = cryptoSymbols.length > 0 ? (async () => {
        const cryptoIds = cryptoSymbols.map(s => CRYPTO_ID_MAP[s]).filter(Boolean).join(',');
        if (!cryptoIds) return [];
        const resp = await fetch(`https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${cryptoIds}&order=market_cap_desc&sparkline=true&price_change_percentage=24h`);
        const data = await resp.json();
        return Array.isArray(data) ? data.map(coin => ({
          symbol: Object.entries(CRYPTO_ID_MAP).find(([_, id]) => id === coin.id)?.[0] || coin.symbol.toUpperCase(),
          name: coin.name,
          price: coin.current_price.toFixed(coin.current_price < 1 ? 4 : 2),
          change: (coin.current_price * coin.price_change_percentage_24h_in_currency) / 100,
          changePercent: coin.price_change_percentage_24h_in_currency || 0,
          volume: formatVolume(coin.total_volume),
          sparkline: coin.sparkline_in_7d?.price?.slice(-24) || [],
          type: "crypto" as const,
        })) : [];
      })() : Promise.resolve([]);

      const [parallelQuotes, cryptoResults] = await Promise.all([
        Promise.all([
          ...mutualFundSymbols.map(sym => fetchMutualFundQuote(sym)),
          ...stockSymbols.map(sym => fetchStockQuote(sym, FINNHUB_API_KEY)),
        ]),
        cryptoPromise
      ]);

      results.push(...cryptoResults);
      for (const q of parallelQuotes) if (q) results.push(q);
      
      return new Response(JSON.stringify({ data: results }), {
        headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "public, max-age=30, s-maxage=60, stale-while-revalidate=120" },
      });
    }

    if (type === "list") {
      return new Response(JSON.stringify({ data: getAssetList() }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Default 'all' or typed collection
    const results: MarketData[] = [];
    const cryptoPromise = (type === "all" || type === "crypto") ? fetchCryptoData() : Promise.resolve([]);
    const stockJobs: Promise<MarketData | null>[] = [];
    
    if (type === "all" || type === "stocks") {
      const topStocks = ["AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "META", "TSLA", "V", "UNH", "JPM", "LLY", "MA", "JNJ", "XOM", "PG", "HD", "CVX", "MRK", "ABBV", "COST", "PEP", "KO", "ADBE", "WMT", "CRM", "MCD", "BAC", "NFLX", "AMD", "CSCO"];
      for (const sym of topStocks) stockJobs.push(fetchStockQuote(sym, FINNHUB_API_KEY));
    }
    if (type === "all" || type === "etf") {
      for (const sym of ["SPY", "QQQ", "VOO"]) stockJobs.push(fetchStockQuote(sym, FINNHUB_API_KEY));
    }
    if (type === "all" || type === "mutual_fund") {
      for (const sym of ["VFIAX", "FXAIX", "VTSAX"]) stockJobs.push(fetchMutualFundQuote(sym));
    }

    const [settled, cryptoData] = await Promise.all([Promise.all(stockJobs), cryptoPromise]);
    results.push(...cryptoData);
    for (const r of settled) if (r) results.push(r);
    
    return new Response(JSON.stringify({ data: results, availableAssets: getAssetList(), cached: cache.size > 0 }), {
      headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "public, max-age=30, s-maxage=60, stale-while-revalidate=120" },
    });
  } catch (error) {
    console.error("Error in market-data function:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error occurred" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
