import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Fetch real-time market data for context
async function fetchMarketData(): Promise<string> {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY");
    
    if (!supabaseUrl || !supabaseKey) {
      console.log("Supabase credentials not available for market data");
      return "";
    }

    const response = await fetch(`${supabaseUrl}/functions/v1/market-data?type=all`, {
      headers: {
        "Authorization": `Bearer ${supabaseKey}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      console.log("Failed to fetch market data:", response.status);
      return "";
    }

    const data = await response.json();
    
    if (!data.quotes || data.quotes.length === 0) {
      return "";
    }

    // Format market data for the AI context
    const marketSummary = data.quotes
      .filter((q: any) => q.price && q.symbol)
      .map((q: any) => {
        const changeStr = q.changePercent >= 0 ? `+${q.changePercent.toFixed(2)}%` : `${q.changePercent.toFixed(2)}%`;
        return `${q.symbol}: $${q.price.toFixed(2)} (${changeStr})`;
      })
      .join(", ");

    const timestamp = new Date().toISOString();
    return `\n\nCURRENT MARKET DATA (as of ${timestamp}):\n${marketSummary}`;
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

    // Fetch real-time market data
    const marketData = await fetchMarketData();
    console.log("Fetched market data context:", marketData ? "success" : "none");

    const systemPrompt = `You are InvestAI, a professional yet approachable AI investing analyst. You provide clear, actionable market insights in a concise manner.

IMPORTANT: You have access to REAL-TIME market data provided below. When discussing specific stocks or securities, ALWAYS use the current prices from this data. If a security is not in the data, acknowledge that you don't have current pricing for it.

Guidelines:
- Be direct and professional—skip unnecessary fluff
- Keep responses brief: 2-3 sentences for simple questions, 1 short paragraph for complex topics
- ALWAYS use the real-time prices provided when discussing specific securities
- Provide specific insights with relevant data points when discussing stocks or markets
- Focus on what matters: key metrics, catalysts, risks, and opportunities
- Use professional language without being overly formal
- No emojis—maintain a clean, professional tone
- When discussing specific tickers, include the current price from the data provided

What you cover:
- Stock analysis with current prices and key metrics
- Market trends and sector movements
- Portfolio strategy and diversification
- Risk assessment and market dynamics

End with a brief, practical takeaway when relevant. Keep it sharp.${marketData}`;

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
        max_tokens: 1024,
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
