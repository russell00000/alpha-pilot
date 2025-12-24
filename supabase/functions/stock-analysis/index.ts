import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Fetch the investing philosophy from the database
async function fetchPhilosophy() {
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
      return null;
    }

    return philosophy;
  } catch (error) {
    console.error("Error fetching philosophy:", error);
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const { symbol, price, change, changePercent, week52High, week52Low, volume } = await req.json();
    
    if (!symbol) {
      throw new Error("Symbol is required");
    }

    console.log(`Analyzing ${symbol}: price=${price}, change=${changePercent}%, 52wHigh=${week52High}, 52wLow=${week52Low}`);

    // Fetch the investing philosophy
    const philosophy = await fetchPhilosophy();
    console.log("Fetched philosophy:", philosophy ? "success" : "none");

    const systemPrompt = `You are an expert investment analyst following a specific investing philosophy.

## YOUR INVESTING PHILOSOPHY
${philosophy?.philosophy_text || "Focus on capital preservation and growth through research-driven analysis."}

## RISK GUIDANCE
${philosophy?.risk_guidance || "Risk should be balanced with reward potential. Ideal risk to reward ratio is 1:3."}

## ANALYSIS REQUIREMENTS
When providing analysis on a company:
1. Use historical data combined with future outlook and market sentiment to determine an ideal target price
2. Provide 4-5 sentences of analysis as a stock analyst would, covering:
   - Current standpoint and trajectory
   - Key financial metrics and valuation
   - Advanced metrics that help with forecasting
   - Clear explanation of why this is a good price target to buy or sell
3. Be decisive - take a clear stance based on the data

## COMMUNICATION STYLE
${philosophy?.market_insights_style || "Be helpful and informative, communicating at a level that beginners can understand. Be concise and professional."}`;

    const userPrompt = `Analyze ${symbol} and provide your recommendation:

Current Price: $${price}
Daily Change: ${changePercent > 0 ? '+' : ''}${changePercent?.toFixed(2)}%
52-Week High: $${week52High}
52-Week Low: $${week52Low}
Volume: ${volume}

Provide your analysis in the following JSON format only, no other text:
{
  "recommendation": "BUY" or "HOLD" or "SELL",
  "confidence": "HIGH" or "MEDIUM" or "LOW",
  "reasoning": "4-5 sentences of detailed analysis covering current standpoint, trajectory, key metrics, and why this price target makes sense. Include specific insights about valuation and growth potential.",
  "priceTarget": number (your estimated fair value based on analysis),
  "riskLevel": "LOW" or "MEDIUM" or "HIGH"
}

Be decisive and provide actionable insights based on the investing philosophy.`;

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
          { role: "user", content: userPrompt }
        ],
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Credits exhausted. Please add funds to continue." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const aiResponse = await response.json();
    const content = aiResponse.choices?.[0]?.message?.content || "";
    
    console.log("AI response:", content);

    // Parse the JSON from the response
    let analysis;
    try {
      // Try to extract JSON from the response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        analysis = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("No JSON found in response");
      }
    } catch (parseError) {
      console.error("Failed to parse AI response:", parseError);
      // Return a default analysis if parsing fails
      analysis = {
        recommendation: "HOLD",
        confidence: "LOW",
        reasoning: "Unable to generate analysis at this time.",
        priceTarget: parseFloat(price) || 0,
        riskLevel: "MEDIUM"
      };
    }

    return new Response(
      JSON.stringify({ data: analysis }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Stock analysis error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
