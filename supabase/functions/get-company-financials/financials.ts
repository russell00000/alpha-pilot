export const FIELD_TAGS = {
  revenue: ["RevenueFromContractWithCustomerExcludingAssessedTax", "Revenues", "SalesRevenueNet"],
  operating_income: ["OperatingIncomeLoss"],
  net_income: ["NetIncomeLoss"],
  depreciation_amortization: ["DepreciationDepletionAndAmortization", "DepreciationAmortizationAndAccretionNet"],
  capex: ["PaymentsToAcquirePropertyPlantAndEquipment"],
  cash: ["CashAndCashEquivalentsAtCarryingValue"],
  diluted_shares: ["WeightedAverageNumberOfDilutedSharesOutstanding"],
  income_tax_expense: ["IncomeTaxExpenseBenefit"],
  pretax_income: ["IncomeLossFromContinuingOperationsBeforeIncomeTaxesExtraordinaryItemsNoncontrollingInterest"],
  interest_expense: ["InterestExpense", "InterestExpenseDebt", "InterestExpenseOther"],
} as const;

export interface Observation {
  val: number; start?: string; end: string; form: string;
  fy?: number; fp?: string; filed?: string; accn?: string; frame?: string;
}
export interface CompanyFacts {
  cik: number; entityName: string;
  facts: Record<string, Record<string, { units: Record<string, Observation[]> }>>;
}

export function normalizeTicker(value: string) {
  return value.trim().toUpperCase().replace(/\./g, "-");
}

function isAnnual(row: Observation, instant: boolean) {
  if (row.form !== "10-K" || row.fp !== "FY" || !Number.isFinite(row.val)) return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(row.end)) return false;
  if (instant) return !row.start;
  if (!row.start) return false;
  const days = (Date.parse(row.end) - Date.parse(row.start)) / 86400000;
  return days >= 300 && days <= 400;
}

