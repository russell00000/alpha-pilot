import { expect, test } from "bun:test";
import { calculateDcf, DcfInputError, type DcfData, type FinancialValue } from "./math";
import { parseTreasuryYield } from "./treasury";
const item = (value: number, year = 2025, instant = false): FinancialValue => ({ value, fiscal_year: year, tag: "test", period: { start: instant ? null : `${year}-01-01`, end: `${year}-12-31` } });
const fixture = (): DcfData => ({ financials: {
  depreciation_amortization: item(10), capex: item(15), cash: item(20, 2025, true), total_debt: item(100, 2025, true), diluted_shares: item(10), income_tax_expense: item(5), pretax_income: item(20), interest_expense: item(4),
}, history: { revenue: [item(133.1), item(121, 2024), item(110, 2023), item(100, 2022)], operating_income: [item(26.62), item(24.2, 2024), item(22, 2023), item(20, 2022)], current_assets: [item(60, 2025, true), item(50, 2024, true)], current_liabilities: [item(30, 2025, true), item(25, 2024, true)] } });
const args = { beta: 1, risk_free_rate: 0.04, current_price: 100 };
test("tax, three-year CAGR, four-year average margin and change in NWC follow exact formulas", () => {
  const r = calculateDcf(fixture(), args);
  expect(r.derived.tax_rate).toBe(0.25);
  expect(r.derived.historical_cagr).toBeCloseTo(0.1, 12);
  expect(r.derived.historical_ebit_margin).toBeCloseTo(0.2, 12);
  expect(r.derived.change_nwc).toBe(5);
});
test("CAPM, debt costs, diluted-share market cap, weights and WACC use requested defaults", () => {
  const r = calculateDcf(fixture(), args);
  expect(r.assumptions.equity_risk_premium).toBe(0.045);
  expect(r.assumptions.terminal_growth_rate).toBe(0.025);
  expect(r.derived.cost_of_equity).toBeCloseTo(0.085, 12);
  expect(r.derived.cost_of_debt).toBe(0.04);
  expect(r.derived.after_tax_cost_of_debt).toBe(0.03);
  expect(r.derived.market_cap).toBe(1000);
  expect(r.wacc).toBeCloseTo((1000 / 1100) * 0.085 + (100 / 1100) * 0.03, 12);
});
test("five projections hold latest revenue ratios and discount each FCF plus Gordon terminal value", () => {
  const r = calculateDcf(fixture(), args);
  expect(r.projections).toHaveLength(5);
  r.projections.forEach((p, i) => {
    const revenue = 133.1 * 1.1 ** (i + 1);
    const fcf = revenue * 0.2 * 0.75 + revenue * 10 / 133.1 - revenue * 15 / 133.1 - revenue * 5 / 133.1;
    expect(p.revenue).toBeCloseTo(revenue, 9);
    expect(p.ufcf).toBeCloseTo(fcf, 9);
    expect(p.discounted_ufcf).toBeCloseTo(fcf / (1 + r.wacc) ** (i + 1), 9);
  });
  const expectedTerminal = r.projections[4].ufcf * 1.025 / (r.wacc - 0.025);
  expect(r.terminal_value).toBeCloseTo(expectedTerminal, 9);
  expect(r.enterprise_value).toBeCloseTo(r.projections.reduce((sum, p) => sum + p.discounted_ufcf, 0) + expectedTerminal / (1 + r.wacc) ** 5, 9);
  expect(r.equity_value).toBeCloseTo(r.enterprise_value - 100 + 20, 9);
  expect(r.implied_share_price).toBeCloseTo(r.equity_value / 10, 9);
  expect(r.difference_pct).toBeCloseTo((r.implied_share_price / 100 - 1) * 100, 9);
});
test("terminal growth equal to WACC is hard blocked", () => {
  const r = calculateDcf(fixture(), args);
  expect(() => calculateDcf(fixture(), { ...args, terminal_growth_rate: r.wacc })).toThrow("strictly below WACC");
});
test("terminal growth greater than WACC is hard blocked", () => {
  expect(() => calculateDcf(fixture(), { ...args, terminal_growth_rate: 0.5 })).toThrow("strictly below WACC");
});
test("stale interest expense is blocked, not applied to latest fiscal year", () => {
  const data = fixture(); data.financials.interest_expense = item(4, 2023);
  try { calculateDcf(data, args); throw new Error("Expected missing input failure"); }
  catch (error) { expect(error).toBeInstanceOf(DcfInputError); expect((error as DcfInputError).missing_fields).toContain("interest_expense"); }
});
test("missing history and zero debt block undefined formulas", () => {
  const data = fixture(); data.history.revenue.pop();
  expect(() => calculateDcf(data, args)).toThrow("missing or out-of-period");
  const zero = fixture(); zero.financials.total_debt = item(0, 2025, true);
  expect(() => calculateDcf(zero, args)).toThrow("must be positive");
});
test("Treasury chooses latest valid dated ten-year observation and converts percent to decimal", () => {
  const yieldData = parseTreasuryYield('<feed><entry><d:NEW_DATE>2026-10-29T00:00:00</d:NEW_DATE><d:BC_10YEAR>4.8</d:BC_10YEAR></entry><entry><d:NEW_DATE>2026-10-30T00:00:00</d:NEW_DATE><d:BC_10YEAR>4.94</d:BC_10YEAR></entry></feed>');
  expect(yieldData.date).toBe("2026-10-30");
  expect(yieldData.rate).toBeCloseTo(0.0494, 12);
  expect(() => parseTreasuryYield("<feed/>" )).toThrow("no valid");
});