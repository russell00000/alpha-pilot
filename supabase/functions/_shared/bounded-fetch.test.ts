import { expect, test } from "bun:test";
import { createBoundedFetch, DataTimeoutError, FETCH_TIMEOUT_MS, TEMPORARY_DATA_MESSAGE, optionalData } from "./bounded-fetch.ts";
test("every production fetch is limited to 15 seconds", () => { expect(FETCH_TIMEOUT_MS).toBe(15000); });
test("stalled headers fail visibly and abort the request", async () => {
  let signal: AbortSignal | null | undefined;
  const transport = ((_: unknown, init: RequestInit) => { signal = init.signal; return new Promise(() => {}); }) as typeof fetch;
  await expect(createBoundedFetch(transport, 10)("https://example.test")).rejects.toThrow(TEMPORARY_DATA_MESSAGE);
  expect(signal?.aborted).toBe(true);
});
test("stalled response bodies also time out", async () => {
  const transport = (async () => new Response(new ReadableStream({ start() {} }))) as typeof fetch;
  await expect(createBoundedFetch(transport, 10)("https://example.test")).rejects.toBeInstanceOf(DataTimeoutError);
});
test("successful responses preserve status and body", async () => {
  const transport = (async () => new Response('{"value":42}', { status: 201 })) as typeof fetch;
  const response = await createBoundedFetch(transport)("https://example.test");
  expect(response.status).toBe(201); expect(await response.json()).toEqual({ value: 42 });
});
test("optional fields cannot silently swallow timeouts", () => {
  expect(() => optionalData(new DataTimeoutError())).toThrow(TEMPORARY_DATA_MESSAGE);
  expect(optionalData(new Error("missing metric"))).toBeNull();
});