import { DcfInputError, assertStandardDcfSupported, type DcfData, type FinancialValue } from "./math.ts";

export function validatePeerTickers(target: string, tickers: string[]) {
  const normalized = tickers.map((ticker) => ticker.trim().toUpperCase().replace(/\./g, "-"));
  if (normalized.length < 2 || normalized.length > 5 || normalized.some((ticker) => !/^[A-Z0-9]+(?:[.-][A-Z0-9]+)*$/.test(ticker)) || new Set(normalized).size !== normalized.length || normalized.includes(target.toUpperCase().replace(/\./g, "-"))) {
    throw new DcfInputError("Enter 2–5 distinct peer tickers, excluding the target company.");
  }
  return normalized;
}
export interface PeerQuote { c: number; t?: number }
export function peerMultiple(ticker: string, data: DcfData, quote: PeerQuote) {
  assertStandardDcfSupported(data.company_profile?.sic);
  const latest = data.history.revenue?.[0];
  if (!latest) throw new Error("Latest audited annual period unavailable.");
  const keys = ["operating_income", "depreciation_amortization", "total_debt", "cash", "diluted_shares"];
  const inputs: Record<string, FinancialValue> = {};
  const missing: string[] = [];
  for (const key of keys) {
    const row = key === "operating_income" ? data.history.operating_income?.[0] : data.financials[key];
    const duration = ["operating_income", "depreciation_amortization", "diluted_shares"].includes(key);
    if (!row || !Number.isFinite(row.value) || row.period.end !== latest.period.end || row.fiscal_year !== latest.fiscal_year || (duration && row.period.start !== latest.period.start)) missing.push(key);
    else inputs[key] = row;
  }
  if (missing.length) throw new Error(`Missing or out-of-period audited fields: ${missing.join(", ")}.`);
  if (!Number.isFinite(quote.c) || quote.c <= 0) throw new Error("Current Finnhub market quote unavailable.");
  const ebit = inputs.operating_income.value, da = inputs.depreciation_amortization.value;
  const debt = inputs.total_debt.value, cash = inputs.cash.value, shares = inputs.diluted_shares.value;
  if (debt < 0 || cash < 0 || shares <= 0 || da < 0) throw new Error("Invalid audited debt, cash, diluted shares or D&A.");
  const ebitda = ebit + da, market_cap = quote.c * shares, enterprise_value = market_cap + debt - cash;
  if (ebitda <= 0 || enterprise_value <= 0) throw new Error("EV and EBITDA must be positive for a representative peer multiple.");
  const multiple = enterprise_value / ebitda;
  if (!Number.isFinite(multiple)) throw new Error("Peer EV/EBITDA is nonfinite.");
  return { ticker, multiple, current_price: quote.c, market_price_source: "Finnhub", market_price_as_of: quote.t ? new Date(quote.t * 1000).toISOString() : null,
    fiscal_year: latest.fiscal_year, period: latest.period, ebit, depreciation_amortization: da, total_debt: debt, cash, diluted_shares: shares,
    share_count_basis: "Audited annual weighted-average diluted shares (not point-in-time shares outstanding)", market_cap, enterprise_value, ebitda, financial_inputs: inputs };
}
export async function resolvePeerComps(tickers: string[], loadFinancials: (ticker: string) => Promise<DcfData>, loadQuote: (ticker: string) => Promise<PeerQuote>) {
  const rows = await Promise.all(tickers.map(async (ticker) => {
    try {
      const [financials, quote] = await Promise.all([loadFinancials(ticker), loadQuote(ticker)]);
      return { resolved: peerMultiple(ticker, financials, quote), dropped: null };
    } catch (error) {
      return { resolved: null, dropped: { ticker, reason: error instanceof Error ? error.message : "Peer data temporarily unavailable, try again." } };
    }
  }));
  const resolved = rows.flatMap((row) => row.resolved ? [row.resolved] : []);
  const dropped = rows.flatMap((row) => row.dropped ? [row.dropped] : []);
  const sorted = resolved.map((row) => row.multiple).sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  const median = sorted.length < 2 ? null : sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
  return { requested: tickers, resolved, dropped, median, minimum_resolved: 2,
    fallback_reason: median === null ? `Only ${resolved.length} peers resolved; at least 2 required. Using the company's own trailing EV/EBITDA fallback placeholder if available.` : null };
}