export function extractFinancials(raw: CompanyFacts) {
  const gaap = raw.facts["us-gaap"] ?? {};
  // A later 10-K repeats earlier years with the later filing's fy. Establish
  // each accession's actual current year-end before labeling comparatives.
  const accessionEnds = new Map<string, string>();
  for (const concept of Object.values(gaap)) {
    for (const rows of Object.values(concept.units)) {
      for (const row of rows) {
        if (!row.accn || !isAnnual(row, false)) continue;
        const previous = accessionEnds.get(row.accn);
        if (!previous || row.end > previous) accessionEnds.set(row.accn, row.end);
      }
    }
  }
  const provenance = (selected: Observation, tag: string, unit = "USD") => {
    const currentEnd = selected.accn ? accessionEnds.get(selected.accn) : undefined;
    const comparativeOffset = currentEnd ? Number(currentEnd.slice(0, 4)) - Number(selected.end.slice(0, 4)) : 0;
    return {
      value: selected.val, unit, tag, taxonomy: "us-gaap",
      fiscal_year: selected.fy === undefined ? null : selected.fy - comparativeOffset,
      filing_fiscal_year: selected.fy ?? null,
      period: { start: selected.start ?? null, end: selected.end },
      form: selected.form, fiscal_period: selected.fp, filed: selected.filed ?? null,
      accession_number: selected.accn ?? null, frame: selected.frame ?? null,
    };
  };
  const missing_fields: string[] = [];
  const financials = Object.fromEntries(Object.entries(FIELD_TAGS).map(([field, tags]) => {
    const tag = tags.find((candidate) => gaap[candidate] !== undefined);
    const unit = field === "diluted_shares" ? "shares" : "USD";
    const candidates = tag ? gaap[tag]?.units[unit] ?? [] : [];
    const selected = candidates.filter((row) => isAnnual(row, field === "cash"))
      .sort((a, b) => b.end.localeCompare(a.end) || (b.filed ?? "").localeCompare(a.filed ?? "") || (b.accn ?? "").localeCompare(a.accn ?? ""))[0];
    if (!selected || !tag) {
      missing_fields.push(field);
      return [field, null];
    }
    return [field, provenance(selected, tag, unit)];
  }));
  const annualDebt = (tag: string) => (gaap[tag]?.units.USD ?? [])
    .filter((row) => isAnnual(row, true))
    .sort((a, b) => b.end.localeCompare(a.end) || (b.filed ?? "").localeCompare(a.filed ?? "") || (b.accn ?? "").localeCompare(a.accn ?? ""));
  financials.total_debt = null;
  for (const [currentTag, noncurrentTag] of [
    ["LongTermDebtCurrent", "LongTermDebtNoncurrent"],
    ["DebtCurrent", "DebtNoncurrent"],
  ]) {
    const noncurrentRows = annualDebt(noncurrentTag);
    for (const current of annualDebt(currentTag)) {
      const noncurrent = noncurrentRows.find((row) => Boolean(current.accn) && row.accn === current.accn && row.end === current.end);
      if (!noncurrent || !Number.isFinite(current.val + noncurrent.val)) continue;
      financials.total_debt = {
        ...provenance(current, `${currentTag} + ${noncurrentTag}`),
        value: current.val + noncurrent.val,
        components: [provenance(current, currentTag), provenance(noncurrent, noncurrentTag)],
      };
      break;
    }
    if (financials.total_debt !== null) break;
  }
  if (financials.total_debt === null) {
    const combined = annualDebt("LongTermDebt")[0];
    if (combined) financials.total_debt = {
      ...provenance(combined, "LongTermDebt"),
      components: [provenance(combined, "LongTermDebt")],
    };
  }
  if (financials.total_debt === null) missing_fields.push("total_debt");
  const historyFor = (field: "revenue" | "operating_income" | "current_assets" | "current_liabilities", limit: number) => {
    const tags = field === "current_assets" ? ["AssetsCurrent"] : field === "current_liabilities" ? ["LiabilitiesCurrent"] : FIELD_TAGS[field];
    const tag = tags.find((candidate) => gaap[candidate] !== undefined);
    const rows = tag ? (gaap[tag]?.units.USD ?? []).filter((row) => isAnnual(row, field === "current_assets" || field === "current_liabilities")) : [];
    rows.sort((a, b) => b.end.localeCompare(a.end) || (b.filed ?? "").localeCompare(a.filed ?? ""));
    const unique = new Map<string, ReturnType<typeof provenance>>();
    for (const row of rows) {
      if (!tag) continue;
      const item = provenance(row, tag);
      const key = String(item.fiscal_year ?? row.end);
      if (!unique.has(key)) unique.set(key, item);
    }
    const values = [...unique.values()].slice(0, limit);
    if (values.length < limit) missing_fields.push(`${field}_history`);
    return values;
  };
  const history = {
    revenue: historyFor("revenue", 4), operating_income: historyFor("operating_income", 4),
    current_assets: historyFor("current_assets", 2), current_liabilities: historyFor("current_liabilities", 2),
  };
  const latestRevenue = history.revenue[0];
  // Unlike other fields, each interest fallback must have a valid latest-year
  // annual value, not merely an existing concept or an older observation.
  financials.interest_expense = null;
  for (const tag of FIELD_TAGS.interest_expense) {
    const rows = (gaap[tag]?.units.USD ?? []).filter((row) => isAnnual(row, false))
      .sort((a, b) => b.end.localeCompare(a.end) || (b.filed ?? "").localeCompare(a.filed ?? ""));
    const selected = rows.find((row) => {
      const item = provenance(row, tag);
      return !latestRevenue || (item.fiscal_year === latestRevenue.fiscal_year && item.period.end === latestRevenue.period.end && item.period.start === latestRevenue.period.start);
    });
    if (selected) { financials.interest_expense = provenance(selected, tag); break; }
  }
  const missingInterest = missing_fields.indexOf("interest_expense");
  if (financials.interest_expense && missingInterest >= 0) missing_fields.splice(missingInterest, 1);
  if (!financials.interest_expense && missingInterest < 0) missing_fields.push("interest_expense");
  return { financials, history, missing_fields };
}