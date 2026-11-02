# Vantage DCF Phase 1
- [x] Add authenticated SEC lookup and service-only raw-response caches.
- [x] Extract nine requested financial fields with annual-period provenance and missing-field reporting.
- [x] Run 18 extraction tests and verify all nine fields against live Apple SEC data.
- [x] Verify authenticated deployed lookup and repeat-lookup cache reuse — Apple cold lookup returned 200, repeat lookup returned a cache hit with identical nine fields and unchanged fetch time.
- [x] Add ordered total-debt fallbacks with matching filing provenance; all 24 tests passed and authenticated live cached AAPL lookup returned $90,678,000,000 for FY2025.

# Vantage DCF Phase 2
- [x] Extend audited SEC extraction for four-year revenue/EBIT, two-year current assets/liabilities, and interest expense.
- [x] Add exact DCF engine, Treasury yield lookup, existing live quotes, and formula/validation tests; 34 tests passed.
- [x] Add beta input, Run DCF, and plain result cards on Markets.
- [x] Verify authenticated AAPL page flow: beta 1.0 returns an explicit missing FY2025 InterestExpense error, not a fabricated valuation. Treasury parsing verified at 4.94% dated October 30, 2026.
- [x] Add latest-year interest-expense fallbacks and explicit editable Cost of Debt estimate at Treasury yield + 1.0% when interest is unavailable.
- [x] Test fallback ordering, required estimate input, audited-data precedence and estimate-based WACC — 45 tests passed.
- [x] Verify authenticated AAPL estimate prefill and full DCF — editable 5.94% = Treasury 4.94% (2026-10-30) + 1.00%, estimate label visible before and after calculation; beta 1.0, FY2025, market price $337.31; WACC 9.3621%, EV $1,475,666,932,928.56, equity $1,420,922,932,928.56, implied price $94.70; no page errors.