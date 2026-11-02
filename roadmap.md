# Vantage DCF Phase 1
- [ ] Diagnose Rivian stalls, bound every pipeline fetch to 15 seconds, and verify five consecutive live runs with visible failures.
- [ ] Reconcile Apple's audited diluted shares and show matching calculation/source provenance.
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

# DCF editable assumptions and market comparison
- [x] Prefill editable Revenue Growth Rate and EBIT Margin from exact historical values and apply overrides to all five projections.
- [x] Add current-market comparison and strict >40% absolute-deviation warning using the existing ticker quote source.
- [x] Test unchanged historical defaults, overrides and warning boundaries — 51 tests passed; identical prior inputs reproduce 94.69854225837166 exactly ($94.70).
- [x] Verify signed-in AAPL default and 10% growth results — historical growth 1.8125%, margin 30.8978%, beta 1, estimated debt cost 5.94%, quote $336.99; default $94.70 vs 10% growth $135.16 (+42.72%); both warnings visible. Quote service temporarily unavailable during initial attempts; completed live verification with background ticker polling paused, no mocked prices or results, no page errors.

# Ten-year linked three-statement model
- [x] Resolve baseline: user chose ten constant-growth/margin years with Gordon Growth; fade and Exit Multiple deferred.
- [x] Extend same-filing audited opening balances for PP&E, retained earnings, assets/liabilities/equity, COGS and current financing; exclude cash/current financing from operating days schedules.
- [x] Implement ten-year roll-forwards, days schedules, net income/cash flow links and annual balance checks — 62 tests passed; no balancing plugs.
- [x] Display annual balance checks and omitted distributions; signed-in AAPL live result $98.61, all FY2026–2035 checks $0.00, no page errors. Identical prior inputs: five-year static $94.69958, ten-year static $92.62991, ten-year linked $98.61246; linkage-only +$5.98256, net vs prior +$3.91288. Flat debt yields constant $5.3862732B interest, which now feeds net income/cash flow but is added back after tax for unlevered DCF.