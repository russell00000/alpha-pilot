import { expect, test } from "bun:test";
import { createTreasuryLoader, TREASURY_CACHE_TTL_MS, type TreasuryRecord } from "./treasury-cache.ts";
const now = Date.parse("2026-11-02T20:00:00Z");
const row: TreasuryRecord = { rate: .0494, observation_date: "2026-10-30", source: "Treasury", refreshed_at: new Date(now - 1000).toISOString() };
const xml = '<entry><NEW_DATE>2026-11-02</NEW_DATE><BC_10YEAR>4.50</BC_10YEAR></entry>';
test("fresh persisted Treasury yields skip external fetch for exactly 24 hours", async () => {
  expect(TREASURY_CACHE_TTL_MS).toBe(86400000);
  let calls = 0;
  const fetcher = (async () => { calls++; return new Response(xml); }) as typeof fetch;
  const load = createTreasuryLoader({ read: async () => ({ ...row, refreshed_at: new Date(now - 86400000 + 1).toISOString() }), write: async () => {} }, fetcher, () => now);
  expect((await load()).cache.hit).toBe(true); expect(calls).toBe(0);
});
test("24-hour expiry refreshes once and persists the true fetch timestamp", async () => {
  let saved: TreasuryRecord | null = null, calls = 0;
  const load = createTreasuryLoader({ read: async () => ({ ...row, refreshed_at: new Date(now - 86400000).toISOString() }), write: async value => { saved = value; } }, (async () => { calls++; return new Response(xml); }) as typeof fetch, () => now);
  const result = await load(); expect(calls).toBe(1); expect(result.rate).toBe(.045);
  expect(result.refreshed_at).toBe("2026-11-02T20:00:00.000Z"); expect(saved).toMatchObject({ rate: .045, observation_date: "2026-11-02" });
});
test("cold failures do not stack retries", async () => {
  let calls = 0;
  const load = createTreasuryLoader({ read: async () => null, write: async () => {} }, (async () => { calls++; throw new Error("Data temporarily unavailable, try again."); }) as typeof fetch, () => now);
  await expect(load()).rejects.toThrow("Data temporarily unavailable"); expect(calls).toBe(1);
});
test("failed refresh reuses marked last successful yield without resetting timestamp", async () => {
  const stale = { ...row, refreshed_at: new Date(now - 86400000).toISOString() };
  let writes = 0;
  const load = createTreasuryLoader({ read: async () => stale, write: async () => { writes++; } }, (async () => { throw new Error("upstream unavailable"); }) as typeof fetch, () => now);
  const result = await load(); expect(result.cache.stale).toBe(true); expect(result.refreshed_at).toBe(stale.refreshed_at); expect(writes).toBe(0);
});
test("simultaneous cold requests share one in-flight refresh", async () => {
  let calls = 0;
  const load = createTreasuryLoader({ read: async () => null, write: async () => {} }, (async () => { calls++; await new Promise(r=>setTimeout(r,10)); return new Response(xml); }) as typeof fetch, () => now);
  await Promise.all([load(), load(), load()]); expect(calls).toBe(1);
});