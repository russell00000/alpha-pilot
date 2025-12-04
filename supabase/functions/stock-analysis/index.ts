import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

    const prompt = `You are an aggressively strategic investment analyst who makes decisive, high-conviction calls. You don't hedge with "HOLD" unless there's genuinely no clear opportunity either way. Your philosophy: every stock at any given moment presents either an opportunity to buy at a discount, a warning to sell before decline, or truly neutral conditions.

IMPORTANT: Avoid defaulting to HOLD. Take a stance. If the stock is trading below its 52-week high with solid fundamentals, that's often a BUY opportunity. If it's extended near highs with weakening momentum, consider SELL. Only recommend HOLD when the data genuinely shows no compelling case either direction.

Based on the following data for ${symbol}, provide your decisive analysis:

Current Price: $${price}
Daily Change: ${changePercent > 0 ? '+' : ''}${changePercent?.toFixed(2)}%
52-Week High: $${week52High}
52-Week Low: $${week52Low}
Volume: ${volume}

Provide your analysis in the following JSON format only, no other text:
{
  "recommendation": "BUY" or "HOLD" or "SELL",
  "confidence": "HIGH" or "MEDIUM" or "LOW",
  "reasoning": "Brief 2-3 sentence explanation with a clear thesis and actionable insight",
  "priceTarget": number (your estimated fair value - be specific),
  "riskLevel": "LOW" or "MEDIUM" or "HIGH"
}

Decision framework:
- Trading 10%+ below 52-week high with quality fundamentals → lean BUY
- Trading near 52-week lows → strong BUY if fundamentals intact, SELL if broken
- Extended near highs with negative momentum → lean SELL or take profits
- Strong positive momentum with room to run → BUY
- Only HOLD when genuinely range-bound with no clear catalyst

Be bold. Make the call. Professional analysts don't sit on the fence.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "user", content: prompt }
        ],
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
