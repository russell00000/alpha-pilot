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
  type: "stock" | "crypto" | "etf";
}

const stockNames: Record<string, string> = {
  AAPL: "Apple Inc.",
  GOOGL: "Alphabet Inc.",
  MSFT: "Microsoft Corp.",
  NVDA: "NVIDIA Corp.",
  TSLA: "Tesla Inc.",
  AMZN: "Amazon.com Inc.",
  META: "Meta Platforms",
  SPY: "SPDR S&P 500 ETF",
  QQQ: "Invesco QQQ Trust",
  VTI: "Vanguard Total Stock",
  VOO: "Vanguard S&P 500",
  IWM: "iShares Russell 2000",
};

async function fetchStockQuote(symbol: string, apiKey: string): Promise<MarketData | null> {
  try {
    const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${apiKey}`;
    console.log(`Fetching quote for ${symbol}`);
    
    const response = await fetch(url);
    const data = await response.json();
    
    if (data["Error Message"] || data["Note"]) {
      console.error(`API error for ${symbol}:`, data["Error Message"] || data["Note"]);
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
    
    // Determine type based on symbol
    const etfSymbols = ["SPY", "QQQ", "VTI", "VOO", "IWM"];
    const type = etfSymbols.includes(symbol) ? "etf" : "stock";
    
    return {
      symbol,
      name: stockNames[symbol] || symbol,
      price: price.toFixed(2),
      change,
      changePercent,
      volume: formatVolume(volume),
      type,
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
    const ids = "bitcoin,ethereum,solana,ripple,cardano,dogecoin";
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

    const { type = "all" } = await req.json().catch(() => ({}));
    
    console.log("Fetching market data, type:", type);

    const results: MarketData[] = [];

    // Fetch crypto data (free, no rate limit concerns)
    if (type === "all" || type === "crypto") {
      const cryptoData = await fetchCryptoData();
      results.push(...cryptoData);
    }

    // Fetch stock/ETF data based on request type
    if (type === "all" || type === "stocks" || type === "etf") {
      const stockSymbols = type === "etf" 
        ? ["SPY", "QQQ", "VTI", "VOO", "IWM"]
        : ["AAPL", "GOOGL", "MSFT", "NVDA", "TSLA"];
      
      // Fetch sequentially to respect rate limits
      for (const symbol of stockSymbols.slice(0, 3)) { // Limit to 3 to avoid rate limits
        const result = await fetchStockQuote(symbol, ALPHA_VANTAGE_API_KEY);
        if (result) {
          results.push(result);
        }
        await new Promise(resolve => setTimeout(resolve, 250));
      }
    }
    
    console.log(`Successfully fetched ${results.length} quotes`);

    return new Response(
      JSON.stringify({ data: results }),
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
