import { requestAnalysis } from "./ai-request.ts";

Deno.test("stock analysis awaits generation without an automatic abort deadline", async () => {
  let completed = false;
  const transport: typeof fetch = async (url, init) => {
    if (String(url) !== "https://ai.gateway.lovable.dev/v1/chat/completions") throw new Error("Wrong endpoint");
    if (init?.signal) throw new Error("Generation must not have a timer-driven abort signal");
    const body = JSON.parse(String(init?.body));
    if (body.model !== "google/gemini-2.5-flash" || body.max_tokens !== 1300) throw new Error("Existing model and output limit must be preserved");
    await new Promise((resolve) => setTimeout(resolve, 20));
    completed = true;
    return new Response(JSON.stringify({ choices: [{ message: { content: '{"recommendation":"HOLD"}' } }] }));
  };
  const response = await requestAnalysis("test-key", "system", "user", transport);
  if (!completed || response.status !== 200) throw new Error("Generation was not awaited");
  const body = await response.json();
  if (JSON.parse(body.choices[0].message.content).recommendation !== "HOLD") throw new Error("Lost generated analysis");
});

Deno.test("stock analysis preserves upstream failure status without retrying", async () => {
  let calls = 0;
  const response = await requestAnalysis("test-key", "system", "user", async () => {
    calls++;
    return new Response('{"error":"Rate limited"}', { status: 429 });
  });
  if (calls !== 1 || response.status !== 429) throw new Error("Upstream failure was retried or hidden");
});