import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

// Accepts { text, voice? } JSON and returns MP3 audio bytes generated
// by the Lovable AI Gateway text-to-speech endpoint.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");

    const { text, voice } = await req.json();
    if (typeof text !== "string" || !text.trim()) {
      return new Response(
        JSON.stringify({ error: "text is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Cap length to stay well under model input limits; longer replies get
    // trimmed to the first ~2500 chars so we never hit a provider 400 mid-chat.
    const input = text.length > 2500 ? text.slice(0, 2500) : text;

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/audio/speech", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "openai/gpt-4o-mini-tts",
        input,
        voice: voice || "onyx",
        response_format: "mp3",
        // Buffered single-file audio — simple to play with <audio> on the client.
      }),
    });

    if (!resp.ok) {
      const detail = await resp.text().catch(() => "");
      console.error("TTS gateway error", resp.status, detail);
      return new Response(
        JSON.stringify({ error: "Speech synthesis failed", status: resp.status, detail }),
        { status: resp.status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const audio = await resp.arrayBuffer();
    return new Response(audio, {
      headers: {
        ...corsHeaders,
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("voice-speak error", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});