import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface StockQuote {
  symbol: string;
  name: string;
  price: string;
  change: number;
  changePercent: number;
  volume: string;
}

const stockNames: Record<string, string> = {
  AAPL: "Apple Inc.",
  GOOGL: "Alphabet Inc.",
  MSFT: "Microsoft Corp.",
  NVDA: "NVIDIA Corp.",
  TSLA: "Tesla Inc.",
  AMZN: "Amazon.com Inc.",
};

async function fetchStockQuote(symbol: string, apiKey: string): Promise<StockQuote | null> {
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
    
    return {
      symbol,
      name: stockNames[symbol] || symbol,
      price: price.toFixed(2),
      change,
      changePercent,
      volume: formatVolume(volume),
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

// Fetch Bitcoin from CoinGecko (free, no API key needed)
async function fetchBitcoin(): Promise<StockQuote | null> {
  try {
    const response = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd&include_24hr_change=true&include_24hr_vol=true"
    );
    const data = await response.json();
    
    if (!data.bitcoin) {
      return null;
    }
    
    const price = data.bitcoin.usd;
    const changePercent = data.bitcoin.usd_24h_change || 0;
    const volume = data.bitcoin.usd_24h_vol || 0;
    
    return {
      symbol: "BTC",
      name: "Bitcoin",
      price: price.toFixed(2),
      change: (price * changePercent) / 100,
      changePercent,
      volume: formatVolume(volume),
    };
  } catch (error) {
    console.error("Error fetching Bitcoin:", error);
    return null;
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

    const { symbols = ["AAPL", "GOOGL", "MSFT", "NVDA", "TSLA"] } = await req.json().catch(() => ({}));
    
    console.log("Fetching market data for symbols:", symbols);

    // Fetch stocks sequentially to avoid rate limits (5 calls/min on free tier)
    const stockPromises = symbols.map((symbol: string) => 
      fetchStockQuote(symbol, ALPHA_VANTAGE_API_KEY)
    );
    
    // Fetch Bitcoin separately
    const btcPromise = fetchBitcoin();
    
    // Wait for all with some delay between to respect rate limits
    const results: (StockQuote | null)[] = [];
    for (const promise of stockPromises) {
      const result = await promise;
      results.push(result);
      // Small delay to be nice to the API
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    const btcResult = await btcPromise;
    if (btcResult) {
      results.push(btcResult);
    }
    
    const validResults = results.filter((r): r is StockQuote => r !== null);
    
    console.log(`Successfully fetched ${validResults.length} quotes`);

    return new Response(
      JSON.stringify({ data: validResults }),
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
