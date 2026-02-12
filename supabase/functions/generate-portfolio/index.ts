import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AssessmentData {
  dateOfBirth: string;
  riskTolerance: string;
  investmentTimeline: string;
  investmentGoal: string;
  investmentExperience: string;
  incomeStability: string;
  investmentAmount: number;
  recurringInvestment: boolean;
  recurringAmount?: number;
  recurringFrequency?: string;
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

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { assessment } = await req.json() as { assessment: AssessmentData };

    console.log("Generating portfolio for assessment:", assessment);

    // Fetch the creator's investing philosophy
    const { data: philosophy, error: philError } = await supabase
      .from("investing_philosophy")
      .select("*")
      .limit(1)
      .single();

    if (philError) {
      console.error("Error fetching philosophy:", philError);
      throw new Error("Could not fetch investing philosophy");
    }

    console.log("Using philosophy:", philosophy);

    // Calculate age
    const today = new Date();
    const birth = new Date(assessment.dateOfBirth);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }

    const systemPrompt = `You are an AI investment advisor developed and trained by an expert investor. Your recommendations reflect their unique investing philosophy and approach.

## CREATOR'S INVESTING PHILOSOPHY
${philosophy.philosophy_text}

## RISK GUIDANCE PRINCIPLES
${philosophy.risk_guidance}

## ASSET ALLOCATION RULES - CRITICAL: FOLLOW THESE EXACTLY
${philosophy.asset_allocation_rules}

## COMMUNICATION STYLE
${philosophy.market_insights_style}

## CRITICAL RULES YOU MUST FOLLOW:
1. **NEVER include cryptocurrency or stablecoins** (e.g. BTC, ETH, USDC, USDT, SOL, etc.) in any portfolio. Crypto assets must never appear in holdings or alternatives. If a user's profile suggests alternatives, use REITs, commodities, or gold instead.
2. **INDIVIDUAL STOCKS vs ETFs ARE DIFFERENT** - The allocation rules specify INDIVIDUAL STOCKS (like AAPL, NVDA, MSFT, GOOGL) separately from ETFs (like SPY, QQQ, VTI).
3. For AGGRESSIVE profiles: You MUST recommend 50-70% in INDIVIDUAL STOCK TICKERS (not ETFs). ETFs should only be 10-30% max.
4. For MODERATE profiles: Individual stocks 25-45%, ETFs 35-55%.
5. For CONSERVATIVE profiles: Individual stocks 0-15%, ETFs 50-70%.
6. **DO NOT substitute ETFs for individual stocks** - They are NOT interchangeable. If the rules say "individual stocks", you must recommend actual company stock tickers.
7. Always include the "type" field to distinguish between "stock" (individual company) and "etf".

You must respond with ONLY valid JSON matching this exact structure (no markdown, no code blocks, just raw JSON):
{
  "allocation": {
    "stocks": <number 0-100>,
    "bonds": <number 0-100>,
    "cash": <number 0-100>,
    "alternatives": <number 0-100>
  },
  "holdings": [
    {
      "symbol": "<ticker>",
      "name": "<full name>",
      "type": "<stock|etf|bond|cash|alternative>",
      "category": "<Stock|ETF|Bond|Cash|Alternative>",
      "allocation": <number 0-100>,
      "expenseRatio": "<e.g. 0.03% for ETFs, N/A for stocks>",
      "description": "<brief description of why this pick>"
    }
  ],
  "rationale": "<2-3 sentences max: brief summary of why this portfolio fits the user>",
  "marketInsights": "<current market context and educational content>",
  "riskAnalysis": "<analysis of their risk profile and what it means for their investments>"
}

The allocation percentages must sum to 100. Holdings allocations must also sum to 100. Use real tickers that exist.
REMEMBER: Individual stocks (AAPL, NVDA, MSFT, etc.) are NOT the same as ETFs (SPY, QQQ, etc.). Follow the allocation rules precisely.`;

    const userPrompt = `Generate a personalized portfolio recommendation for this investor:

- Age: ${age} years old
- Risk Tolerance: ${assessment.riskTolerance}
- Investment Timeline: ${assessment.investmentTimeline}
- Investment Goal: ${assessment.investmentGoal}
- Investment Experience: ${assessment.investmentExperience}
- Income Stability: ${assessment.incomeStability}
- Initial Investment Amount: $${assessment.investmentAmount.toLocaleString()}
${assessment.recurringInvestment ? `- Recurring Investment: $${assessment.recurringAmount?.toLocaleString()} ${assessment.recurringFrequency}` : "- No recurring investment planned"}

Based on the creator's investing philosophy, provide a tailored portfolio allocation, specific fund recommendations, a personalized rationale, market insights, and risk analysis.`;

    console.log("Calling Lovable AI...");

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
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits to continue." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const aiResponse = await response.json();
    const content = aiResponse.choices?.[0]?.message?.content;

    console.log("AI response content:", content);

    if (!content) {
      throw new Error("No content in AI response");
    }

    // Parse the JSON response
    let recommendation;
    try {
      // Try to extract JSON from potential markdown code blocks
      let jsonStr = content;
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        jsonStr = jsonMatch[1].trim();
      }
      recommendation = JSON.parse(jsonStr);
    } catch (parseError) {
      console.error("Failed to parse AI response:", parseError);
      throw new Error("Invalid AI response format");
    }

    // Validate the response structure - support both "holdings" and legacy "funds"
    if (!recommendation.allocation || (!recommendation.holdings && !recommendation.funds) || !recommendation.rationale) {
      throw new Error("Incomplete AI response");
    }
    
    // Normalize to "funds" for backward compatibility with frontend
    if (recommendation.holdings && !recommendation.funds) {
      recommendation.funds = recommendation.holdings;
    }

    // Strip any crypto/stablecoin holdings that may have slipped through
    const CRYPTO_BLACKLIST = new Set(["BTC", "ETH", "SOL", "XRP", "ADA", "DOGE", "DOT", "AVAX", "LINK", "MATIC", "USDC", "USDT", "DAI", "BUSD", "WBTC", "SHIB"]);
    recommendation.funds = recommendation.funds.filter((f: any) => !CRYPTO_BLACKLIST.has(f.symbol?.toUpperCase()));

    // Redistribute any removed allocation proportionally
    const totalAlloc = recommendation.funds.reduce((sum: number, f: any) => sum + (f.allocation || 0), 0);
    if (totalAlloc > 0 && totalAlloc < 100) {
      const scale = 100 / totalAlloc;
      recommendation.funds.forEach((f: any) => { f.allocation = Math.round(f.allocation * scale); });
      // Fix rounding
      const diff = 100 - recommendation.funds.reduce((sum: number, f: any) => sum + f.allocation, 0);
      if (diff !== 0 && recommendation.funds.length > 0) {
        recommendation.funds[0].allocation += diff;
      }
    }

    console.log("Generated recommendation:", recommendation);

    return new Response(JSON.stringify(recommendation), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in generate-portfolio:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
