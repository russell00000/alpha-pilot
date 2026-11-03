export const FIELD_TAGS = {
  revenue: ["RevenueFromContractWithCustomerExcludingAssessedTax", "Revenues", "SalesRevenueNet"],
  operating_income: ["OperatingIncomeLoss"],
  net_income: ["NetIncomeLoss"],
  depreciation_amortization: ["DepreciationDepletionAndAmortization", "DepreciationAmortizationAndAccretionNet"],
  capex: ["PaymentsToAcquirePropertyPlantAndEquipment"],
  cash: ["CashAndCashEquivalentsAtCarryingValue", "CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents"],
  diluted_shares: ["WeightedAverageNumberOfDilutedSharesOutstanding"],
  income_tax_expense: ["IncomeTaxExpenseBenefit"],
  pretax_income: ["IncomeLossFromContinuingOperationsBeforeIncomeTaxesExtraordinaryItemsNoncontrollingInterest", "IncomeLossFromContinuingOperationsBeforeIncomeTaxesMinorityInterestAndIncomeLossFromEquityMethodInvestments"],
  interest_expense: ["InterestExpense", "InterestExpenseDebt", "InterestExpenseOther"],
} as const;
export const LINKED_TAGS = {
  cogs: ["CostOfGoodsAndServicesSold", "CostOfRevenue"],
  ppe: ["PropertyPlantAndEquipmentNet", "PropertyPlantAndEquipmentAndFinanceLeaseRightOfUseAssetAfterAccumulatedDepreciationAndAmortization"],
  total_assets: ["Assets"], total_liabilities: ["Liabilities"],
  total_equity: ["StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest", "StockholdersEquity"],
  retained_earnings: ["RetainedEarningsAccumulatedDeficit"],
  current_assets: ["AssetsCurrent"], current_liabilities: ["LiabilitiesCurrent"],
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
  if (!["10-K", "10-K/A"].includes(row.form) || row.fp !== "FY" || !Number.isFinite(row.val)) return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(row.end)) return false;
  if (instant) return !row.start;
  if (!row.start) return false;
  const days = (Date.parse(row.end) - Date.parse(row.start)) / 86400000;
  return days >= 300 && days <= 400;
}

