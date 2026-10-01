# Experience Improvements — Vantage Portfolio Solutions

A prioritized set of upgrades to make the site feel faster, more polished, and more trustworthy. Pick any subset; they're independent.

## 1. Speed & smoothness (highest impact)
- **Skeleton screens everywhere:** replace spinners/blank areas on Markets, Stock, Screener, and Portfolio with shimmer placeholders shaped like the final content, so pages never feel empty while data loads.
- **Optimistic navigation:** prefetch the stock page's data when a search suggestion or table row is hovered, so clicking feels instant.
- **Price flash feedback:** when a live price updates, briefly tint the number green/red so changes are visible without watching.

## 2. Trust & clarity
- **"As of" timestamps:** show when each price/quote was last updated, with a subtle "LIVE" pulse when data is fresh and "Delayed" when stale.
- **Rating explainability:** on every Buy/Hold/Sell badge, add a small "Why?" popover summarizing the 2–3 factors that drove the rating (from the v2.0 rubric) — no strategy disclosure, just the headline reasons.
- **Empty states:** friendly, on-brand empty states for Portfolio, Alerts, and Chat history instead of blank panels.

## 3. Mobile experience
- Audit Markets, Screener, and Stock pages on phone widths: sticky table headers, horizontally scrollable stat rows, and a bottom nav bar for the main sections.

## 4. Personal touches
- **Watchlist:** star any security from search or the stock page; a Watchlist strip on the Markets page shows your starred tickers with live prices.
- **Remember preferences:** persist chart timeframe, screener filters, and Markets tab per user so the site picks up where you left off.

## 5. Polish
- Keyboard navigation: arrow keys through search suggestions, Enter to open, "/" to focus search from anywhere.
- Subtle number transitions (count-up) on portfolio totals and index values instead of abrupt swaps.

## Technical notes
- All frontend work in existing pages/components; no schema changes except a `watchlists` table (with RLS + grants) if item 4 is approved.
- Respects existing rules: no hover movement on panes, no per-frame background animation, dark platinum/gold design system.

## Suggested order
1 → 2 → 4 → 3 → 5, but any item can be done standalone.
