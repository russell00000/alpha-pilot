import { describe, expect, test } from "bun:test";
import { extractFinancials, FIELD_TAGS, normalizeTicker, type CompanyFacts, type Observation } from "./financials";

const annual = (val: number, overrides: Partial<Observation> = {}): Observation => ({
  val, start: "2024-10-01", end: "2025-09-30", form: "10-K", fp: "FY", fy: 2025,
  filed: "2025-11-01", accn: "2025-filing", ...overrides,
});
const facts = (entries: Record<string, Observation[]>, unit = "USD"): CompanyFacts => ({
  cik: 320193, entityName: "Test Company",
  facts: { "us-gaap": Object.fromEntries(Object.entries(entries).map(([tag, rows]) => [tag, { units: { [unit]: rows } }])) },
});
const field = (raw: CompanyFacts, key: string) => extractFinancials(raw).financials[key] as any;

describe("SEC financial extraction contract", () => {
  for (const [key, tags] of Object.entries(FIELD_TAGS)) {
    test(`${key} uses only its requested first tag, correct unit and preserves its value`, () => {
      const unit = key === "diluted_shares" ? "shares" : "USD";
      const row = annual(123, key === "cash" ? { start: undefined } : {});
      expect(field(facts({ [tags[0]]: [row] }, unit), key)).toMatchObject({ value: 123, tag: tags[0], unit, fiscal_year: 2025 });
    });
  }
  test("revenue fallback order is not overridden by a newer secondary tag", () => {
    expect(field(facts({ RevenueFromContractWithCustomerExcludingAssessedTax: [annual(100)], Revenues: [annual(999)] }), "revenue").value).toBe(100);
    expect(field(facts({ Revenues: [annual(200)], SalesRevenueNet: [annual(300)] }), "revenue").tag).toBe("Revenues");
    expect(field(facts({ SalesRevenueNet: [annual(300)] }), "revenue").value).toBe(300);
  });
  test("D&A uses its second requested tag when the first is absent", () => {
    expect(field(facts({ DepreciationAmortizationAndAccretionNet: [annual(22)] }), "depreciation_amortization").tag).toBe("DepreciationAmortizationAndAccretionNet");
  });
  test("missing fields are null and explicitly listed, never estimated", () => {
    const result = extractFinancials(facts({}));
    expect(result.missing_fields).toEqual([...Object.keys(FIELD_TAGS), "total_debt", "revenue_history", "operating_income_history", "current_assets_history", "current_liabilities_history"]);
    expect(Object.values(result.financials)).toEqual(Array(11).fill(null));
  });
  test("quarters, 10-Qs, and amendments do not replace annual 10-K values", () => {
    const raw = facts({ OperatingIncomeLoss: [annual(40), annual(2, { start: "2025-07-01" }), annual(3, { form: "10-Q" }), annual(4, { form: "10-K/A", filed: "2025-12-01" })] });
    expect(field(raw, "operating_income").value).toBe(40);
  });
  test("latest period wins before filing date; latest comparative restatement retains actual fiscal year", () => {
    const raw = facts({ NetIncomeLoss: [annual(50), annual(55, { fy: 2026, filed: "2026-11-01", accn: "2026-filing" })], OperatingIncomeLoss: [annual(80, { start: "2025-10-01", end: "2026-09-30", fy: 2026, filed: "2026-11-01", accn: "2026-filing" })] });
    expect(field(raw, "net_income")).toMatchObject({ value: 55, fiscal_year: 2025, filing_fiscal_year: 2026 });
    expect(field(raw, "operating_income").fiscal_year).toBe(2026);
  });
  test("wrong units and nonfinite values return missing", () => {
    expect(field(facts({ NetIncomeLoss: [annual(30)] }, "EUR"), "net_income")).toBeNull();
    expect(field(facts({ NetIncomeLoss: [annual(NaN)] }), "net_income")).toBeNull();
  });
  test("existing tag without annual data does not guess from another tag", () => {
    expect(field(facts({ RevenueFromContractWithCustomerExcludingAssessedTax: [annual(1, { form: "10-Q" })], Revenues: [annual(9)] }), "revenue")).toBeNull();
  });
  test("zero and negative reported values remain unchanged", () => {
    expect(field(facts({ NetIncomeLoss: [annual(-25)] }), "net_income").value).toBe(-25);
    expect(field(facts({ IncomeTaxExpenseBenefit: [annual(0)] }), "income_tax_expense").value).toBe(0);
  });
  test("ticker input is normalized for SEC share classes", () => {
    expect(normalizeTicker(" aapl ")).toBe("AAPL");
    expect(normalizeTicker("brk.b")).toBe("BRK-B");
  });
  const debt = (val: number, overrides: Partial<Observation> = {}) => annual(val, { start: undefined, ...overrides });
  test("total debt prefers the first complete long-term debt pair and sums both", () => {
    const result = field(facts({ LongTermDebtCurrent: [debt(12)], LongTermDebtNoncurrent: [debt(78)], DebtCurrent: [debt(30)], DebtNoncurrent: [debt(60)], LongTermDebt: [debt(500)] }), "total_debt");
    expect(result).toMatchObject({ value: 90, tag: "LongTermDebtCurrent + LongTermDebtNoncurrent", fiscal_year: 2025, accession_number: "2025-filing" });
    expect(result.components.map((item: any) => item.value)).toEqual([12, 78]);
  });
  test("total debt falls back to DebtCurrent plus DebtNoncurrent if first pair is incomplete", () => {
    const result = field(facts({ LongTermDebtCurrent: [debt(12)], DebtCurrent: [debt(20)], DebtNoncurrent: [debt(80)], LongTermDebt: [debt(999)] }), "total_debt");
    expect(result).toMatchObject({ value: 100, tag: "DebtCurrent + DebtNoncurrent" });
  });
  test("total debt falls back to the combined LongTermDebt figure when pairs have no annual data", () => {
    const result = field(facts({ LongTermDebtCurrent: [debt(12, { form: "10-Q" })], LongTermDebtNoncurrent: [debt(80)], DebtCurrent: [], DebtNoncurrent: [], LongTermDebt: [debt(95)] }), "total_debt");
    expect(result).toMatchObject({ value: 95, tag: "LongTermDebt" });
  });
  test("total debt is null and missing when no complete pair or combined value exists", () => {
    const result = extractFinancials(facts({ LongTermDebtCurrent: [debt(12)] }));
    expect(result.financials.total_debt).toBeNull();
    expect(result.missing_fields).toContain("total_debt");
  });
  test("debt components from different dates or filings are never summed", () => {
    const result = field(facts({ LongTermDebtCurrent: [debt(12)], LongTermDebtNoncurrent: [debt(80, { end: "2024-09-30" })], DebtCurrent: [debt(20)], DebtNoncurrent: [debt(90, { accn: "different-filing" })], LongTermDebt: [debt(110)] }), "total_debt");
    expect(result).toMatchObject({ value: 110, tag: "LongTermDebt" });
  });
  test("explicitly reported zero debt remains zero, not missing", () => {
    const result = extractFinancials(facts({ DebtCurrent: [debt(0)], DebtNoncurrent: [debt(0)] }));
    expect((result.financials.total_debt as any).value).toBe(0);
    expect(result.missing_fields).not.toContain("total_debt");
  });
  test("history returns four unique annual years and two fiscal-year-end balances", () => {
    const years = [2025, 2024, 2023, 2022];
    const annualRows = years.map((year) => annual(year, { fy: year, start: `${year - 1}-10-01`, end: `${year}-09-30`, accn: `${year}-filing` }));
    const balances = annualRows.slice(0, 2).map((row) => ({ ...row, start: undefined }));
    const result = extractFinancials(facts({ RevenueFromContractWithCustomerExcludingAssessedTax: [...annualRows, annualRows[0]], OperatingIncomeLoss: annualRows, AssetsCurrent: balances, LiabilitiesCurrent: balances }));
    expect(result.history.revenue.map((row) => row.fiscal_year)).toEqual(years);
    expect(result.history.operating_income).toHaveLength(4);
    expect(result.history.current_assets.map((row) => row.fiscal_year)).toEqual([2025, 2024]);
    expect(result.history.current_liabilities).toHaveLength(2);
  });
});