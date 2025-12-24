import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Fetch the investing philosophy from the database
async function fetchPhilosophy(): Promise<string> {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: philosophy, error } = await supabase
      .from("investing_philosophy")
      .select("*")
      .limit(1)
      .single();

    if (error || !philosophy) {
      console.log("Failed to fetch philosophy:", error);
      return "";
    }

    return `
## INVESTING PHILOSOPHY
${philosophy.philosophy_text}

## RISK GUIDANCE
${philosophy.risk_guidance}

## COMMUNICATION STYLE
${philosophy.market_insights_style}
`;
  } catch (error) {
    console.error("Error fetching philosophy:", error);
    return "";
  }
}

// All securities offered on the platform
const TOP_STOCKS = [
  'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA', 'BRK.B', 'UNH', 'LLY',
  'JPM', 'V', 'XOM', 'JNJ', 'MA', 'PG', 'AVGO', 'HD', 'CVX', 'MRK',
  'ABBV', 'COST', 'PEP', 'KO', 'ADBE', 'WMT', 'CRM', 'MCD', 'BAC', 'CSCO',
  'TMO', 'ACN', 'NFLX', 'AMD', 'ABT', 'LIN', 'ORCL', 'DHR', 'TXN', 'NKE',
  'DIS', 'PM', 'WFC', 'VZ', 'INTC', 'COP', 'INTU', 'CMCSA', 'AMGN', 'PFE'
];

const TOP_ETFS = ['SPY', 'QQQ', 'VTI', 'VOO', 'IWM', 'VGT', 'ARKK', 'XLF', 'XLE', 'GLD', 'SCHD', 'VYM'];

const CRYPTO = ['BTC-USD', 'ETH-USD'];

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
  const allSymbols = [...TOP_STOCKS, ...TOP_ETFS, ...CRYPTO];
  
  try {
    // Fetch in parallel batches to avoid rate limiting
    const batchSize = 10;
    const quotes: QuoteData[] = [];
    
    for (let i = 0; i < allSymbols.length; i += batchSize) {
      const batch = allSymbols.slice(i, i + batchSize);
      const batchResults = await Promise.all(batch.map(fetchQuote));
      quotes.push(...batchResults.filter((q): q is QuoteData => q !== null));
    }
    
    if (quotes.length === 0) {
      console.log("No market data fetched");
      return "";
    }

    const timestamp = new Date().toISOString();
    console.log(`Fetched ${quotes.length} market quotes`);
    
    // Format data in categories for better AI understanding
    const stockQuotes = quotes.filter(q => TOP_STOCKS.includes(q.symbol));
    const etfQuotes = quotes.filter(q => TOP_ETFS.includes(q.symbol));
    const cryptoQuotes = quotes.filter(q => CRYPTO.includes(q.symbol));
    
    const formatQuote = (q: QuoteData) => {
      const changeStr = q.changePercent >= 0 ? `+${q.changePercent.toFixed(2)}%` : `${q.changePercent.toFixed(2)}%`;
      const distFromHigh = q.high52Week ? ((q.price - q.high52Week) / q.high52Week * 100).toFixed(1) : 'N/A';
      return `${q.symbol} (${q.name}): $${q.price.toFixed(2)} ${changeStr}, 52W High: $${q.high52Week?.toFixed(2) || 'N/A'} (${distFromHigh}% from high), 52W Low: $${q.low52Week?.toFixed(2) || 'N/A'}`;
    };
    
    let marketDataStr = `\n\n=== REAL-TIME MARKET DATA (${timestamp}) ===\n\n`;
    
    if (stockQuotes.length > 0) {
      marketDataStr += `TOP STOCKS:\n${stockQuotes.map(formatQuote).join('\n')}\n\n`;
    }
    
    if (etfQuotes.length > 0) {
      marketDataStr += `ETFs:\n${etfQuotes.map(formatQuote).join('\n')}\n\n`;
    }
    
    if (cryptoQuotes.length > 0) {
      marketDataStr += `CRYPTO:\n${cryptoQuotes.map(formatQuote).join('\n')}\n\n`;
    }
    
    // Add market summary
    const sp500 = etfQuotes.find(q => q.symbol === 'SPY');
    const nasdaq = etfQuotes.find(q => q.symbol === 'QQQ');
    const btc = cryptoQuotes.find(q => q.symbol === 'BTC-USD');
    
    if (sp500 || nasdaq) {
      marketDataStr += `MARKET SUMMARY:\n`;
      if (sp500) marketDataStr += `S&P 500 (SPY): ${sp500.changePercent >= 0 ? '+' : ''}${sp500.changePercent.toFixed(2)}%\n`;
      if (nasdaq) marketDataStr += `NASDAQ (QQQ): ${nasdaq.changePercent >= 0 ? '+' : ''}${nasdaq.changePercent.toFixed(2)}%\n`;
      if (btc) marketDataStr += `Bitcoin: $${btc.price.toLocaleString()} (${btc.changePercent >= 0 ? '+' : ''}${btc.changePercent.toFixed(2)}%)\n`;
    }
    
    return marketDataStr;
  } catch (error) {
    console.error("Error fetching market data:", error);
    return "";
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      console.error("LOVABLE_API_KEY is not configured");
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    console.log("Processing chat request with", messages.length, "messages");

    // Fetch philosophy and market data
    const [philosophy, marketData] = await Promise.all([
      fetchPhilosophy(),
      fetchMarketData()
    ]);
    console.log("Fetched philosophy:", philosophy ? "success" : "none");
    console.log("Fetched market data:", marketData ? "success" : "none");

    const systemPrompt = `You are InvestAI, a professional yet approachable AI investing analyst.

${philosophy}

## STOCK ANALYSIS REQUIREMENTS
When analyzing any specific company or stock:
1. Use historical data combined with future outlook and market sentiment to determine an ideal target price
2. Provide 4-5 sentences of analysis as a stock analyst would, covering:
   - Current standpoint and trajectory
   - Key financial metrics (P/E, revenue growth, margins)
   - Advanced metrics that help with forecasting
   - Clear explanation of why this is a good price target to buy or sell
3. Always include a specific price target with buy/sell recommendation

## REAL-TIME DATA
You have access to real-time market data. ALWAYS use current prices when available.
If a security is not in the data, acknowledge that you don't have current pricing.
${marketData}

## COMMUNICATION GUIDELINES
- Be direct and professional—skip unnecessary fluff
- Use professional language without being overly formal
- No emojis—maintain a clean, professional tone
- End with a brief, practical takeaway`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages.map((m: { role: string; content: string }) => ({
            role: m.role,
            content: m.content,
          })),
        ],
        max_tokens: 1500,
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
      
      throw new Error(`AI Gateway error: ${response.status}`);
    }

    const data = await response.json();
    const aiResponse = data.choices?.[0]?.message?.content || "I couldn't generate a response. Please try again.";
    
    console.log("Successfully generated AI response");

    return new Response(
      JSON.stringify({ response: aiResponse }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in ai-chat function:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error occurred" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
