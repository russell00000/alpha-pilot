export interface FinancialValue {
  value: number; fiscal_year: number | null; period: { start: string | null; end: string };
  tag: string; accession_number?: string | null;
}
export interface DcfData {
  company_profile?: { sic: number | null };
  financials: Record<string, FinancialValue | null>;
  history: Record<string, FinancialValue[]>;
  linked_financials?: Record<string, FinancialValue | null>;
}
export class DcfInputError extends Error {
  constructor(message: string, public missing_fields: string[] = []) { super(message); }
}
export function hasCurrentInterest(data: DcfData) {
  const latest = data.history.revenue?.[0], interest = data.financials.interest_expense;
  return Boolean(latest && interest && Number.isFinite(interest.value) && interest.fiscal_year === latest.fiscal_year && interest.period.end === latest.period.end && interest.period.start === latest.period.start);
}
export function debtCostInput(data: DcfData, riskFreeRate: number) {
  if (!Number.isFinite(riskFreeRate) || riskFreeRate < 0) throw new DcfInputError("Invalid risk-free rate.");
  const estimated = !hasCurrentInterest(data);
  return { required: estimated, estimated, suggested_rate: estimated ? riskFreeRate + 0.01 : null,
    label: estimated ? "Estimated — company does not separately disclose interest expense" : "Calculated from audited interest expense and total debt" };
}
// SIC 6000-6799 covers banks, insurers and other financial institutions;
// 6798 is REITs. Pure classifier so warnings are testable and UI-agnostic.
export function companyTypeWarnings(sic: number | null | undefined) {
  const warnings: string[] = [];
  if (sic === 6798) warnings.push("REIT — FFO/AFFO-based valuation is the industry-standard approach, not EBIT-based FCFF.");
  else if (sic !== null && sic !== undefined && Number.isFinite(sic) && sic >= 6000 && sic <= 6799) warnings.push("Standard DCF may not be appropriate for financial companies — working capital and capex don't translate the same way; consider a dividend discount or P/B-based approach instead.");
  return warnings;
}
export function assertStandardDcfSupported(sic: number | null | undefined) {
  if (companyTypeWarnings(sic).length) throw new DcfInputError("Standard DCF is not supported for financial institutions / REITs yet");
}
// Trailing three-year average annual share-count change; positive means
// dilution, negative means buybacks. Defaults to 0 (flat) when four years of
// share history are unavailable — never an assumed buyback.
export function shareCountChange(data: DcfData) {
  const latest = data.history.revenue?.[0];
  const shares = data.history.diluted_shares ?? [];
  if (!latest?.fiscal_year) return 0;
  const rows = Array.from({ length: 4 }, (_, i) => shares.find((row) => row.fiscal_year === (latest.fiscal_year as number) - i));
  if (rows.some((row) => !row || !Number.isFinite(row.value) || row.value <= 0)) return 0;
  const changes = [0, 1, 2].map((i) => (rows[i] as FinancialValue).value / (rows[i + 1] as FinancialValue).value - 1);
  return changes.reduce((sum, change) => sum + change, 0) / changes.length;
}
export function historicalAssumptions(data: DcfData) {
  const latest = data.history.revenue?.[0];
  if (!latest?.fiscal_year) throw new DcfInputError("Four annual revenue years are required.", ["revenue_history"]);
  const rows = Array.from({ length: 4 }, (_, i) => {
    const year = latest.fiscal_year as number - i;
    const revenue = data.history.revenue.find((row) => row.fiscal_year === year);
    const income = data.history.operating_income?.find((row) => row.fiscal_year === year && row.period.end === revenue?.period.end && row.period.start === revenue?.period.start);
    if (!revenue || !Number.isFinite(revenue.value) || revenue.value <= 0 || !income || !Number.isFinite(income.value)) throw new DcfInputError("Four period-aligned annual revenue and EBIT years are required.", [`revenue_or_operating_income_${year}`]);
    return { revenue: revenue.value, income: income.value };
  });
  const priorYear = rows[1];
  if (!priorYear) throw new DcfInputError("Prior-year revenue is missing.");
  // Near-term growth anchors to the company's own most recent year, not a
  // fixed constant or a smoothed CAGR applied across all companies.
  return { revenue_growth_rate: latest.value / priorYear.revenue - 1,
    ebit_margin: rows.reduce((sum, row) => sum + row.income / row.revenue, 0) / 4,
    share_count_change: shareCountChange(data) };
}
// Titman & Martin Ch. 9 dual terminal-value cross-checks. All pure.
export function impliedGrowthRate(tvExit: number, wacc: number, ufcf: number) {
  if (![tvExit, wacc, ufcf].every(Number.isFinite) || tvExit + ufcf === 0) throw new DcfInputError("Invalid implied growth cross-check inputs.");
  return (tvExit * wacc - ufcf) / (tvExit + ufcf);
}
export function gordonEnterpriseValue(ufcfs: number[], wacc: number, growth: number) {
  if (!ufcfs.length || !Number.isFinite(wacc) || wacc <= 0 || !Number.isFinite(growth)) throw new DcfInputError("Invalid Gordon enterprise value inputs.");
  if (growth >= wacc) return null;
  const last = ufcfs[ufcfs.length - 1] as number;
  const terminal_value = last * (1 + growth) / (wacc - growth);
  const discounted_terminal_value = terminal_value / (1 + wacc) ** ufcfs.length;
  return { terminal_value, discounted_terminal_value,
    enterprise_value: ufcfs.reduce((sum, ufcf, i) => sum + ufcf / (1 + wacc) ** (i + 1), 0) + discounted_terminal_value };
}
// Solve for the terminal growth rate at which the Gordon enterprise value
// equals the market's implied enterprise value. EV(g) is strictly increasing
// in g on (-1, wacc), so bisection converges; null when no in-range solution.
export function breakevenTerminalGrowth(ufcfs: number[], wacc: number, targetEnterpriseValue: number): number | null {
  if (!Number.isFinite(targetEnterpriseValue) || targetEnterpriseValue <= 0) return null;
  const evAt = (g: number) => gordonEnterpriseValue(ufcfs, wacc, g)?.enterprise_value ?? NaN;
  let lo = -0.95, hi = wacc - 1e-9;
  if (evAt(lo) > targetEnterpriseValue || evAt(hi) < targetEnterpriseValue) return null;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    if (evAt(mid) < targetEnterpriseValue) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}
