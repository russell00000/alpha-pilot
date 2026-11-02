import { parseTreasuryYield } from "./treasury.ts";
export const TREASURY_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
export interface TreasuryRecord { rate: number; observation_date: string; source: string; refreshed_at: string }
export interface TreasuryStore {
  read(): Promise<TreasuryRecord | null>;
  write(value: TreasuryRecord): Promise<void>;
}
const valid = (row: TreasuryRecord | null): row is TreasuryRecord => Boolean(row && Number.isFinite(row.rate) && row.rate >= 0 && row.rate <= 1 && Number.isFinite(Date.parse(row.refreshed_at)) && /^\d{4}-\d{2}-\d{2}$/.test(row.observation_date));
export function createTreasuryLoader(store: TreasuryStore, transport: typeof fetch, clock = Date.now) {
  let pending: Promise<ReturnType<typeof result>> | undefined;
  function result(row: TreasuryRecord, hit: boolean, stale = false) {
    return { rate: row.rate, date: row.observation_date, source: row.source, refreshed_at: row.refreshed_at,
      cache: { hit, stale, expires_at: new Date(Date.parse(row.refreshed_at) + TREASURY_CACHE_TTL_MS).toISOString() } };
  }
  return async () => {
    const cached = await store.read();
    if (valid(cached) && clock() - Date.parse(cached.refreshed_at) >= 0 && clock() - Date.parse(cached.refreshed_at) < TREASURY_CACHE_TTL_MS) return result(cached, true);
    if (pending) return pending;
    pending = (async () => {
      // One request, one timeout; no inner retry and no outer prior-year retry.
      const year = new Date(clock()).getUTCFullYear();
      const source = `https://home.treasury.gov/resource-center/data-chart-center/interest-rates/pages/xml?data=daily_treasury_yield_curve&field_tdr_date_value=${year}`;
      try {
        const response = await transport(source, { headers: { "User-Agent": "Mozilla/5.0", Accept: "application/xml" } });
        if (!response.ok) throw new Error(`Treasury yield request failed (${response.status}).`);
        const parsed = parseTreasuryYield(await response.text());
        const row = { rate: parsed.rate, observation_date: parsed.date, source, refreshed_at: new Date(clock()).toISOString() };
        await store.write(row);
        return result(row, false);
      } catch (error) {
        // Keep last-success provenance/date intact; never present stale data as newly refreshed.
        if (valid(cached)) return result(cached, true, true);
        throw error;
      }
    })();
    try { return await pending; } finally { pending = undefined; }
  };
}