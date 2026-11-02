import { describe, expect, test } from "bun:test";
import { extractFinancials, FIELD_TAGS, LINKED_TAGS, normalizeTicker, type CompanyFacts, type Observation } from "./financials";

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
  test("Apple FY2025 annual diluted shares preserve the 10-K period, not point-in-time or projected shares", () => {
    const base = { fy: 2025, start: "2024-09-29", end: "2025-09-27", accn: "0000320193-25-000079", filed: "2025-10-31" };
    const result = extractFinancials(facts({ Revenues: [annual(416161000000, base)],
      WeightedAverageNumberOfDilutedSharesOutstanding: [annual(15004697000, base), annual(15408095000, { ...base, start: "2023-10-01", end: "2024-09-28" })],
      CommonStockSharesOutstanding: [annual(14776353000, { ...base, start: undefined, end: "2025-10-17" })],
    }));
    expect(result.financials.diluted_shares).toMatchObject({ value: 15004697000, fiscal_year: 2025, accession_number: base.accn, period: { start: base.start, end: base.end } });
    expect(result.history.diluted_shares[1]).toMatchObject({ value: 15408095000, fiscal_year: 2024 });
  });
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
  test("diluted share history carries four annual years in shares units", () => {
    const rows = [2025, 2024, 2023, 2022].map((year) => annual(15e9 - (2025 - year) * 1e9, { fy: year, end: `${year}-09-30`, start: `${year - 1}-10-01`, accn: `${year}-filing` }));
    const result = extractFinancials(facts({ WeightedAverageNumberOfDilutedSharesOutstanding: rows }, "shares"));
    expect(result.history.diluted_shares).toHaveLength(4);
    expect(result.history.diluted_shares[0]?.unit).toBe("shares");
    expect(result.history.diluted_shares.map((row) => row.fiscal_year)).toEqual([2025, 2024, 2023, 2022]);
    expect(result.missing_fields).not.toContain("diluted_shares_history");
  });
  test("missing fields are null and explicitly listed, never estimated", () => {
    const result = extractFinancials(facts({}));
    expect(result.missing_fields).toEqual([...Object.keys(FIELD_TAGS), "total_debt", "revenue_history", "operating_income_history", "current_assets_history", "current_liabilities_history", "diluted_shares_history"]);
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
  test("interest expense uses the first latest-year fallback even when all tags report data", () => {
    const result = field(facts({ Revenues: [annual(100)], InterestExpense: [annual(4)], InterestExpenseDebt: [annual(5)], InterestExpenseOther: [annual(6)] }), "interest_expense");
    expect(result).toMatchObject({ value: 4, tag: "InterestExpense", fiscal_year: 2025 });
  });
  test("stale first interest tag falls back to latest-year InterestExpenseDebt", () => {
    const result = extractFinancials(facts({ Revenues: [annual(100)], InterestExpense: [annual(4, { start: "2023-10-01", end: "2024-09-30", fy: 2024, accn: "2024-filing" })], InterestExpenseDebt: [annual(5)], InterestExpenseOther: [annual(6)] }));
    expect(result.financials.interest_expense).toMatchObject({ value: 5, tag: "InterestExpenseDebt", fiscal_year: 2025 });
    expect(result.missing_fields).not.toContain("interest_expense");
  });
  test("empty or quarterly interest concepts fall back to InterestExpenseOther", () => {
    const result = field(facts({ Revenues: [annual(100)], InterestExpense: [], InterestExpenseDebt: [annual(9, { form: "10-Q" })], InterestExpenseOther: [annual(6)] }), "interest_expense");
    expect(result).toMatchObject({ value: 6, tag: "InterestExpenseOther" });
  });
  test("all stale interest fallbacks remain null and listed as missing", () => {
    const stale = annual(4, { start: "2023-10-01", end: "2024-09-30", fy: 2024, accn: "2024-filing" });
    const result = extractFinancials(facts({ Revenues: [annual(100)], InterestExpense: [stale], InterestExpenseDebt: [stale], InterestExpenseOther: [stale] }));
    expect(result.financials.interest_expense).toBeNull();
    expect(result.missing_fields).toContain("interest_expense");
  });
  test("reported zero interest is a valid first fallback, not a missing estimate", () => {
    expect(field(facts({ Revenues: [annual(100)], InterestExpense: [annual(0)], InterestExpenseDebt: [annual(5)] }), "interest_expense")).toMatchObject({ value: 0, tag: "InterestExpense" });
  });
  test("linked balances select only latest revenue's annual filing and preserve provenance", () => {
    const raw = facts({ Revenues: [annual(100)], PropertyPlantAndEquipmentNet: [annual(50, { start: undefined }), annual(999, { start: undefined, accn: "other-filing", filed: "2025-12-01" })], CostOfGoodsAndServicesSold: [annual(60)] });
    const result = extractFinancials(raw);
    expect(result.linked_financials.ppe).toMatchObject({ value: 50, accession_number: "2025-filing", fiscal_year: 2025 });
    expect(result.linked_financials.cogs).toMatchObject({ value: 60, tag: "CostOfGoodsAndServicesSold" });
  });
  test("linked COGS fallback skips stale preferred concept", () => {
    const result = extractFinancials(facts({ Revenues: [annual(100)], CostOfGoodsAndServicesSold: [annual(60, { accn: "old-filing", end: "2024-09-30" })], CostOfRevenue: [annual(70)] }));
    expect(result.linked_financials.cogs).toMatchObject({ value: 70, tag: "CostOfRevenue" });
  });
  test("current financing excludes disclosed short borrowings without adding combined debt twice", () => {
    const result = extractFinancials(facts({ Revenues: [annual(100)], LongTermDebtCurrent: [annual(12, { start: undefined })], CommercialPaper: [annual(8, { start: undefined })] }));
    expect(result.linked_financials.current_financing?.value).toBe(20);
    const combined = extractFinancials(facts({ Revenues: [annual(100)], DebtCurrent: [annual(25, { start: undefined })], LongTermDebtCurrent: [annual(12, { start: undefined })], CommercialPaper: [annual(8, { start: undefined })] }));
    expect(combined.linked_financials.current_financing?.value).toBe(25);
  });
  test("missing linked opening balances remain null rather than manufactured zero", () => {
    const result = extractFinancials(facts({ Revenues: [annual(100)] }));
    expect(result.linked_missing_fields).toEqual([...Object.keys(LINKED_TAGS), "current_financing"]);
    expect(result.linked_financials.total_equity).toBeNull();
  });
});