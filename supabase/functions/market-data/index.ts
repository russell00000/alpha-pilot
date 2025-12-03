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
  // Top Stocks
  AAPL: { name: "Apple Inc.", type: "stock" },
  GOOGL: { name: "Alphabet Inc.", type: "stock" },
  MSFT: { name: "Microsoft Corp.", type: "stock" },
  NVDA: { name: "NVIDIA Corp.", type: "stock" },
  TSLA: { name: "Tesla Inc.", type: "stock" },
  AMZN: { name: "Amazon.com Inc.", type: "stock" },
  META: { name: "Meta Platforms", type: "stock" },
  NFLX: { name: "Netflix Inc.", type: "stock" },
  AMD: { name: "AMD Inc.", type: "stock" },
  INTC: { name: "Intel Corp.", type: "stock" },
  CRM: { name: "Salesforce Inc.", type: "stock" },
  ORCL: { name: "Oracle Corp.", type: "stock" },
  ADBE: { name: "Adobe Inc.", type: "stock" },
  CSCO: { name: "Cisco Systems", type: "stock" },
  PYPL: { name: "PayPal Holdings", type: "stock" },
  DIS: { name: "Walt Disney Co.", type: "stock" },
  V: { name: "Visa Inc.", type: "stock" },
  MA: { name: "Mastercard Inc.", type: "stock" },
  JPM: { name: "JPMorgan Chase", type: "stock" },
  BAC: { name: "Bank of America", type: "stock" },
  WMT: { name: "Walmart Inc.", type: "stock" },
  KO: { name: "Coca-Cola Co.", type: "stock" },
  PEP: { name: "PepsiCo Inc.", type: "stock" },
  JNJ: { name: "Johnson & Johnson", type: "stock" },
  PFE: { name: "Pfizer Inc.", type: "stock" },
  UNH: { name: "UnitedHealth Group", type: "stock" },
  HD: { name: "Home Depot", type: "stock" },
  MCD: { name: "McDonald's Corp.", type: "stock" },
  NKE: { name: "Nike Inc.", type: "stock" },
  SBUX: { name: "Starbucks Corp.", type: "stock" },
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
  // Mutual Funds (tickers)
  VFIAX: { name: "Vanguard 500 Index", type: "mutual_fund" },
  FXAIX: { name: "Fidelity 500 Index", type: "mutual_fund" },
  VTSAX: { name: "Vanguard Total Stock", type: "mutual_fund" },
  SWPPX: { name: "Schwab S&P 500 Index", type: "mutual_fund" },
};

async function fetchStockQuote(symbol: string, apiKey: string): Promise<MarketData | null> {
  try {
    const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${apiKey}`;
    console.log(`Fetching quote for ${symbol}`);
    
    const response = await fetch(url);
    const data = await response.json();
    
    if (data["Error Message"]) {
      console.error(`API error for ${symbol}:`, data["Error Message"]);
      return null;
    }
    
    if (data["Note"]) {
      console.warn(`Rate limit warning for ${symbol}:`, data["Note"]);
      return null;
    }
    
    const quote = data["Global Quote"];
    if (!quote || !quote["05. price"]) {
      console.error(`No quote data for ${symbol}`);
      return null;
    }
    
    const price = parseFloat(quote["05. price"]);
    const change = parseFloat(quote["09. change"]);
    const changePercent = parseFloat(quote["10. change percent"]?.replace("%", "") || "0");
    const volume = parseInt(quote["06. volume"] || "0");
    
    const assetInfo = assetDatabase[symbol.toUpperCase()] || { name: symbol, type: "stock" };
    
    return {
      symbol: symbol.toUpperCase(),
      name: assetInfo.name,
      price: price.toFixed(2),
      change,
      changePercent,
      volume: formatVolume(volume),
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

// Search for a specific stock/ETF
async function searchStock(query: string, apiKey: string): Promise<MarketData[]> {
  try {
    // First try direct symbol lookup
    const upperQuery = query.toUpperCase().trim();
    
    // If it's a known symbol, fetch it directly
    if (assetDatabase[upperQuery]) {
      const result = await fetchStockQuote(upperQuery, apiKey);
      return result ? [result] : [];
    }
    
    // Use Alpha Vantage symbol search
    const searchUrl = `https://www.alphavantage.co/query?function=SYMBOL_SEARCH&keywords=${encodeURIComponent(query)}&apikey=${apiKey}`;
    const searchResponse = await fetch(searchUrl);
    const searchData = await searchResponse.json();
    
    if (searchData["Note"]) {
      console.warn("Rate limit on search");
      return [];
    }
    
    const matches = searchData.bestMatches || [];
    const results: MarketData[] = [];
    
    // Fetch quotes for top 3 matches
    for (const match of matches.slice(0, 3)) {
      const symbol = match["1. symbol"];
      const result = await fetchStockQuote(symbol, apiKey);
      if (result) {
        result.name = match["2. name"] || result.name;
        results.push(result);
      }
      await new Promise(resolve => setTimeout(resolve, 250));
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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const ALPHA_VANTAGE_API_KEY = Deno.env.get("ALPHA_VANTAGE_API_KEY");
    
    if (!ALPHA_VANTAGE_API_KEY) {
      console.error("ALPHA_VANTAGE_API_KEY is not configured");
      throw new Error("ALPHA_VANTAGE_API_KEY is not configured");
    }

    let body: { type?: string; search?: string; symbols?: string[] } = {};
    try {
      const text = await req.text();
      if (text) {
        body = JSON.parse(text);
      }
    } catch (e) {
      console.log("Failed to parse body:", e);
    }
    
    const { type = "all", search, symbols } = body;
    console.log("Market data request - type:", type, "search:", search, "symbols:", symbols);

    // Handle search queries
    if (search) {
      console.log("Searching for:", search);
      const searchResults = await searchStock(search, ALPHA_VANTAGE_API_KEY);
      return new Response(
        JSON.stringify({ data: searchResults }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Handle specific symbol requests
    if (symbols && Array.isArray(symbols)) {
      const results: MarketData[] = [];
      for (const symbol of symbols.slice(0, 5)) {
        const result = await fetchStockQuote(symbol, ALPHA_VANTAGE_API_KEY);
        if (result) results.push(result);
        await new Promise(resolve => setTimeout(resolve, 250));
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

    // Fetch featured stocks (limited due to API rate limits)
    if (type === "all" || type === "stocks") {
      const featuredStocks = ["AAPL", "MSFT", "GOOGL", "NVDA", "AMZN", "META"];
      for (const symbol of featuredStocks.slice(0, 4)) {
        const result = await fetchStockQuote(symbol, ALPHA_VANTAGE_API_KEY);
        if (result) results.push(result);
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    }

    // Fetch featured ETFs
    if (type === "all" || type === "etf") {
      const featuredETFs = ["SPY", "QQQ", "VOO"];
      for (const symbol of featuredETFs.slice(0, 2)) {
        const result = await fetchStockQuote(symbol, ALPHA_VANTAGE_API_KEY);
        if (result) results.push(result);
        await new Promise(resolve => setTimeout(resolve, 300));
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