const newest = (a: Observation, b: Observation) => b.end.localeCompare(a.end) || (b.filed ?? "").localeCompare(a.filed ?? "") || (b.fy ?? 0) - (a.fy ?? 0) || (b.accn ?? "").localeCompare(a.accn ?? "");

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
  const annualRows = (tag: string, unit: string, instant: boolean) => (gaap[tag]?.units[unit] ?? []).filter(row => isAnnual(row, instant)).sort(newest);
  // Rank periods across the entire fallback set, not merely existing tags.
  // Within each period tag precedence wins, then the newest filing of that tag.
  const periodSelections = (tags: readonly string[], unit: string, instant: boolean) => {
    const candidates = tags.map(tag => ({ tag, rows: annualRows(tag, unit, instant) }));
    const ends = [...new Set(candidates.flatMap(candidate => candidate.rows.map(row => row.end)))].sort((a, b) => b.localeCompare(a));
    return ends.flatMap(end => {
      for (const { tag, rows } of candidates) {
        const row = rows.find(row => row.end === end);
        if (row) return [provenance(row, tag, unit)];
      }
      return [];
    });
  };
  const missing_fields: string[] = [];
  const financials = Object.fromEntries(Object.entries(FIELD_TAGS).map(([field, tags]) => {
    const unit = field === "diluted_shares" ? "shares" : "USD";
    const selected = periodSelections(tags, unit, field === "cash")[0];
    if (!selected) {
      missing_fields.push(field);
      return [field, null];
    }
    return [field, selected];
  }));
  const annualDebt = (tag: string) => (gaap[tag]?.units.USD ?? [])
    .filter((row) => isAnnual(row, true))
    .sort(newest);
  // Choose period first, then fallback chain within that period. A complete
  // stale pair must never beat a newer audited combined debt observation.
  const debtTags = ["LongTermDebtCurrent", "LongTermDebtNoncurrent", "DebtCurrent", "DebtNoncurrent", "LongTermDebt", "DebtInstrumentCarryingAmount"];
  const latestDebtEnd = debtTags.flatMap(annualDebt).sort(newest)[0]?.end;
  financials.total_debt = null;
  for (const [currentTag, noncurrentTag] of [["LongTermDebtCurrent", "LongTermDebtNoncurrent"], ["DebtCurrent", "DebtNoncurrent"]]) {
    for (const current of annualDebt(currentTag).filter(row => row.end === latestDebtEnd)) {
      const noncurrent = annualDebt(noncurrentTag).find(row => Boolean(current.accn) && row.accn === current.accn && row.end === current.end);
      if (!noncurrent) continue;
      financials.total_debt = { ...provenance(current, `${currentTag} + ${noncurrentTag}`), value: current.val + noncurrent.val,
        components: [provenance(current, currentTag), provenance(noncurrent, noncurrentTag)] };
      break;
    }
    if (financials.total_debt) break;
  }
  for (const tag of ["LongTermDebt", "DebtInstrumentCarryingAmount"]) {
    if (financials.total_debt) break;
    const row = annualDebt(tag).find(row => row.end === latestDebtEnd);
    if (row) financials.total_debt = { ...provenance(row, tag), components: [provenance(row, tag)] };
  }
  if (financials.total_debt === null) missing_fields.push("total_debt");
  const historyFor = (field: "revenue" | "operating_income" | "current_assets" | "current_liabilities" | "diluted_shares", limit: number) => {
    const tags = field === "current_assets" ? ["AssetsCurrent"] : field === "current_liabilities" ? ["LiabilitiesCurrent"] : FIELD_TAGS[field];
    const unit = field === "diluted_shares" ? "shares" : "USD";
    const instant = field === "current_assets" || field === "current_liabilities";
    const unique = new Map<string, ReturnType<typeof provenance>>();
    for (const item of periodSelections(tags, unit, instant)) {
      const key = String(item.fiscal_year ?? item.period.end);
      if (!unique.has(key)) unique.set(key, item);
    }
    const values = [...unique.values()].slice(0, limit);
    if (values.length < limit) missing_fields.push(`${field}_history`);
    return values;
  };
  const history = {
    revenue: historyFor("revenue", 4), operating_income: historyFor("operating_income", 4),
    current_assets: historyFor("current_assets", 2), current_liabilities: historyFor("current_liabilities", 2),
    diluted_shares: historyFor("diluted_shares", 4),
  };
  const latestRevenue = history.revenue[0];
  // Microsoft discloses depreciation and intangible amortization separately.
  // Sum only an audited same-duration/same-filing pair; never use depreciation
  // alone as D&A or add finance-lease amortization again.
  const daComponentTags = ["Depreciation", "AmortizationOfIntangibleAssets"];
  const daEnd = [...FIELD_TAGS.depreciation_amortization, ...daComponentTags].flatMap(tag => annualRows(tag, "USD", false)).sort(newest)[0]?.end;
  if (!financials.depreciation_amortization || financials.depreciation_amortization.period.end !== daEnd) {
    const depreciation = annualRows(daComponentTags[0], "USD", false).find(row => row.end === daEnd);
    const amortization = depreciation && annualRows(daComponentTags[1], "USD", false).find(row => row.end === depreciation.end && row.start === depreciation.start && Boolean(row.accn) && row.accn === depreciation.accn);
    if (depreciation && amortization) {
      financials.depreciation_amortization = { ...provenance(depreciation, daComponentTags.join(" + ")), value: depreciation.val + amortization.val,
        components: [provenance(depreciation, daComponentTags[0]), provenance(amortization, daComponentTags[1])] };
      const index = missing_fields.indexOf("depreciation_amortization");
      if (index >= 0) missing_fields.splice(index, 1);
    }
  }
  // Unlike other fields, each interest fallback must have a valid latest-year
  // annual value, not merely an existing concept or an older observation.
  financials.interest_expense = null;
  for (const tag of FIELD_TAGS.interest_expense) {
    const rows = (gaap[tag]?.units.USD ?? []).filter((row) => isAnnual(row, false))
      .sort(newest);
    const selected = rows.find((row) => {
      const item = provenance(row, tag);
      return !latestRevenue ? item.period.end === periodSelections(FIELD_TAGS.interest_expense, "USD", false)[0]?.period.end : (item.fiscal_year === latestRevenue.fiscal_year && item.period.end === latestRevenue.period.end && item.period.start === latestRevenue.period.start);
    });
    if (selected) { financials.interest_expense = provenance(selected, tag); break; }
  }
  const missingInterest = missing_fields.indexOf("interest_expense");
  if (financials.interest_expense && missingInterest >= 0) missing_fields.splice(missingInterest, 1);
  if (!financials.interest_expense && missingInterest < 0) missing_fields.push("interest_expense");
  // Opening balances must belong to the same 10-K as latest revenue.
  const linked_missing_fields: string[] = [];
  const aligned = (tag: string, instant = true) => (gaap[tag]?.units.USD ?? [])
    .filter((row) => isAnnual(row, instant) && Boolean(latestRevenue) && row.end === latestRevenue?.period.end && row.accn === latestRevenue?.accession_number && (instant || row.start === latestRevenue?.period.start))
    .sort((a, b) => (b.filed ?? "").localeCompare(a.filed ?? ""))[0];
  const linked_financials: Record<string, ReturnType<typeof provenance> | null> = {};
  for (const [name, tags] of Object.entries(LINKED_TAGS)) {
    linked_financials[name] = null;
    for (const tag of tags) {
      const row = aligned(tag, name !== "cogs");
      if (row) { linked_financials[name] = provenance(row, tag); break; }
    }
    if (!linked_financials[name]) linked_missing_fields.push(name);
  }
  const sumAligned = (tags: string[]) => {
    const components = tags.flatMap(tag => { const row = aligned(tag); return row ? [provenance(row, tag)] : []; });
    if (!components.length) return null;
    return { ...components[0], tag: components.map(item => item.tag).join(" + "),
      value: components.reduce((sum, item) => sum + item.value, 0), components };
  };
  const currentDebtTag = aligned("DebtCurrent") ? "DebtCurrent" : "LongTermDebtCurrent";
  const shortTag = ["ShortTermBorrowings", "CommercialPaper"].find(tag => aligned(tag));
  const currentTags = [currentDebtTag, "FinanceLeaseLiabilityCurrent", "OperatingLeaseLiabilityCurrent", ...(currentDebtTag !== "DebtCurrent" && shortTag ? [shortTag] : [])];
  const noncurrentTags = [aligned("DebtNoncurrent") ? "DebtNoncurrent" : "LongTermDebtNoncurrent", "FinanceLeaseLiabilityNoncurrent"];
  linked_financials.current_financing = sumAligned(currentTags);
  linked_financials.noncurrent_financing = sumAligned(noncurrentTags);
  if (!linked_financials.current_financing) linked_missing_fields.push("current_financing");
  const grossTag = "PropertyPlantAndEquipmentGross";
  const depreciationTags = ["AccumulatedDepreciationDepletionAndAmortizationPropertyPlantAndEquipment", "AccumulatedDepreciationDepletionAndAmortization"];
  if (!linked_financials.ppe) {
    const gross = aligned(grossTag);
    const depTag = depreciationTags.find(tag => aligned(tag));
    const dep = depTag ? aligned(depTag) : undefined;
    if (gross && dep && depTag && gross.val >= dep.val) {
      linked_financials.ppe = { ...provenance(gross, `${grossTag} - ${depTag}`), value: gross.val - dep.val };
    }
  }
  if (linked_financials.ppe) {
    const index = linked_missing_fields.indexOf("ppe");
    if (index >= 0) linked_missing_fields.splice(index, 1);
  }
  const auditTags = (tags: string[]) => [...new Set(tags)].map(tag => {
    const rows = gaap[tag]?.units.USD ?? [];
    const selected = aligned(tag);
    const annual = rows.filter(row => isAnnual(row, true)).sort(newest);
    return { tag, exists: gaap[tag] !== undefined, latest_annual_end: annual[0]?.end ?? null, rejection_reason: selected ? null : !gaap[tag] ? "Tag not reported" : !annual.length ? "No valid annual USD observations" : "No aligned observation in latest revenue filing (or incomplete debt pair)", raw_end_dates: rows.map(row => row.end), annual_candidates: annual.map(row => provenance(row, tag)),
      selected: selected ? provenance(selected, tag) : null,
      status: !rows.length ? "Empty / not reported" : selected ? "Same-filing annual value selected" : "No value in latest annual filing" };
  });
  const fieldAudits = Object.fromEntries(Object.entries(FIELD_TAGS).map(([field, tags]) => {
    const unit = field === "diluted_shares" ? "shares" : "USD";
    const selected = financials[field];
    const attempted = field === "depreciation_amortization" ? [...tags, ...daComponentTags] : [...tags];
    const latestEnd = periodSelections(attempted, unit, field === "cash")[0]?.period.end;
    return [field, { selected, tags: attempted.map(tag => {
      const rows = gaap[tag]?.units[unit] ?? [];
      const annual = annualRows(tag, unit, field === "cash");
      const component = field === "depreciation_amortization" && selected?.tag === daComponentTags.join(" + ") && daComponentTags.includes(tag) ? annual.find(row => row.end === selected.period.end && row.accn === selected.accession_number && row.start === selected.period.start) : undefined;
      const chosen = selected?.tag === tag ? selected : component ? provenance(component, tag, unit) : null;
      const rejection_reason = chosen ? null : !gaap[tag] ? "Tag not reported" : !annual.length ? `No valid annual ${unit} observations` : annual[0].end !== latestEnd ? `Stale tag: latest annual end ${annual[0].end}, newest candidate period ${latestEnd}` : field === "interest_expense" && !selected ? "No observation aligned to the latest revenue period" : "Lower-priority fallback in the same newest annual period";
      return { tag, exists: gaap[tag] !== undefined, latest_annual_end: annual[0]?.end ?? null, rejection_reason,
        selected: chosen, status: chosen ? "Annual value selected" : rejection_reason ?? "Not selected", raw_end_dates: rows.map(row => row.end), annual_candidates: annual.map(row => provenance(row, tag, unit)) };
    }) }];
  }));
  const extraction_audit = {
    annual_period: latestRevenue ? { end: latestRevenue.period.end, fiscal_year: latestRevenue.fiscal_year, accession_number: latestRevenue.accession_number, filed: latestRevenue.filed } : null,
    selection_rule: "10-K / 10-K/A only; newest annual period across all candidate tags first, then fallback tag order within that period, then latest filing. History selects independently per fiscal period across tags. Components share the same period and filing; opening balances match revenue's filing. Never use stale complete pairs over newer debt data.",
    fields: fieldAudits,
    ...fieldAudits,
    total_debt: { selected: financials.total_debt, tags: auditTags([...debtTags, "ShortTermBorrowings", "LongTermDebtMaturitiesRepaymentsOfPrincipalInNextTwelveMonths"]) },
    ppe: { selected: linked_financials.ppe, tags: auditTags([...LINKED_TAGS.ppe, grossTag, ...depreciationTags]) },
    current_financing: { selected: linked_financials.current_financing, tags: auditTags([...currentTags, "DebtCurrent", "LongTermDebtCurrent", "ShortTermBorrowings", "CommercialPaper"]) },
    noncurrent_financing: { selected: linked_financials.noncurrent_financing, tags: auditTags([...noncurrentTags, "DebtNoncurrent", "LongTermDebtNoncurrent"]) },
  };
  return { financials, history, missing_fields, linked_financials, linked_missing_fields, extraction_audit };
}