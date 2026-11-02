import { expect, test } from "bun:test";
import { balanceCheck, calculateDcf, companyTypeWarnings, debtCostInput, historicalAssumptions, marketComparison, shareCountChange, DcfInputError, type DcfData, type FinancialValue } from "./math";
import { parseTreasuryYield } from "./treasury";
const item = (value: number, year = 2025, instant = false): FinancialValue => ({ value, fiscal_year: year, tag: "test", period: { start: instant ? null : `${year}-01-01`, end: `${year}-12-31` } });
const fixture = (): DcfData => ({ financials: {
  depreciation_amortization: item(10), capex: item(15), cash: item(20, 2025, true), total_debt: item(100, 2025, true), diluted_shares: item(10), income_tax_expense: item(5), pretax_income: item(20), interest_expense: item(4),
}, linked_financials: { cogs: item(80), ppe: item(50, 2025, true), total_assets: item(200, 2025, true), total_liabilities: item(130, 2025, true), total_equity: item(70, 2025, true), retained_earnings: item(30, 2025, true), current_assets: item(60, 2025, true), current_liabilities: item(30, 2025, true), current_financing: item(10, 2025, true) }, history: { revenue: [item(133.1), item(121, 2024), item(110, 2023), item(100, 2022)], operating_income: [item(26.62), item(24.2, 2024), item(22, 2023), item(20, 2022)], current_assets: [item(60, 2025, true), item(50, 2024, true)], current_liabilities: [item(30, 2025, true), item(25, 2024, true)], diluted_shares: [item(10), item(10, 2024), item(10, 2023), item(10, 2022)] } });
const args = { beta: 1, risk_free_rate: 0.04, current_price: 100 };
test("Apple share forecasts begin at 15.004697B; 14.59B is year one, never the valuation denominator", () => {
  const data = fixture();
  data.financials.diluted_shares = item(15004697000);
  data.history.diluted_shares = [item(15004697000), item(15408095000, 2024), item(15812547000, 2023), item(16325819000, 2022)];
  const result = calculateDcf(data, args);
  expect(result.share_count_basis?.value).toBe(15004697000);
  expect(result.projections[0].beginning_balances.diluted_shares).toBe(15004697000);
  expect(result.projections[0].diluted_shares).toBeCloseTo(14588576190.824305, 4);
  expect(result.derived.market_cap).toBe(15004697000 * args.current_price);
  expect(result.implied_share_price).toBe(result.equity_value / 15004697000);
});
test("out-of-period diluted shares cannot be used for the valuation denominator", () => {
  const data = fixture(); data.financials.diluted_shares = item(14590000000, 2024);
  expect(() => calculateDcf(data, args)).toThrow("out-of-period");
});
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
test("ten projections link days-based working capital and discount each unlevered FCF plus unchanged Gordon formula", () => {
  const r = calculateDcf(fixture(), args);
  expect(r.projections).toHaveLength(10);
  let revenue = 133.1;
  r.projections.forEach((p, i) => {
    revenue *= 1 + 0.1 + (0.025 - 0.1) * i / 9;
    const fcf = revenue * 0.2 * 0.75 + p.depreciation_amortization - p.capex - p.change_nwc;
    expect(p.revenue).toBeCloseTo(revenue, 9);
    expect(p.ufcf).toBeCloseTo(fcf, 9);
    expect(p.discounted_ufcf).toBeCloseTo(fcf / (1 + r.wacc) ** (i + 1), 9);
  });
  const expectedTerminal = r.projections[9].ufcf * 1.025 / (r.wacc - 0.025);
  expect(r.terminal_value).toBeCloseTo(expectedTerminal, 9);
  expect(r.enterprise_value).toBeCloseTo(r.projections.reduce((sum, p) => sum + p.discounted_ufcf, 0) + expectedTerminal / (1 + r.wacc) ** 10, 9);
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
test("stale interest expense requires explicit debt cost, not an older audited value", () => {
  const data = fixture(); data.financials.interest_expense = item(4, 2023);
  try { calculateDcf(data, args); throw new Error("Expected missing input failure"); }
  catch (error) { expect(error).toBeInstanceOf(DcfInputError); expect((error as DcfInputError).missing_fields).toContain("cost_of_debt"); }
});
test("suggested debt cost is current risk-free rate plus exactly 1.0 percentage point", () => {
  const data = fixture(); data.financials.interest_expense = null;
  const input = debtCostInput(data, 0.0494);
  expect(input.required).toBe(true);
  expect(input.estimated).toBe(true);
  expect(input.suggested_rate).toBeCloseTo(0.0594, 12);
});
test("missing interest never silently substitutes the suggested debt cost", () => {
  const data = fixture(); data.financials.interest_expense = null;
  expect(() => calculateDcf(data, args)).toThrow("Enter Cost of Debt");
});
test("edited cost of debt flows into after-tax cost and WACC with visible estimate provenance", () => {
  const data = fixture(); data.financials.interest_expense = null;
  const r = calculateDcf(data, { ...args, cost_of_debt: 0.06 });
  expect(r.derived.cost_of_debt).toBe(0.06);
  expect(r.derived.after_tax_cost_of_debt).toBeCloseTo(0.045, 12);
  expect(r.wacc).toBeCloseTo((1000 / 1100) * 0.085 + (100 / 1100) * 0.045, 12);
  expect(r.assumptions.cost_of_debt_estimated).toBe(true);
  expect(r.assumptions.cost_of_debt_source).toBe("user_estimate");
  expect(data.financials.interest_expense).toBeNull();
});
test("audited current-year interest takes precedence over any estimate input", () => {
  const r = calculateDcf(fixture(), { ...args, cost_of_debt: 0.5 });
  expect(r.derived.cost_of_debt).toBe(0.04);
  expect(r.assumptions.cost_of_debt_estimated).toBe(false);
  expect(debtCostInput(fixture(), 0.04).required).toBe(false);
});
test("negative nonfinite and over-100-percent debt cost estimates are rejected", () => {
  const data = fixture(); data.financials.interest_expense = null;
  for (const cost_of_debt of [-0.01, NaN, Infinity, 1.01]) expect(() => calculateDcf(data, { ...args, cost_of_debt })).toThrow("Enter Cost of Debt");
});
test("other missing audited inputs still block even with an explicit debt cost", () => {
  const data = fixture(); data.financials.interest_expense = null; data.financials.capex = null;
  expect(() => calculateDcf(data, { ...args, cost_of_debt: 0.05 })).toThrow("missing or out-of-period");
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
test("historical prefills preserve the default calculation exactly", () => {
  const data = fixture(), historical = historicalAssumptions(data);
  expect(historical.revenue_growth_rate).toBeCloseTo(0.1, 12);
  expect(historical.ebit_margin).toBeCloseTo(0.2, 12);
  const original = calculateDcf(data, args);
  const explicit = calculateDcf(data, { ...args, ...historical });
  expect(explicit.implied_share_price).toBe(original.implied_share_price);
  expect(explicit.enterprise_value).toBe(original.enterprise_value);
});
test("editable revenue growth sets the near-term rate and fades to terminal across all ten projections without altering history", () => {
  const data = fixture(), r = calculateDcf(data, { ...args, revenue_growth_rate: 0.08 });
  let expected = 133.1;
  r.projections.forEach((row, i) => {
    expected *= 1 + 0.08 + (0.025 - 0.08) * i / 9;
    expect(row.revenue).toBeCloseTo(expected, 9);
  });
  expect(r.projections[0]?.revenue_growth_rate).toBeCloseTo(0.08, 12);
  expect(r.projections[9]?.revenue_growth_rate).toBeCloseTo(0.025, 12);
  expect(r.derived.historical_cagr).toBeCloseTo(0.1, 12);
  expect(r.assumptions.revenue_growth_rate).toBe(0.08);
});
test("near-term growth fades linearly from the latest-year rate to the terminal rate", () => {
  const r = calculateDcf(fixture(), args);
  expect(r.derived.latest_year_growth).toBeCloseTo(0.1, 12);
  expect(r.projections[0]?.revenue_growth_rate).toBeCloseTo(0.1, 12);
  expect(r.projections[4]?.revenue_growth_rate).toBeCloseTo(0.1 + (0.025 - 0.1) * 4 / 9, 12);
  expect(r.projections[9]?.revenue_growth_rate).toBeCloseTo(0.025, 12);
});
test("share count rolls forward at the trailing three-year average while financing cash stays out of the unlevered model", () => {
  const data = fixture();
  data.history.diluted_shares = [item(11), item(10.5, 2024), item(10.2, 2023), item(10, 2022)];
  const expectedChange = (11 / 10.5 - 1 + 10.5 / 10.2 - 1 + 10.2 / 10 - 1) / 3;
  expect(shareCountChange(data)).toBeCloseTo(expectedChange, 12);
  const r = calculateDcf(data, args);
  expect(r.assumptions.share_count_change).toBeCloseTo(expectedChange, 12);
  let prior = 10;
  for (const p of r.projections) {
    expect(p.diluted_shares).toBeCloseTo(prior * (1 + expectedChange), 9);
    expect(p.financing_cash_flow).toBe(0);
    expect(p.balance_check.gap).toBe(0);
    prior = p.diluted_shares;
  }
});
test("a buyback-pace share history rolls the count down without touching cash or the balance check", () => {
  const data = fixture();
  data.history.diluted_shares = [item(10), item(10.1, 2024), item(10.2, 2023), item(10.3, 2022)];
  const r = calculateDcf(data, args);
  expect(r.assumptions.share_count_change).toBeLessThan(0);
  let prior = 10;
  for (const p of r.projections) {
    expect(p.diluted_shares).toBeLessThan(prior);
    expect(p.financing_cash_flow).toBe(0);
    expect(p.balance_check.gap).toBe(0);
    prior = p.diluted_shares;
  }
});
test("flat share history and missing share history both default to zero change, never an assumed buyback", () => {
  expect(shareCountChange(fixture())).toBe(0);
  const data = fixture(); data.history.diluted_shares = [item(10)];
  expect(shareCountChange(data)).toBe(0);
  const r = calculateDcf(data, args);
  expect(r.assumptions.share_count_change).toBe(0);
  expect(r.projections[9]?.diluted_shares).toBe(10);
});
test("a loss-making base year normalizes the tax rate to 21 percent and flags it", () => {
  const data = fixture();
  data.financials.pretax_income = item(-8);
  data.financials.income_tax_expense = item(1);
  const r = calculateDcf(data, args);
  expect(r.derived.tax_rate).toBe(0.21);
  expect(r.assumptions.tax_rate_normalized).toBe(true);
  expect(r.warnings.some((warning) => warning.includes("21% statutory"))).toBe(true);
});
test("negative base-year EBIT warns instead of silently projecting from a negative base", () => {
  const data = fixture();
  data.history.operating_income[0] = item(-5);
  const r = calculateDcf(data, args);
  expect(r.warnings.some((warning) => warning.includes("negative base"))).toBe(true);
  expect(Number.isFinite(r.implied_share_price)).toBe(true);
});
test("profitable company with a one-time tax benefit normalizes negative effective tax to 21% visibly", () => {
  const data = fixture(); data.financials.income_tax_expense = item(-2);
  const r = calculateDcf(data, args);
  expect(r.derived.tax_rate).toBe(0.21);
  expect(r.assumptions.tax_rate_normalized).toBe(true);
  expect(r.warnings.some(w => w.includes("outside a representative range") && w.includes("-10.00%"))).toBe(true);
  expect(r.projections[0].nopat).toBeCloseTo(r.projections[0].operating_income * 0.79, 10);
});
test("effective tax above 40% normalizes to 21% with a visible reason", () => {
  const data = fixture(); data.financials.income_tax_expense = item(8.01);
  const r = calculateDcf(data, args);
  expect(r.derived.tax_rate).toBe(0.21);
  expect(r.assumptions.tax_rate_normalized).toBe(true);
  expect(r.warnings.some(w => w.includes("outside a representative range"))).toBe(true);
});
for (const incomeTax of [0, 8]) {
  test(`effective tax boundary ${incomeTax / 20 * 100}% is preserved without normalization`, () => {
    const data = fixture(); data.financials.income_tax_expense = item(incomeTax);
    const r = calculateDcf(data, args);
    expect(r.derived.tax_rate).toBe(incomeTax / 20);
    expect(r.assumptions.tax_rate_normalized).toBe(false);
    expect(r.warnings.some(w => w.includes("Tax rate normalized"))).toBe(false);
  });
}
test("company type warnings flag financials and REITs by SIC range only", () => {
  expect(companyTypeWarnings(6021)[0]).toContain("financial companies");
  expect(companyTypeWarnings(6798)[0]).toContain("REIT");
  expect(companyTypeWarnings(6798)[0]).not.toContain("financial companies");
  expect(companyTypeWarnings(3571)).toEqual([]);
  expect(companyTypeWarnings(null)).toEqual([]);
});
for (const sic of [6000, 6021, 6798, 6799]) {
  test(`standard DCF hard-blocks SIC ${sic} before calculating a number`, () => {
    const data = fixture(); data.company_profile = { sic };
    expect(() => calculateDcf(data, args)).toThrow("Standard DCF is not supported for financial institutions / REITs yet");
  });
}
for (const sic of [5999, 6800, 3571, null]) {
  test(`standard DCF remains available for SIC ${sic}`, () => {
    const data = fixture(); data.company_profile = { sic };
    expect(Number.isFinite(calculateDcf(data, args).implied_share_price)).toBe(true);
  });
}
test("editable EBIT margin changes every projected EBIT and leaves historical margin intact", () => {
  const r = calculateDcf(fixture(), { ...args, ebit_margin: 0.3 });
  r.projections.forEach((row) => expect(row.operating_income).toBeCloseTo(row.revenue * 0.3, 12));
  expect(r.derived.historical_ebit_margin).toBeCloseTo(0.2, 12);
  expect(r.assumptions.ebit_margin).toBe(0.3);
});
test("zero growth and zero margin are valid overrides, not replaced with historical values", () => {
  const data = fixture(); data.financials.cash = item(1000, 2025, true);
  if (data.linked_financials) { data.linked_financials.current_assets = item(1040, 2025, true); data.linked_financials.total_assets = item(1180, 2025, true); data.linked_financials.total_equity = item(1050, 2025, true); }
  const r = calculateDcf(data, { ...args, revenue_growth_rate: 0, ebit_margin: 0 });
  expect(r.projections[0].revenue).toBe(133.1);
  expect(r.projections[0].operating_income).toBe(0);
  expect(r.projections[9].revenue_growth_rate).toBeCloseTo(0.025, 12);
});
test("PP&E carries prior balance plus CapEx minus depreciation in all ten years", () => {
  const r = calculateDcf(fixture(), args);
  let prior = 50;
  for (const p of r.projections) {
    expect(p.beginning_balances.ppe).toBe(prior);
    expect(p.balance_sheet.ppe).toBeCloseTo(prior + p.capex - p.depreciation_amortization, 2);
    prior = p.balance_sheet.ppe;
  }
});
test("cash carries net cash flow from operations investing and financing, without plugs", () => {
  const r = calculateDcf(fixture(), args);
  let prior = 20;
  for (const p of r.projections) {
    expect(p.beginning_balances.cash).toBe(prior);
    expect(p.net_change_cash).toBeCloseTo(p.operating_cash_flow + p.investing_cash_flow + p.financing_cash_flow, 2);
    expect(p.balance_sheet.cash).toBeCloseTo(prior + p.net_change_cash, 2);
    expect(p.financing_cash_flow).toBe(0);
    prior = p.balance_sheet.cash;
  }
});
test("debt is carried flat and beginning-debt interest feeds pretax income and net income", () => {
  const r = calculateDcf(fixture(), args);
  for (const p of r.projections) {
    expect(p.beginning_balances.total_debt).toBe(100);
    expect(p.balance_sheet.total_debt).toBe(100);
    expect(p.interest_expense).toBe(4);
    expect(p.pretax_income).toBeCloseTo(p.operating_income - 4, 12);
    expect(p.net_income).toBeCloseTo((p.operating_income - 4) * 0.75, 2);
  }
});
test("working capital excludes cash and current financing and holds historical day counts constant", () => {
  const r = calculateDcf(fixture(), args);
  expect(r.derived.operating_asset_days).toBeCloseTo(40 / 133.1 * 365, 12);
  expect(r.derived.operating_liability_days).toBeCloseTo(20 / 80 * 365, 12);
  let prior = 20;
  for (const p of r.projections) {
    expect(p.balance_sheet.operating_assets).toBeCloseTo(p.revenue / 133.1 * 40, 2);
    expect(p.balance_sheet.operating_liabilities).toBeCloseTo(p.cogs / 80 * 20, 2);
    expect(p.change_nwc).toBeCloseTo(p.balance_sheet.nwc - prior, 2);
    prior = p.balance_sheet.nwc;
  }
});
test("retained earnings carries forward by net income and all ten years independently balance", () => {
  const r = calculateDcf(fixture(), args);
  let prior = 30;
  for (const p of r.projections) {
    expect(p.balance_sheet.retained_earnings).toBeCloseTo(prior + p.net_income, 2);
    expect(p.balance_sheet.assets).toBeCloseTo(p.balance_sheet.liabilities + p.balance_sheet.equity, 2);
    expect(p.balance_check.gap).toBe(0);
    prior = p.balance_sheet.retained_earnings;
  }
});
test("a broken opening balance or annual balance check blocks the model instead of manufacturing equity", () => {
  const data = fixture(); if (data.linked_financials) data.linked_financials.total_assets = item(201, 2025, true);
  expect(() => calculateDcf(data, args)).toThrow("does not balance");
  expect(() => balanceCheck(201, 130, 70, 7)).toThrow("year 7");
});
test("missing or mismatched audited starting balances block linked projections", () => {
  const data = fixture(); if (data.linked_financials) data.linked_financials.ppe = null;
  expect(() => calculateDcf(data, args)).toThrow("audited opening balance");
});
test("invalid growth and nonfinite margins are rejected", () => {
  for (const revenue_growth_rate of [-1, -1.1, NaN, Infinity]) expect(() => calculateDcf(fixture(), { ...args, revenue_growth_rate })).toThrow("Revenue growth");
  expect(() => calculateDcf(fixture(), { ...args, ebit_margin: NaN })).toThrow("EBIT margin");
});
test("price deviation warning applies strictly above 40 percent in either direction", () => {
  expect(marketComparison(140, 100).deviation_warning).toBe(false);
  expect(marketComparison(60, 100).deviation_warning).toBe(false);
  expect(marketComparison(140.01, 100).deviation_warning).toBe(true);
  expect(marketComparison(59.99, 100).deviation_warning).toBe(true);
  expect(marketComparison(100, 100).deviation_warning).toBe(false);
  expect(marketComparison(90, 100).difference_pct).toBeCloseTo(-10, 12);
});