// WACC x terminal-growth enterprise-value grid: five WACCs spanning +/-1pp in
// 0.5pp steps around the computed WACC, five growth rates from 0% to the
// computed terminal assumption. Cells with growth >= WACC are null.
export function sensitivityGrid(ufcfs: number[], wacc: number, terminalGrowth: number) {
  const wacc_values = [-0.01, -0.005, 0, 0.005, 0.01].map((delta) => wacc + delta).filter((value) => value > 0);
  const growth_values = [0, 0.25, 0.5, 0.75, 1].map((fraction) => terminalGrowth * fraction);
  return { wacc_values, growth_values,
    cells: wacc_values.map((w) => growth_values.map((g) => gordonEnterpriseValue(ufcfs, w, g)?.enterprise_value ?? null)) };
}
export function marketComparison(impliedPrice: number, marketPrice: number) {
  if (![impliedPrice, marketPrice].every(Number.isFinite) || marketPrice <= 0) throw new DcfInputError("Invalid market comparison prices.");
  return { difference_pct: (impliedPrice / marketPrice - 1) * 100,
    deviation_warning: Math.abs(impliedPrice - marketPrice) > marketPrice * 0.4 };
}
const dollars = (value: number) => Math.round(value * 100) / 100;
export function balanceCheck(assets: number, liabilities: number, equity: number, year: number) {
  const gap = dollars(assets - liabilities - equity) || 0;
  if (![assets, liabilities, equity].every(Number.isFinite) || gap !== 0) throw new DcfInputError(`Balance sheet does not balance in year ${year}: Assets minus Liabilities and Equity = ${gap}.`);
  return { balanced: true, gap, assets, liabilities, equity };
}
export function calculateDcf(data: DcfData, assumptions: {
  beta: number; risk_free_rate: number; current_price: number;
  equity_risk_premium?: number; terminal_growth_rate?: number; cost_of_debt?: number;
  revenue_growth_rate?: number; ebit_margin?: number; share_count_change?: number;
  exit_multiple?: number;
}) {
  assertStandardDcfSupported(data.company_profile?.sic);
  const { beta, risk_free_rate, current_price } = assumptions;
  const equity_risk_premium = assumptions.equity_risk_premium ?? 0.045;
  const terminal_growth_rate = assumptions.terminal_growth_rate ?? 0.025;
  if (![beta, risk_free_rate, current_price, equity_risk_premium, terminal_growth_rate].every(Number.isFinite) || current_price <= 0) throw new DcfInputError("Invalid DCF assumptions.");
  const revenues = data.history.revenue ?? [];
  const ebit = data.history.operating_income ?? [];
  const latest = revenues[0];
  if (!latest?.fiscal_year) throw new DcfInputError("Four annual revenue years are required.", ["revenue_history"]);
  const fields = ["depreciation_amortization", "capex", "cash", "total_debt", "diluted_shares", "income_tax_expense", "pretax_income"];
  const missing = fields.filter((name) => !data.financials[name] || data.financials[name]?.period.end !== latest.period.end || data.financials[name]?.fiscal_year !== latest.fiscal_year);
  const revenueYears: FinancialValue[] = [], ebitYears: FinancialValue[] = [];
  for (let i = 0; i < 4; i++) {
    const year = latest.fiscal_year - i;
    const revenue = revenues.find((item) => item.fiscal_year === year);
    const income = ebit.find((item) => item.fiscal_year === year && item.period.end === revenue?.period.end && item.period.start === revenue?.period.start);
    if (!revenue || revenue.value <= 0) missing.push(`revenue_${year}`); else revenueYears.push(revenue);
    if (!income) missing.push(`operating_income_${year}`); else ebitYears.push(income);
  }
  const assets = data.history.current_assets ?? [], liabilities = data.history.current_liabilities ?? [];
  const balances = [0, 1].map((offset) => {
    const year = latest.fiscal_year as number - offset;
    const revenue = revenues.find((item) => item.fiscal_year === year);
    const asset = assets.find((item) => item.fiscal_year === year && item.period.end === revenue?.period.end);
    const liability = liabilities.find((item) => item.fiscal_year === year && item.period.end === revenue?.period.end);
    if (!asset) missing.push(`current_assets_${year}`);
    if (!liability) missing.push(`current_liabilities_${year}`);
    return asset && liability ? asset.value - liability.value : NaN;
  });
  if (missing.length) throw new DcfInputError("DCF blocked: missing or out-of-period annual financial inputs. No estimates were substituted.", [...new Set(missing)]);
  const value = (key: string) => {
    const item = data.financials[key];
    if (!item || !Number.isFinite(item.value)) throw new DcfInputError(`Invalid ${key}.`, [key]);
    return item.value;
  };
  const pretax = value("pretax_income"), debt = value("total_debt"), shares = value("diluted_shares");
  if (pretax === 0 || debt <= 0 || shares <= 0) throw new DcfInputError("Pretax income must be nonzero; debt and diluted shares must be positive for these formulas.");
  const warnings: string[] = [];
  // A loss-making year would produce a negative or extreme effective tax rate;
  // fall back to the normalized 21% statutory rate and say so.
  const reported_tax_rate = value("income_tax_expense") / pretax;
  const tax_rate_normalized = pretax < 0 || reported_tax_rate < 0 || reported_tax_rate > 0.4;
  if (tax_rate_normalized) warnings.push(pretax < 0
    ? "Tax rate normalized to the 21% statutory rate — the company reported a loss in the base year."
    : `Tax rate normalized to the 21% statutory rate — reported effective tax rate was outside a representative range (0–40%): ${(reported_tax_rate * 100).toFixed(2)}%.`);
  const tax_rate = tax_rate_normalized ? 0.21 : reported_tax_rate;
  const priorRevenue = revenueYears[3], priorYearRevenue = revenueYears[1];
  if (!priorRevenue || !priorYearRevenue) throw new DcfInputError("Prior revenue years are missing.");
  const historical_cagr = (latest.value / priorRevenue.value) ** (1 / 3) - 1;
  const latest_year_growth = latest.value / priorYearRevenue.value - 1;
  const historical_ebit_margin = revenueYears.reduce((sum, revenue, i) => sum + (ebitYears[i]?.value ?? NaN) / revenue.value, 0) / 4;
  const revenue_growth_rate = assumptions.revenue_growth_rate ?? latest_year_growth;
  const share_count_change = assumptions.share_count_change ?? shareCountChange(data);
  if (!Number.isFinite(share_count_change) || share_count_change <= -1) throw new DcfInputError("Share count change must be greater than -100%.");
  const ebit_margin = assumptions.ebit_margin ?? historical_ebit_margin;
  if (!Number.isFinite(revenue_growth_rate) || revenue_growth_rate <= -1 || !Number.isFinite(ebit_margin)) throw new DcfInputError("Revenue growth must be greater than -100% and EBIT margin must be finite.");
  // Near-term growth fades linearly to the terminal rate by year ten.
  const growthFor = (year: number) => revenue_growth_rate + (terminal_growth_rate - revenue_growth_rate) * (year - 1) / 9;
  const change_nwc = balances[0] - balances[1];
  const da_ratio = value("depreciation_amortization") / latest.value;
  const capex_ratio = value("capex") / latest.value;
  const change_nwc_ratio = change_nwc / latest.value;
  const base_ebit = ebitYears[0]?.value ?? NaN;
  const base_ufcf = base_ebit * (1 - tax_rate) + value("depreciation_amortization") - value("capex") - change_nwc;
  if (base_ebit < 0 || base_ufcf < 0) warnings.push("Base-year EBIT or unlevered free cash flow is negative — growth-rate projection from a negative base is unreliable. Review the assumptions manually before trusting this output.");
  const linked = (name: string) => {
    const item = data.linked_financials?.[name];
    if (!item || !Number.isFinite(item.value) || item.fiscal_year !== latest.fiscal_year || item.period.end !== latest.period.end || (latest.accession_number && item.accession_number !== latest.accession_number)) throw new DcfInputError("Missing or out-of-period audited opening balance for linked statements.", [name]);
    return item.value;
  };
  const opening_assets = linked("total_assets"), opening_liabilities = linked("total_liabilities"), opening_equity = linked("total_equity");
  balanceCheck(opening_assets, opening_liabilities, opening_equity, 0);
  const opening_ppe = linked("ppe"), opening_retained_earnings = linked("retained_earnings");
  const cogs = linked("cogs"), current_financing = linked("current_financing");
  const opening_operating_assets = linked("current_assets") - value("cash");
  const opening_operating_liabilities = linked("current_liabilities") - current_financing;
  if (cogs <= 0 || opening_operating_assets < 0 || opening_operating_liabilities < 0) throw new DcfInputError("Invalid COGS or operating working-capital opening balances.");
  const operating_asset_days = opening_operating_assets / latest.value * 365;
  const operating_liability_days = opening_operating_liabilities / cogs * 365;
  const cogs_ratio = cogs / latest.value;
  const other_assets = opening_assets - linked("current_assets") - opening_ppe;
  const other_liabilities = opening_liabilities - opening_operating_liabilities - debt;
  const other_equity = opening_equity - opening_retained_earnings;
  const cost_of_equity = risk_free_rate + beta * equity_risk_premium;
  const cost_of_debt_estimated = !hasCurrentInterest(data);
  if (cost_of_debt_estimated && (assumptions.cost_of_debt === undefined || !Number.isFinite(assumptions.cost_of_debt) || assumptions.cost_of_debt < 0 || assumptions.cost_of_debt > 1)) {
    throw new DcfInputError("Enter Cost of Debt (0–100%) because current-year interest expense is not disclosed.", ["cost_of_debt"]);
  }
  const cost_of_debt = cost_of_debt_estimated ? (assumptions.cost_of_debt ?? NaN) : value("interest_expense") / debt;
  const after_tax_cost_of_debt = cost_of_debt * (1 - tax_rate);
  const market_cap = current_price * shares;
  const equity_weight = market_cap / (market_cap + debt), debt_weight = 1 - equity_weight;
  const wacc = equity_weight * cost_of_equity + debt_weight * after_tax_cost_of_debt;
  if (!Number.isFinite(wacc) || wacc <= -1) throw new DcfInputError("WACC is invalid.");
  if (terminal_growth_rate >= wacc) throw new DcfInputError("Terminal growth rate must be strictly below WACC.");
  let prior = latest.value, priorPpe = opening_ppe, priorCash = value("cash"), priorDebt = debt, priorRetained = opening_retained_earnings;
  let priorNwc = opening_operating_assets - opening_operating_liabilities;
  let priorShares = shares;
  const projections = Array.from({ length: 10 }, (_, index) => {
    const year = index + 1;
    const growth_rate = growthFor(year);
    const revenue = prior * (1 + growth_rate); prior = revenue;
    const operating_income = revenue * ebit_margin;
    const nopat = operating_income * (1 - tax_rate);
    const da = dollars(revenue * da_ratio), capex = dollars(revenue * capex_ratio);
    const projected_cogs = revenue * cogs_ratio;
    const operating_assets = dollars(revenue / 365 * operating_asset_days);
    const operating_liabilities = dollars(projected_cogs / 365 * operating_liability_days);
    const nwc = dollars(operating_assets - operating_liabilities), delta_nwc = dollars(nwc - priorNwc);
    const interest_expense = dollars(priorDebt * cost_of_debt);
    const pretax_income = operating_income - interest_expense;
    const income_tax_expense = pretax_income * tax_rate;
    const net_income = dollars(pretax_income - income_tax_expense);
    const operating_cash_flow = dollars(net_income + da - delta_nwc);
    // Share count rolls forward for per-share transparency, but buyback and
    // issuance cash flows are financing decisions: they are excluded from the
    // unlevered model, so financing cash flow stays zero and no plug is needed.
    const projected_shares = priorShares * (1 + share_count_change);
    const investing_cash_flow = -capex, financing_cash_flow = 0;
    const net_change_cash = dollars(operating_cash_flow + investing_cash_flow + financing_cash_flow);
    const ppe = dollars(priorPpe + capex - da), cash = dollars(priorCash + net_change_cash);
    const total_debt = priorDebt, retained_earnings = dollars(priorRetained + net_income);
    const assets = dollars(cash + operating_assets + ppe + other_assets);
    const liabilities = dollars(operating_liabilities + total_debt + other_liabilities);
    const equity = dollars(retained_earnings + other_equity);
    const balance_check = balanceCheck(assets, liabilities, equity, year);
    if (ppe < 0 || cash < 0) throw new DcfInputError(`Year ${year} has negative ${ppe < 0 ? "PP&E" : "cash"}; add an explicit asset or financing assumption instead of using a balancing plug.`);
    // Unlevered FCF adds back after-tax interest; levered cash accumulation
    // must not be discounted at WACC or added again to today's equity bridge.
    const ufcf = operating_income * (1 - tax_rate) + da - capex - delta_nwc;
    const beginning_balances = { ppe: priorPpe, cash: priorCash, total_debt: priorDebt, retained_earnings: priorRetained, nwc: priorNwc, diluted_shares: priorShares };
    priorPpe = ppe; priorCash = cash; priorDebt = total_debt; priorRetained = retained_earnings; priorNwc = nwc;
    priorShares = projected_shares;
    return { year, fiscal_year: latest.fiscal_year as number + year, revenue, revenue_growth_rate: growth_rate, operating_income, nopat, cogs: projected_cogs,
      interest_expense, pretax_income, income_tax_expense, net_income, depreciation_amortization: da, capex, change_nwc: delta_nwc,
      operating_cash_flow, investing_cash_flow, financing_cash_flow, net_change_cash, beginning_balances, diluted_shares: projected_shares,
      balance_sheet: { cash, operating_assets, ppe, other_assets, assets, operating_liabilities, total_debt, other_liabilities, liabilities, retained_earnings, other_equity, equity, nwc },
      balance_check, ufcf, discounted_ufcf: ufcf / (1 + wacc) ** year };
  });
  const finalYear = projections[9];
  if (!finalYear) throw new DcfInputError("Year ten projection is missing.");
  const terminal_value = finalYear.ufcf * (1 + terminal_growth_rate) / (wacc - terminal_growth_rate);
  const discounted_terminal_value = terminal_value / (1 + wacc) ** 10;
  const discounted_ufcf_sum = projections.reduce((sum, row) => sum + row.discounted_ufcf, 0);
  const enterprise_value = discounted_ufcf_sum + discounted_terminal_value;
  const equity_value = enterprise_value - debt + value("cash");
  const implied_share_price = equity_value / shares;
  if (![enterprise_value, equity_value, implied_share_price].every(Number.isFinite)) throw new DcfInputError("DCF produced nonfinite results.");
  // Exit-multiple terminal value (Titman & Martin Ch. 9): the default multiple
  // is the company's own trailing EV/EBITDA — a placeholder pending a real
  // peer-comp multiple, and labeled as such wherever it is used.
  const base_ebitda = base_ebit + value("depreciation_amortization");
  const market_enterprise_value = market_cap + debt - value("cash");
  const exit_multiple_default = base_ebitda > 0 ? market_enterprise_value / base_ebitda : null;
  if (assumptions.exit_multiple !== undefined && (!Number.isFinite(assumptions.exit_multiple) || assumptions.exit_multiple <= 0)) throw new DcfInputError("Exit multiple must be a positive number.");
  const exit_multiple = assumptions.exit_multiple ?? exit_multiple_default;
  const exit_multiple_source = assumptions.exit_multiple !== undefined ? "user_input"
    : exit_multiple_default !== null ? "placeholder_company_trailing_ev_ebitda" : "unavailable";
  const ebitda_year_10 = finalYear.operating_income + finalYear.depreciation_amortization;
  let terminal_exit: Record<string, number> | null = null;
  let implied_growth_rate: number | null = null;
  if (exit_multiple !== null && ebitda_year_10 > 0) {
    const tv = exit_multiple * ebitda_year_10;
    const dtv = tv / (1 + wacc) ** 10;
    const ev = discounted_ufcf_sum + dtv;
    const eq = ev - debt + value("cash");
    implied_growth_rate = impliedGrowthRate(tv, wacc, finalYear.ufcf);
    if (implied_growth_rate > 0.04) warnings.push(`Implied growth cross-check: the exit multiple's terminal value would require ${(implied_growth_rate * 100).toFixed(2)}% perpetual growth — above the ~4% long-run nominal GDP rule of thumb, so the multiple may be pricing something this DCF does not justify.`);
    terminal_exit = { terminal_value: tv, discounted_terminal_value: dtv, enterprise_value: ev, equity_value: eq, implied_share_price: eq / shares, terminal_pct_of_ev: dtv / ev };
  } else {
    warnings.push("Exit-multiple cross-check unavailable — base-year or year-ten EBITDA is not positive, so no trailing EV/EBITDA placeholder could be computed.");
  }
  const implied_multiple = ebitda_year_10 > 0 ? terminal_value / ebitda_year_10 : null;
  const breakeven_growth_rate = breakevenTerminalGrowth(projections.map((row) => row.ufcf), wacc, market_enterprise_value);
  return { wacc, enterprise_value, equity_value, implied_share_price, ...marketComparison(implied_share_price, current_price),
    current_price, fiscal_year: latest.fiscal_year, share_count_basis: data.financials.diluted_shares, projections, terminal_value, discounted_terminal_value, warnings,
    terminal: {
      gordon: { terminal_value, discounted_terminal_value, terminal_pct_of_ev: discounted_terminal_value / enterprise_value, implied_multiple },
      exit_multiple: terminal_exit && { ...terminal_exit, exit_multiple, exit_multiple_source, ebitda_year_10 },
      cross_checks: { implied_growth_rate, implied_multiple },
      breakeven_growth_rate, market_enterprise_value,
    },
    sensitivity: sensitivityGrid(projections.map((row) => row.ufcf), wacc, terminal_growth_rate),
    model_notes: ["Dividends are not modeled; future addition.", "Near-term revenue growth fades linearly to the terminal growth rate by year ten.", "Projected diluted shares roll forward from the latest audited annual weighted-average diluted shares; these forecasts are not point-in-time shares outstanding. Buyback and issuance cash flows are not modeled. Implied price and WACC use the audited base-year weighted-average diluted shares, not year-one or terminal projected shares.", "Debt, other assets and other liabilities are carried flat; no financing or balancing plugs.", "Operating current assets exclude cash; operating current liabilities exclude disclosed current financing. Aggregate days are not receivables-specific DSO.", "COGS/revenue, depreciation/revenue and capex/revenue use latest audited ratios; tax uses the audited effective rate, or the normalized 21% statutory rate when the base year is a loss.", "Exit-multiple terminal value is a cross-check only; the headline valuation remains Gordon Growth. The default exit multiple is the company's own trailing EV/EBITDA — a placeholder pending a real peer-comp multiple."],
    opening_balance_check: balanceCheck(opening_assets, opening_liabilities, opening_equity, 0),
    assumptions: { beta, risk_free_rate, equity_risk_premium, terminal_growth_rate, revenue_growth_rate, ebit_margin, share_count_change, cost_of_debt, cost_of_debt_estimated, tax_rate_normalized,
      cost_of_debt_source: cost_of_debt_estimated ? "user_estimate" : "SEC interest expense / total debt",
      exit_multiple, exit_multiple_source },
    derived: { tax_rate, historical_cagr, latest_year_growth, historical_ebit_margin, base_ufcf, nwc_current: balances[0], nwc_prior: balances[1], change_nwc, da_ratio, capex_ratio, change_nwc_ratio, operating_asset_days, operating_liability_days, cogs_ratio, market_cap, cost_of_equity, cost_of_debt, after_tax_cost_of_debt, equity_weight, debt_weight },
  };
}