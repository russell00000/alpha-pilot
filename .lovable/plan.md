# Full US-Listed Screener (~8,000 symbols)

Move the Screener off live per-request Yahoo fetches and onto a cached, server-paginated architecture backed by frequent syncs.

## Architecture

```text
NASDAQ Trader FTP ──► sync-universe ──► securities_universe (~8k rows)
                                             │
                     ┌───────────────────────┴─────────────────┐
                     ▼                                          ▼
              sync-fundamentals (minutely)          sync-technicals (minutely)
                     │                                          │
                     ▼                                          ▼
                fundamentals table                     technicals table
                                    │
                                    ▼
                         screener edge fn (paginated, filtered, sorted)
                                    │
                                    ▼
                              Screener UI
```

Live Yahoo calls in the request path are removed. Everything the Screener shows comes from three DB tables joined server-side.

## What ships

**1. New table `securities_universe**`
`symbol` (PK), `name`, `exchange` (NASDAQ/NYSE/AMEX), `asset_type` (stock/etf), `is_active`, `updated_at`. GRANT SELECT to anon/authenticated.

**2. New table `technicals**`
`symbol` (PK), `price`, `change_pct`, `volume`, `rsi_14`, `macd`, `macd_signal`, `sma_50`, `sma_200`, `market_cap`, `updated_at`. GRANT SELECT to anon/authenticated.

**3. `fundamentals` table** — already exists, keep as-is.

**4. New edge function `sync-universe**` (weekly)
Fetches NASDAQ Trader's public symbol files (`nasdaqlisted.txt`, `otherlisted.txt`) — free, no auth, no rate limit. Parses ~11k rows, filters test issues/warrants/rights, upserts into `securities_universe`. Marks stale rows `is_active=false`.

**5. Rewrite `sync-fundamentals**`
Source symbols from `securities_universe` instead of the static list. Chunked runs: accept `{offset, limit}` in body so cron can invoke it in 4 shards (~2k symbols each) staggered 15 min apart to stay under Yahoo's tolerance. Concurrency 8, jittered throttle.

**6. New edge function `sync-technicals**` (nightly)
For each symbol in `securities_universe`, fetches Yahoo `chart?range=1y&interval=1d` (batchable via v7 quote for price/volume/marketCap). Computes RSI(14), MACD(12,26,9), SMA50, SMA200 in-code and upserts. Same sharded pattern as fundamentals.

**7. New edge function `screener**`
Request: `{ q?, sector?, minMarketCap?, maxPE?, minScore?, rating?, sort, dir, page, pageSize }`.
Query joins `securities_universe + fundamentals + technicals`, applies filters + sort in SQL, returns one page (default 50, max 200) + total count. All scoring math (technical/fundamental/combined) computed in the function so the UI just renders.

**8. Rubric recentering** (from prior turn, applied in `screener` fn)

- Profit margin: ≥20% = +1, ≥30% = +2, <10% = -1, <0 = -2
- Debt/Equity: ≤0.3 = +1, ≤0.1 = +2, >1 = -1, >2 = -2
- Revenue growth: ≥15% = +1, ≥25% = +2, <5% = -1, <0 = -2
- P/E vs **fixed benchmark 20** (not response average): <15 = +1, <10 = +2, >30 = -1, >45 = -2
- EPS streak: unchanged

**9. Cron jobs**

```
sync-universe        weekly Sunday 05:00 UTC
sync-fundamentals    daily 06:15 UTC, sharded 0/2000/4000/6000 at :15/:30/:45/07:00
sync-technicals      daily 07:15 UTC, same 4-shard pattern
```

**10. Screener UI rewrite (`src/pages/Screener.tsx`)**

- Debounced search input, sector dropdown, rating filter, min market cap slider — all trigger new `screener` edge fn call.
- Server-side sort (click column headers).
- Pagination: 50/page, prev/next + page count.
- Remove all client-side scoring — rows come pre-scored.

**11. First-run bootstrap**
Manual invoke of `sync-universe`, then `sync-fundamentals` shards, then `sync-technicals` shards so the table is populated immediately.

## Technical section

- **NASDAQ Trader source**: `https://www.nasdaqtrader.com/dynamic/SymDir/nasdaqlisted.txt` and `otherlisted.txt`. Pipe-delimited, updated daily.
- **Yahoo capacity**: `quoteSummary` sustains ~5-8 req/s with crumb rotation. 8k symbols / 6 concurrency / ~200ms avg = ~5 min per shard, well under function timeout.
- **v7 `quote` batch**: up to ~200 symbols per call for price/volume/marketCap — used in `sync-technicals` to avoid 8k individual calls for basic quote data. Chart calls (for RSI/MACD) are still per-symbol but only for the ~4k stocks with fundamentals (skip ETFs' MACD).
- **DB size**: 8k × ~250 bytes ≈ 2 MB per table. Trivial.
- **Failure handling**: any symbol that fails Yahoo keeps its previous row (upsert, no delete). Missing rows in join → row still shown with null scores.

## Trade-offs

- Nightly staleness (fine — RSI/MACD move slowly enough; users see intraday price via existing detail page).
- First full sync will take ~30-40 min end-to-end across all shards.
- No live intraday price on the Screener list (was already stale-ish given caching). Detail page still uses live data.
- Yahoo TOS is a grey area at this scale; if we hit sustained blocks we'll need to add Alpha Vantage as fallback for the batch quote step.

## What ships in this change

- Migrations: `securities_universe`, `technicals` tables + GRANTs + RLS
- New edge functions: `sync-universe`, `sync-technicals`, `screener`
- Updated `sync-fundamentals` (sharded, sources from universe)
- Updated cron schedule
- Rewritten `Screener.tsx` (server-paginated, filter/sort UI)
- Deprecated: live Yahoo fetch path in `market-data` screener branch (kept for other callers)
- Manual first-run triggers for all three sync jobs