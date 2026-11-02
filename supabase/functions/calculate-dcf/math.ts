export interface FinancialValue {
  value: number; fiscal_year: number | null; period: { start: string | null; end: string };
  tag: string; accession_number?: string | null;
}
export interface DcfData {
  financials: Record<string, FinancialValue | null>;
  history: Record<string, FinancialValue[]>;
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
  const prior = rows[3];
  if (!prior) throw new DcfInputError("Three-year-prior revenue is missing.");
  return { revenue_growth_rate: (latest.value / prior.revenue) ** (1 / 3) - 1,
    ebit_margin: rows.reduce((sum, row) => sum + row.income / row.revenue, 0) / 4 };
}
export function marketComparison(impliedPrice: number, marketPrice: number) {
  if (![impliedPrice, marketPrice].every(Number.isFinite) || marketPrice <= 0) throw new DcfInputError("Invalid market comparison prices.");
  return { difference_pct: (impliedPrice / marketPrice - 1) * 100,
    deviation_warning: Math.abs(impliedPrice - marketPrice) > marketPrice * 0.4 };
}
export function calculateDcf(data: DcfData, assumptions: {
  beta: number; risk_free_rate: number; current_price: number;
  equity_risk_premium?: number; terminal_growth_rate?: number; cost_of_debt?: number;
  revenue_growth_rate?: number; ebit_margin?: number;
}) {
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
  const tax_rate = value("income_tax_expense") / pretax;
  const priorRevenue = revenueYears[3];
  if (!priorRevenue) throw new DcfInputError("Three-year-prior revenue is missing.");
  const historical_cagr = (latest.value / priorRevenue.value) ** (1 / 3) - 1;
  const historical_ebit_margin = revenueYears.reduce((sum, revenue, i) => sum + (ebitYears[i]?.value ?? NaN) / revenue.value, 0) / 4;
  const revenue_growth_rate = assumptions.revenue_growth_rate ?? historical_cagr;
  const ebit_margin = assumptions.ebit_margin ?? historical_ebit_margin;
  if (!Number.isFinite(revenue_growth_rate) || revenue_growth_rate <= -1 || !Number.isFinite(ebit_margin)) throw new DcfInputError("Revenue growth must be greater than -100% and EBIT margin must be finite.");
  const change_nwc = balances[0] - balances[1];
  const da_ratio = value("depreciation_amortization") / latest.value;
  const capex_ratio = value("capex") / latest.value;
  const change_nwc_ratio = change_nwc / latest.value;
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
  let prior = latest.value;
  const projections = Array.from({ length: 5 }, (_, index) => {
    const year = index + 1;
    const revenue = prior * (1 + revenue_growth_rate); prior = revenue;
    const operating_income = revenue * ebit_margin;
    const nopat = operating_income * (1 - tax_rate);
    const da = revenue * da_ratio, capex = revenue * capex_ratio, delta_nwc = revenue * change_nwc_ratio;
    const ufcf = nopat + da - capex - delta_nwc;
    return { year, fiscal_year: latest.fiscal_year as number + year, revenue, operating_income, nopat, depreciation_amortization: da, capex, change_nwc: delta_nwc, ufcf, discounted_ufcf: ufcf / (1 + wacc) ** year };
  });
  const fifth = projections[4];
  if (!fifth) throw new DcfInputError("Year five projection is missing.");
  const terminal_value = fifth.ufcf * (1 + terminal_growth_rate) / (wacc - terminal_growth_rate);
  const discounted_terminal_value = terminal_value / (1 + wacc) ** 5;
  const enterprise_value = projections.reduce((sum, row) => sum + row.discounted_ufcf, 0) + discounted_terminal_value;
  const equity_value = enterprise_value - debt + value("cash");
  const implied_share_price = equity_value / shares;
  if (![enterprise_value, equity_value, implied_share_price].every(Number.isFinite)) throw new DcfInputError("DCF produced nonfinite results.");
  return { wacc, enterprise_value, equity_value, implied_share_price, ...marketComparison(implied_share_price, current_price),
    current_price, fiscal_year: latest.fiscal_year, projections, terminal_value, discounted_terminal_value,
    assumptions: { beta, risk_free_rate, equity_risk_premium, terminal_growth_rate, revenue_growth_rate, ebit_margin, cost_of_debt, cost_of_debt_estimated,
      cost_of_debt_source: cost_of_debt_estimated ? "user_estimate" : "SEC interest expense / total debt" },
    derived: { tax_rate, historical_cagr, historical_ebit_margin, nwc_current: balances[0], nwc_prior: balances[1], change_nwc, da_ratio, capex_ratio, change_nwc_ratio, market_cap, cost_of_equity, cost_of_debt, after_tax_cost_of_debt, equity_weight, debt_weight },
  };
}