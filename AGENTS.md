
- Never animate background layers or write CSS variables to <html> every frame — frosted-glass panels re-blur on each change, causing site-wide jank.
- Keep SEC financial extraction in the get-company-financials edge function with a pure, locally tested parser; server-side identification and service-only caches prevent browser SEC restrictions and unauditable financial guesses.
- Keep DCF math pure in calculate-dcf and require period-aligned audited SEC inputs; the edge function supplies Treasury yields and the existing Finnhub quote proxy so missing data cannot become a fabricated valuation.
