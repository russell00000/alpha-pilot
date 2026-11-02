# Vantage DCF Phase 1
- [x] Add authenticated SEC lookup and service-only raw-response caches.
- [x] Extract nine requested financial fields with annual-period provenance and missing-field reporting.
- [x] Run 18 extraction tests and verify all nine fields against live Apple SEC data.
- [x] Verify authenticated deployed lookup and repeat-lookup cache reuse — Apple cold lookup returned 200, repeat lookup returned a cache hit with identical nine fields and unchanged fetch time.
- [x] Add ordered total-debt fallbacks with matching filing provenance; all 24 tests passed and authenticated live cached AAPL lookup returned $90,678,000,000 for FY2025.

# Vantage DCF Phase 2
- [ ] Extend audited SEC extraction for four-year revenue/EBIT, two-year current assets/liabilities, and interest expense.
- [ ] Add exact DCF engine, Treasury yield lookup, existing live quotes, and formula/validation tests.
- [ ] Add beta input, Run DCF, and plain result cards on Markets.
- [ ] Verify authenticated AAPL calculation and page flow; report actual results or specific missing-input blockers.