// Generation latency is model-dependent. Do not apply market-fetch deadlines
// to the AI request: they discard valid work before the model can finish.
export function requestAnalysis(
  apiKey: string,
  systemPrompt: string,
  userPrompt: string,
  transport: typeof fetch = fetch,
): Promise<Response> {
  return transport("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      max_tokens: 1300,
      response_format: { type: "json_object" },
    }),
  });
}