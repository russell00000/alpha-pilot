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
  ATVI: { name: "Activision Blizzard", type: "stock" },
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

// Fetch stock quote from Finnhub (60 calls/minute)
async function fetchStockQuote(symbol: string, apiKey: string): Promise<MarketData | null> {
  try {
    const url = `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${apiKey}`;
    console.log(`Fetching quote for ${symbol}`);
    
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.error) {
      console.error(`Finnhub error for ${symbol}:`, data.error);
      return null;
    }
    
    // c = current price, d = change, dp = percent change, v = volume
    if (!data.c || data.c === 0) {
      console.warn(`No price data for ${symbol}`);
      return null;
    }
    
    const assetInfo = assetDatabase[symbol.toUpperCase()] || { name: symbol, type: "stock" };
    
    return {
      symbol: symbol.toUpperCase(),
      name: assetInfo.name,
      price: data.c.toFixed(2),
      change: data.d || 0,
      changePercent: data.dp || 0,
      volume: formatVolume(data.v || 0),
      type: assetInfo.type,
    };
  } catch (error) {
    console.error(`Error fetching ${symbol}:`, error);
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
    
    return data.map((coin: any) => ({
      symbol: symbolMap[coin.id] || coin.symbol.toUpperCase(),
      name: coin.name,
      price: coin.current_price.toFixed(coin.current_price < 1 ? 4 : 2),
      change: (coin.current_price * coin.price_change_percentage_24h_in_currency) / 100,
      changePercent: coin.price_change_percentage_24h_in_currency || 0,
      volume: formatVolume(coin.total_volume),
      sparkline: coin.sparkline_in_7d?.price?.slice(-24) || [],
      type: "crypto" as const,
    }));
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
    const searchResponse = await fetch(searchUrl);
    const searchData = await searchResponse.json();
    
    if (!searchData.result || searchData.result.length === 0) {
      return [];
    }
    
    const results: MarketData[] = [];
    
    // Fetch quotes for top 5 matches (Finnhub allows 60/min)
    for (const match of searchData.result.slice(0, 5)) {
      const symbol = match.symbol;
      // Skip non-US symbols
      if (symbol.includes('.') || symbol.includes(':')) continue;
      
      const result = await fetchStockQuote(symbol, apiKey);
      if (result) {
        result.name = match.description || result.name;
        results.push(result);
      }
      await new Promise(resolve => setTimeout(resolve, 100));
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

// Fetch historical candle data from Finnhub
async function fetchHistoricalData(symbol: string, range: string, apiKey: string): Promise<{ date: string; price: number; displayDate: string }[]> {
  try {
    const now = Math.floor(Date.now() / 1000);
    let from: number;
    let resolution: string;
    
    switch (range) {
      case "1D":
        from = now - 86400;
        resolution = "15"; // 15 min intervals
        break;
      case "1W":
        from = now - 604800;
        resolution = "60"; // 1 hour intervals
        break;
      case "1M":
        from = now - 2592000;
        resolution = "D"; // Daily
        break;
      case "3M":
        from = now - 7776000;
        resolution = "D";
        break;
      case "6M":
        from = now - 15552000;
        resolution = "D";
        break;
      case "1Y":
        from = now - 31536000;
        resolution = "W"; // Weekly
        break;
      case "5Y":
        from = now - 157680000;
        resolution = "W";
        break;
      default: // ALL
        from = now - 315360000; // 10 years
        resolution = "M"; // Monthly
        break;
    }
    
    const url = `https://finnhub.io/api/v1/stock/candle?symbol=${symbol}&resolution=${resolution}&from=${from}&to=${now}&token=${apiKey}`;
    console.log(`Fetching historical data for ${symbol}, range: ${range}`);
    
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.s === "no_data" || !data.c || data.c.length === 0) {
      console.log(`No historical data for ${symbol}`);
      return [];
    }
    
    const results: { date: string; price: number; displayDate: string }[] = [];
    
    for (let i = 0; i < data.c.length; i++) {
      const timestamp = data.t[i] * 1000;
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
        price: parseFloat(data.c[i].toFixed(2)),
        displayDate,
      });
    }
    
    return results;
  } catch (error) {
    console.error(`Error fetching historical data for ${symbol}:`, error);
    return [];
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const FINNHUB_API_KEY = Deno.env.get("FINNHUB_API_KEY");
    
    if (!FINNHUB_API_KEY) {
      console.error("FINNHUB_API_KEY is not configured");
      throw new Error("FINNHUB_API_KEY is not configured");
    }

    let body: { type?: string; search?: string; symbols?: string[]; batch?: boolean; historical?: boolean; symbol?: string; range?: string } = {};
    try {
      const text = await req.text();
      if (text) {
        body = JSON.parse(text);
      }
    } catch (e) {
      console.log("Failed to parse body:", e);
    }
    
    const { type = "all", search, symbols, batch = false, historical, symbol, range } = body;
    console.log("Market data request - type:", type, "search:", search, "symbols:", symbols, "historical:", historical);

    // Handle historical data requests
    if (historical && symbol && range) {
      console.log(`Fetching historical data for ${symbol}, range: ${range}`);
      const historicalData = await fetchHistoricalData(symbol.toUpperCase(), range, FINNHUB_API_KEY);
      return new Response(
        JSON.stringify({ data: historicalData }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Handle search queries
    if (search) {
      console.log("Searching for:", search);
      const searchResults = await searchStock(search, FINNHUB_API_KEY);
      return new Response(
        JSON.stringify({ data: searchResults }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Handle specific symbol requests
    if (symbols && Array.isArray(symbols)) {
      const results: MarketData[] = [];
      // Finnhub allows 60/min, so we can fetch more
      for (const sym of symbols.slice(0, 30)) {
        const result = await fetchStockQuote(sym, FINNHUB_API_KEY);
        if (result) results.push(result);
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      return new Response(
        JSON.stringify({ data: results }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Handle asset list request
    if (type === "list") {
      return new Response(
        JSON.stringify({ data: getAssetList() }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const results: MarketData[] = [];

    // Fetch crypto data (free, no rate limit concerns)
    if (type === "all" || type === "crypto") {
      const cryptoData = await fetchCryptoData();
      results.push(...cryptoData);
    }

    // Fetch top stocks with real prices (Finnhub allows 60/min)
    if (type === "all" || type === "stocks") {
      const topStocks = [
        "AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "META", "TSLA", "V", "UNH", "JPM",
        "WMT", "MA", "JNJ", "PG", "HD", "AVGO", "ORCL", "CVX", "MRK", "ABBV"
      ];
      
      for (const symbol of topStocks) {
        const result = await fetchStockQuote(symbol, FINNHUB_API_KEY);
        if (result) results.push(result);
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }

    // Fetch ETFs
    if (type === "all" || type === "etf") {
      const topETFs = ["SPY", "QQQ", "VOO", "VTI", "IWM"];
      for (const symbol of topETFs) {
        const result = await fetchStockQuote(symbol, FINNHUB_API_KEY);
        if (result) results.push(result);
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }
    
    console.log(`Successfully fetched ${results.length} quotes`);

    return new Response(
      JSON.stringify({ 
        data: results,
        availableAssets: getAssetList()
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in market-data function:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error occurred" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
