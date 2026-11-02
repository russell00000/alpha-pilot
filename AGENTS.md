
- Never animate background layers or write CSS variables to <html> every frame — frosted-glass panels re-blur on each change, causing site-wide jank.
- Keep SEC financial extraction in the get-company-financials edge function with a pure, locally tested parser; server-side identification and service-only caches prevent browser SEC restrictions and unauditable financial guesses.
- Keep DCF math pure in calculate-dcf with period-aligned SEC inputs; only missing interest expense may use an explicit user-confirmed cost-of-debt assumption, marked estimated in preparation and results. The edge function supplies Treasury yields and the existing Finnhub quote proxy to keep estimates distinguishable from audited data.
- Derive DCF historical assumption prefills and price-deviation flags in the pure math module; preserve full-precision defaults and distinguish user projection assumptions from extracted financial inputs so editing never changes audited history.
