# Fundamental Scoring Layer

Add the five-metric fundamental framework on top of the existing technical scoring and blend them 60/40 into a Combined Score displayed on the Screener.

## Architecture

Fetching Yahoo `quoteSummary` per symbol at request time would take ~30s for a 700-symbol universe (per-symbol endpoint, no batch). Instead, cache fundamentals in a DB table refreshed daily by cron — the Screener joins them into results with zero added latency.

```text
 ┌──────────────┐   daily 6am    ┌─────────────────┐
 │  sync-       │ ─────────────► │  fundamentals    │
 │  fundamentals│                │  DB table        │
 └──────────────┘                └────────┬────────┘
                                          │ join by symbol
                                          ▼
 ┌──────────────┐  screener call ┌─────────────────┐
 │  Screener UI │ ─────────────► │  market-data    │
 └──────────────┘                └─────────────────┘
```

## Implementation

**1. `fundamentals` DB table (migration)**
Columns: `symbol` (PK), `revenue_growth`, `profit_margins`, `debt_to_equity`, `eps_beat_streak`, `eps_miss_streak`, `pe_ratio`, `sector`, `updated_at`. RLS + `GRANT SELECT` to anon/authenticated (read-only reference data).

**2. New `sync-fundamentals` edge function**
Reads the union of static universe + `securities` table, fetches Yahoo `quoteSummary?modules=financialData,earningsHistory,summaryProfile` per symbol with concurrency 10, upserts into `fundamentals`. Extracts:
- `revenueGrowth` (YoY), `profitMargins`, `debtToEquity`
- Last 4 quarters' EPS surprise → count consecutive beats/misses from most recent
- `sector` (for sector-avg P/E)

**3. Daily cron**
Extend the existing `pg_cron` job (already runs `sync-ipos` at 06:00 UTC) to also call `sync-fundamentals` at 06:15 UTC.

**4. Extend `market-data` screener branch**
After the technical enrichment, `SELECT * FROM fundamentals WHERE symbol = ANY(...)` and merge fields into each row. Compute sector average P/E in-memory across the response and include it as `sectorAvgPE` on each row.

**5. Rewrite scoring in `src/pages/Screener.tsx`**
Replace `vantageScore` with three functions:
- `technicalScore(r)` → -6..+6 (RSI + MACD + MA, no rating mapping)
- `fundamentalScore(r, sectorAvgPE)` → sum five -2..+2 metrics (-10..+10), normalize `× 6/10` → -6..+6
- `combinedScore(t, f)` → `t*0.4 + f*0.6`, map to rating using user's thresholds (+4 SB, +2 B, ±1.9 H, -2 S, -4 SS)

Analyst-consensus signal is removed from the composite (now covered by fundamentals + user's original framework).

**6. Screener UI**
Add three columns to the table: `Tech`, `Fund`, `Score` (combined). The existing rating column keeps working, now derived from Combined Score. Table gets slightly wider — condense a couple of existing narrow columns.

## What ships in this change

- New migration: `fundamentals` table + GRANTs + RLS
- New edge function: `sync-fundamentals`
- Cron entry pointing at it
- Manual first-run trigger of `sync-fundamentals` so data is available immediately
- Updated `market-data` (screener path + response shape)
- Updated `Screener.tsx` (scoring + 3 new columns)

## Trade-offs / caveats

- Fundamentals are up to 24h stale (acceptable — these metrics change on quarterly cadence).
- P/E-vs-sector uses the average across the current universe response, not a true broad-sector average. Close enough; a truer number would require an external sector-benchmark data source.
- EPS beat/miss "streak" is computed from Yahoo's last 4 earnings surprises — so max detectable streak is 4, not the "3+ consecutive" the framework mentions unbounded. Scored the same either way (+2 for 3+).
- First `sync-fundamentals` run will take ~2–3 minutes to warm the cache for 700 symbols; subsequent daily runs are the same but scheduled off-peak.
