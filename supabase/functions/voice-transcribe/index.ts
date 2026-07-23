import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

// Accepts multipart/form-data with an `audio` file part, forwards it to the
// Lovable AI Gateway speech-to-text endpoint, and returns { text }.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");

    const form = await req.formData();
    const audio = form.get("audio");
    if (!(audio instanceof File) || audio.size < 1024) {
      return new Response(
        JSON.stringify({ error: "Recording was empty. Please try again." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Name the upload after its real container so the STT provider can decode it.
    const type = (audio.type || "audio/webm").split(";")[0];
    const ext =
      type === "audio/mp4" || type === "audio/x-m4a" || type === "audio/aac"
        ? "mp4"
        : type === "audio/mpeg"
          ? "mp3"
          : type === "audio/wav" || type === "audio/x-wav"
            ? "wav"
            : "webm";

    const upstream = new FormData();
    upstream.append("model", "openai/gpt-4o-mini-transcribe");
    upstream.append("file", audio, `recording.${ext}`);

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: upstream,
    });

    if (!resp.ok) {
      const detail = await resp.text().catch(() => "");
      console.error("STT gateway error", resp.status, detail);
      return new Response(
        JSON.stringify({ error: "Transcription failed", status: resp.status, detail }),
        { status: resp.status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const json = await resp.json();
    return new Response(JSON.stringify({ text: json.text ?? "" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("voice-transcribe error", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});