import { expect, test } from "bun:test";
import { peerMultiple, resolvePeerComps, validatePeerTickers } from "./peers";
import { type DcfData, type FinancialValue } from "./math";
const item = (value: number, instant = false): FinancialValue => ({ value, fiscal_year: 2025, tag: "audited", accession_number: "filing", period: { start: instant ? null : "2025-01-01", end: "2025-12-31" } });
const fixture = (): DcfData => ({ history: { revenue: [item(100)], operating_income: [item(20)] }, financials: { depreciation_amortization: item(5), total_debt: item(100, true), cash: item(50, true), diluted_shares: item(10) } });
test("peer multiple uses price times audited diluted shares plus debt minus cash over EBIT plus D&A", () => {
  const row = peerMultiple("MSFT", fixture(), { c: 20 });
  expect(row.market_cap).toBe(200); expect(row.enterprise_value).toBe(250); expect(row.ebitda).toBe(25); expect(row.multiple).toBe(10);
  expect(row.financial_inputs.total_debt.tag).toBe("audited");
});
test("two peers use the midpoint median", async () => {
  const result = await resolvePeerComps(["MSFT", "GOOGL"], async () => fixture(), async (ticker) => ({ c: ticker === "MSFT" ? 20 : 30 }));
  expect(result.resolved.map((row) => row.multiple)).toEqual([10, 14]); expect(result.median).toBe(12); expect(result.fallback_reason).toBeNull();
});
test("a rich outlier cannot dominate the median", async () => {
  const result = await resolvePeerComps(["MSFT", "GOOGL", "COST"], async () => fixture(), async (ticker) => ({ c: ticker === "MSFT" ? 20 : ticker === "GOOGL" ? 30 : 1000 }));
  expect(result.median).toBe(14);
});
test("missing and stale annual fields are dropped with reasons; fewer than two peers cannot supply a default", async () => {
  const result = await resolvePeerComps(["MSFT", "GOOGL"], async (ticker) => { const data = fixture(); if (ticker === "GOOGL") data.financials.cash = null; return data; }, async () => ({ c: 20 }));
  expect(result.median).toBeNull(); expect(result.dropped[0].ticker).toBe("GOOGL"); expect(result.dropped[0].reason).toContain("cash"); expect(result.fallback_reason).toContain("Only 1");
  const data = fixture(); data.financials.depreciation_amortization = { ...item(5), fiscal_year: 2024 };
  expect(() => peerMultiple("MSFT", data, { c: 20 })).toThrow("depreciation_amortization");
});
test("transport failures are explicitly disclosed as dropped peers", async () => {
  const result = await resolvePeerComps(["MSFT", "GOOGL"], async () => { throw new Error("Data temporarily unavailable, try again."); }, async () => ({ c: 20 }));
  expect(result.resolved).toHaveLength(0); expect(result.dropped).toHaveLength(2); expect(result.dropped[0].reason).toBe("Data temporarily unavailable, try again.");
});
test("nonpositive EBITDA and unsupported financial peers are excluded", () => {
  const data = fixture(); data.history.operating_income = [item(-10)];
  expect(() => peerMultiple("LOSS", data, { c: 20 })).toThrow("EBITDA must be positive");
  data.company_profile = { sic: 6021 }; expect(() => peerMultiple("JPM", data, { c: 20 })).toThrow("not supported");
});
test("peer input requires 2–5 distinct tickers and excludes the target", () => {
  expect(validatePeerTickers("AAPL", ["msft", "googl"])).toEqual(["MSFT", "GOOGL"]);
  for (const tickers of [["MSFT"], ["MSFT", "MSFT"], ["AAPL", "MSFT"], ["A", "B", "C", "D", "E", "F"]]) expect(() => validatePeerTickers("AAPL", tickers)).toThrow("2–5");
});