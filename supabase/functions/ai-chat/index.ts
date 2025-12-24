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

// Fetch real-time market data directly from Yahoo Finance
async function fetchMarketData(): Promise<string> {
  const symbols = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA', 'JPM', 'V', 'UNH', 'SPY', 'QQQ', 'VOO', 'BTC-USD', 'ETH-USD'];
  
  try {
    const quotes: string[] = [];
    
    for (const symbol of symbols) {
      try {
        const response = await fetch(
          `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1d`,
          {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
          }
        );
        
        if (response.ok) {
          const data = await response.json();
          const result = data.chart?.result?.[0];
          if (result) {
            const meta = result.meta;
            const price = meta.regularMarketPrice || meta.previousClose;
            const previousClose = meta.chartPreviousClose || meta.previousClose;
            const change = price && previousClose ? ((price - previousClose) / previousClose) * 100 : 0;
            const changeStr = change >= 0 ? `+${change.toFixed(2)}%` : `${change.toFixed(2)}%`;
            quotes.push(`${symbol}: $${price?.toFixed(2)} (${changeStr})`);
          }
        }
      } catch (e) {
        console.log(`Failed to fetch ${symbol}:`, e);
      }
    }
    
    if (quotes.length === 0) {
      console.log("No market data fetched");
      return "";
    }

    const timestamp = new Date().toISOString();
    console.log(`Fetched ${quotes.length} market quotes`);
    return `\n\nCURRENT REAL-TIME MARKET DATA (as of ${timestamp}):\n${quotes.join(", ")}`;
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
