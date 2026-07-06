# Improve Accuracy & Loading — Sequenced Plan

Three phases, shipped in order. Each phase is verifiable on its own so we can course-correct.

## Phase 1 — Data Accuracy (screener + fundamentals)

Building on the MU fix. Goal: no more "Strong Buy on a blow-off top" or bogus-margin scores.

1. **Fundamentals sanity, round 2**
   - Reject Yahoo `trailingPE` when it disagrees with `price / trailingEps` by >25% (catches split/adjustment glitches).
   - Cap `revenueGrowth` sanity band tighter (-80%..+150%) and drop rows where reported revenue is null.
   - Add a "stale data" flag: if `fundamentals.updated_at` is >14 days old, exclude from screener rating (row shows "—" instead of Strong Buy).

2. **Technical rubric hardening**
   - Add ATR-based volatility filter: if 20-day ATR% > 8%, cap technical score magnitude at ±1 (whipsaw names shouldn't drive strong ratings).
   - Weight the new SMA-extension penalty higher on names >150% above SMA200 (currently −2; make it −3 tier for ≥2.5×).
   - Renormalize combined score so ratings still map cleanly to ±6.

3. **Price freshness**
   - `sync-technicals` currently trusts one Yahoo batch call. Add fallback to `v8/chart` last close if `regularMarketPrice` is >20% off the last daily candle (catches the MU $975 phantom).

**Verify:** re-run both sync functions on a shard containing MU, NVDA, SMCI, TSLA, GME; confirm ratings are sane; spot-check via the screener UI.

## Phase 2 — Loading Speed

1. **Screener page**
   - Debounce filter inputs (300ms) and cancel in-flight requests on new query.
   - Server-side: add covering index on `screener_view` sort columns (`market_cap`, `combined_score`, `change_pct`) if missing.
   - Client: virtualize the results table (>100 rows) with `@tanstack/react-virtual`.

2. **Markets page**
   - Batch the staggered price fetches into a single `market-data` call per category tab instead of per-symbol.
   - Cache category results in React Query with `staleTime: 60s`.

3. **Stock detail page**
   - Split route: render header + price immediately, lazy-load `ForecastChart` and AI recommendation panels via `React.lazy` + Suspense.
   - Cache historical candles in `sessionStorage` keyed by `symbol+range` for 5 min.

4. **Dashboard / Index**
   - Preload only the top-6 movers query on mount; defer News + Quick Actions to `requestIdleCallback`.
   - Convert `MarketOverview` sparklines to static SVG paths (skip Recharts hydration for the initial paint).

**Verify:** Lighthouse + manual timing before/after on each page; target 40%+ TTI improvement on Screener and Stock detail.

## Phase 3 — AI Analysis Quality

1. **stock-analysis prompt upgrades**
   - Feed the model the same rubric inputs the screener uses (RSI, MACD, SMA extension, margin, growth) so its narrative can't contradict the score.
   - Require the model to explicitly reconcile "score says X, my view is Y, because…" when they diverge — surfaces disagreements as a feature, not a bug.

2. **ai-chat grounding**
   - Pre-fetch current quote + 1yr chart + latest fundamentals for any ticker mentioned in the user message, pass into the system context. Kills the "I don't have current data" hedge.

3. **Consistency check**
   - Add server-side sanity: if AI recommendation is "Strong Buy" but combined_score < 0 (or vice versa), log the divergence and show a small "Analyst view differs from quant score" badge in the UI.

**Verify:** re-run MU, TSLA, NVDA, PLTR through `stock-analysis` and compare narrative vs screener rating.

## Technical notes

- New DB migration: index on `securities_universe(is_active, symbol)` and `screener_view` sort cols.
- No breaking API changes; all edge functions stay backward compatible.
- Rollout: Phase 1 first (deploy → resync fundamentals + technicals full universe → verify). Phase 2 next (frontend-only, safe). Phase 3 last (prompt + logging changes).

## Out of scope

- Adding new data providers (still Yahoo + CoinGecko + Finnhub).
- Redesigning the rating scale itself — keep ±6 combined score and current rating buckets.
- Changing the AI persona or copy tone.

Shall I start with Phase 1?
