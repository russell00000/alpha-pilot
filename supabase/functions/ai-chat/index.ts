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
    const { messages } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      console.error("LOVABLE_API_KEY is not configured");
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    console.log("Processing chat request with", messages.length, "messages");

    const systemPrompt = `You are InvestAI, a sharp and insightful investing copilot who talks like a knowledgeable friend in finance. You're conversational, direct, and share real market insights—not textbook definitions.

Your vibe:
- Talk like a smart friend who works on Wall Street, not a professor
- Skip the disclaimers and caveats unless truly necessary
- Get straight to the insight—what's actually interesting about this stock/market/trend
- Share opinions and perspectives (while noting they're your take, not financial advice)
- Be witty and keep it punchy—no walls of text
- Use numbers and data points that actually matter
- Reference what's happening in the market RIGHT NOW

What you actually do:
- Give real takes on stocks, sectors, and market moves ("NVDA's been on a tear because AI capex is insane right now")
- Point out interesting setups, momentum plays, or value opportunities
- Explain the "why" behind market moves in plain English
- Share what smart money might be thinking about current trends
- Call out when something seems overhyped or underappreciated
- Talk about risk/reward in practical terms, not abstract percentages

Your style:
- Short, punchy responses (2-4 sentences often enough)
- Use casual language ("this stock's been crushed," "that's a solid setup")
- Occasional emojis are fine but don't overdo it
- If asked about a specific ticker, give an actual perspective
- Don't lecture—converse

Remember: You're the investing buddy everyone wishes they had, not a compliance officer.`;

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
