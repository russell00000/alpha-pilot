import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { z } from "https://esm.sh/zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const RequestSchema = z.object({
  symbol: z.string().min(1).max(15),
  price: z.union([z.number(), z.string()]).optional(),
  change: z.union([z.number(), z.string()]).optional(),
  changePercent: z.number().optional(),
  week52High: z.union([z.number(), z.string()]).optional(),
  week52Low: z.union([z.number(), z.string()]).optional(),
  volume: z.union([z.number(), z.string()]).optional(),
});

// Fetch the investing philosophy from the database (read-only, public endpoint)
async function fetchPhilosophy() {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

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
      console.error("LOVABLE_API_KEY is not configured");
      return new Response(JSON.stringify({ error: "Service temporarily unavailable" }), {
        status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let rawBody: unknown;
    try { rawBody = await req.json(); } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const parsed = RequestSchema.safeParse(rawBody);
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: "Invalid request format" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { symbol, price, change, changePercent, week52High, week52Low, volume } = parsed.data;

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
You are producing an in-depth equity research note. Be rigorous, decisive, and specific.
Cover, at minimum:
1. A clear investment thesis (2-3 sentences) — what is the core view and why.
2. Business overview — what the company does, primary revenue drivers, competitive moat.
3. Fundamental analysis — valuation (P/E vs sector & history), growth, margins, balance sheet, cash flow quality. Reference concrete numbers when possible.
4. Technical & price-action read — trend vs 52-week range, momentum, support/resistance inferred from 52w high/low, volume context.
5. Bull case — 3-4 specific catalysts or drivers that could push the stock to the upside target.
6. Bear case — 3-4 specific risks or headwinds that could derail the thesis.
7. Catalysts to watch — upcoming events, earnings, macro, product cycles.
8. Price target derivation — explain how you arrived at the target (multiple-based, DCF intuition, comp-based) and define a bull / base / bear scenario.
9. Position sizing & risk — suggest how this fits a portfolio given the risk level.
Be decisive. Never hedge with "it depends" — take a stance grounded in the data.

## COMMUNICATION STYLE
${philosophy?.market_insights_style || "Be helpful and informative, communicating at a level that beginners can understand. Be concise and professional."}`;

    const userPrompt = `Produce a deep-dive research note on ${symbol}.

Current Price: $${price}
Daily Change: ${changePercent > 0 ? '+' : ''}${changePercent?.toFixed(2)}%
52-Week High: $${week52High}
52-Week Low: $${week52Low}
Volume: ${volume}

Provide your analysis in the following JSON format only, no other text:
{
  "recommendation": "BUY" or "HOLD" or "SELL",
  "confidence": "HIGH" or "MEDIUM" or "LOW",
  "reasoning": "2-3 sentence executive summary of the investment view.",
  "thesis": "3-4 sentence core investment thesis with the strongest argument for the call.",
  "businessOverview": "2-3 sentences on what the company does, revenue mix, and competitive moat.",
  "fundamentals": "4-6 sentences of fundamental analysis: valuation vs sector and history, growth trajectory, margins, balance sheet quality, cash flow. Reference concrete metrics.",
  "technicals": "3-4 sentences on price action, trend vs 52-week range, momentum, key support/resistance levels, and volume signal.",
  "bullCase": ["specific upside driver 1", "specific upside driver 2", "specific upside driver 3"],
  "bearCase": ["specific risk 1", "specific risk 2", "specific risk 3"],
  "catalysts": ["upcoming catalyst 1 with timing if known", "catalyst 2", "catalyst 3"],
  "priceTarget": number (12-month base-case fair value),
  "bullTarget": number (upside scenario price),
  "bearTarget": number (downside scenario price),
  "priceTargetRationale": "2-3 sentences explaining the methodology behind the price target (multiple-based, DCF intuition, comps).",
  "riskLevel": "LOW" or "MEDIUM" or "HIGH",
  "positionSizing": "1-2 sentence guidance on how this fits a diversified portfolio given the risk level."
}

Return ONLY the JSON. Be decisive, specific, and grounded in the investing philosophy.`;

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
        max_tokens: 2200,
        response_format: { type: "json_object" },
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
      return new Response(JSON.stringify({ error: "AI service unavailable" }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
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
      JSON.stringify({ error: "An error occurred processing your request" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
