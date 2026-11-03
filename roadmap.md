# Vantage DCF Phase 1
- [ ] Fix period-first tag selection for every FIELD_TAGS field and history; add cash/pretax fallbacks and complete field audits; run regression tests, 10-ticker batch and AAPL peer validation. Leave Rivian's negative-cash model unchanged.
- [x] Add optional 2–5 peer ticker input, audited EV/EBITDA median default, explicit dropped-peer reasons and fallback labels; 118 tests pass, deployed and signed-in AAPL flow verified.
- [ ] Obtain a real AAPL MSFT/GOOGL peer-median valuation — existing extraction returns missing/out-of-period D&A for MSFT and EBIT/D&A/debt/cash/shares for GOOGL; UI run also encountered unavailable GOOGL quote. Both peers explicitly dropped; no fabricated median. Fallback verified at 35.4487×, exit price $264.66, TV 78.05%, g* 7.0323% (2026-11-03).
- [x] Normalize effective tax rates below 0% or above 40% to 21% with visible reason in warnings and Sources; negative-benefit, high-rate and exact-boundary tests passed (103 total). Deployed and reran the batch after the tax fix.
- [x] Add and run reusable authenticated scripts/dcf-batch.ts with beta 1.0 and existing defaults; post-tax-fix run 2026-11-02T20:31:18.937Z–20:31:54.833Z: AAPL $123.34 vs $338.78 (-63.59%), COST $271.26 vs $1,040.85 (-73.94%). Other eight return clear 422 audited-input/projection failures, not fabricated numbers; full table reported in chat.
- [x] Hard-block financial institutions / REITs (SIC 6000–6799) before rate/quote lookup and in pure math; boundary tests pass. Live JPM SIC 6021 and O SIC 6798 both returned exact unsupported-message 422 with no valuation. None of the requested ten has an unsupported SIC.
- [x] Fix annual balance selection across tags (10-K/10-K/A, latest period then latest filing); signed-in Rivian UI shows FY2025 debt $4.475B from DebtInstrumentCarryingAmount, ending 2025-12-31, filed 2026-02-12, accession 0001874178-26-000008; raw dates expose the stale FY2023 complete pair.
- [x] Add audited PP&E gross-minus-depreciation and debt/lease financing fallbacks; signed-in Rivian UI shows lease-inclusive net PP&E $5.119B, current financing $113M ($3M finance + $110M operating leases), noncurrent financing $4.531B, exact tags and attempted empty chains. 91 tests pass; both functions deployed; no page errors.
- [x] Fix Treasury request identification (custom User-Agent repeatedly stalled; browser-compatible User-Agent returned in 0.43–0.51s), eliminate the remaining outer year fallback, and persist a service-only 24-hour yield cache with true refresh/observation timestamps. One refresh request, in-flight deduplication, explicit stale fallback, and 83 passing tests.
- [x] Run fresh AAPL and RIVN back-to-back: AAPL calculated $123.43 in 1.57s; RIVN preparation succeeded in 1.44s and fresh calculation returned an independent audited-input block in 1.38s. Both reused 4.94%, refreshed 2026-11-02T20:02:22.931Z, observation 2026-10-30; database and signed-in UI verified, no page errors.
- [ ] Complete a valid fresh Rivian valuation — extraction gaps resolved; default historical EBIT margin -175.9593% now produces negative year-one cash. Requires user-chosen forward operating/financing assumptions; no cash plug, invented financing or new feature added. Fresh signed-in calculation visibly reports this independent model limitation.
- [x] Diagnose Rivian stalls: Treasury stage exceeded 50 seconds due to stacked retries; shared 15-second headers/body/SDK limits now fail explicitly. Five authenticated RIVN runs returned clean 503 retry messages in 15.78–16.03 seconds; visible UI failure verified.
- [x] Reconcile Apple's audited diluted shares: 15,004,697,000 FY2025 is the actual denominator; 14,588,576,190.824305 is the FY2026 forecast after -2.7732703244570372% share change. Added exact source and projected rows; 78 regression tests pass, live SEC extraction and local real-input math verified.
- [x] Verify Apple’s new source rows through a fresh successful live valuation — signed-in UI displays audited base 15,004,697,000, projected FY2026 14,588,576,191, and the true Treasury refresh timestamp; all ten balance checks $0.00.
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
# Dual terminal-value methodology (Titman & Martin Ch. 9)
- [x] Exit-multiple TV (multiple x year-10 EBITDA) with optional user override; default is the company's own trailing EV/EBITDA, labeled placeholder pending peer comps.
- [x] Cross-checks: implied growth g* = (TV_exit x WACC - UFCF10) / (TV_exit + UFCF10), implied multiple = TV_gordon / EBITDA10, visible warning when g* > 4%.
- [x] Terminal value as % of EV for both methods; 5x5 WACC (+/-1pp) x growth (0 to terminal) EV sensitivity grid; breakeven terminal growth vs market-implied EV via bisection.
- [x] 109 tests passed; deployed calculate-dcf; live AAPL verified in signed-in UI (g* 7.47% warning, breakeven 8.14%, grid center = headline EV).
