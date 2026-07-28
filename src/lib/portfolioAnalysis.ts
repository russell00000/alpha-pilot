// Pure functions for portfolio analysis: risk metrics, target allocation, rebalancing.
// No external state; safe to test in isolation.

export type Holding = {
  symbol: string;
  name?: string | null;
  quantity: number;
  cost_basis?: number | null;
  market_value: number;
  asset_class?: string | null;
  sector?: string | null;
};

export type RiskMetrics = {
  totalValue: number;
  positionCount: number;
  hhi: number; // Herfindahl-Hirschman concentration (0–1)
  topWeight: number; // 0–1
  weightedBeta: number;
  volatility: number; // annualized, 0–1
  sharpe: number;
  diversificationScore: number; // 0–100
  riskGrade: 'Conservative' | 'Balanced' | 'Growth' | 'Aggressive' | 'Speculative';
};

// Rough beta/vol assumptions per broad asset class or ticker. These are
// deliberately conservative defaults; when real data is available it flows in.
const BETA_BY_CLASS: Record<string, number> = {
  equity: 1.05,
  etf: 1.0,
  mutual_fund: 0.95,
  fixed_income: 0.15,
  cash: 0.0,
  crypto: 2.4,
  derivative: 1.6,
};
const VOL_BY_CLASS: Record<string, number> = {
  equity: 0.24,
  etf: 0.16,
  mutual_fund: 0.15,
  fixed_income: 0.05,
  cash: 0.005,
  crypto: 0.75,
  derivative: 0.45,
};

const RF = 0.045; // risk-free rate
const EQUITY_PREMIUM = 0.06;

export function computeRisk(holdings: Holding[]): RiskMetrics {
  const total = holdings.reduce((s, h) => s + Math.max(0, h.market_value || 0), 0);
  if (total === 0) {
    return {
      totalValue: 0, positionCount: 0, hhi: 0, topWeight: 0,
      weightedBeta: 0, volatility: 0, sharpe: 0,
      diversificationScore: 0, riskGrade: 'Balanced',
    };
  }
  const weights = holdings.map((h) => Math.max(0, h.market_value || 0) / total);
  const hhi = weights.reduce((s, w) => s + w * w, 0);
  const topWeight = weights.length ? Math.max(...weights) : 0;

  const classOf = (h: Holding) =>
    (h.asset_class ?? 'equity').toLowerCase();

  const weightedBeta = holdings.reduce((s, h, i) =>
    s + weights[i] * (BETA_BY_CLASS[classOf(h)] ?? 1.0), 0);
  const weightedVol = Math.sqrt(
    holdings.reduce((s, h, i) => {
      const v = VOL_BY_CLASS[classOf(h)] ?? 0.2;
      return s + weights[i] * weights[i] * v * v;
    }, 0) +
    // add a diversification correlation term
    holdings.reduce((s, h, i) => s + weights[i] * (VOL_BY_CLASS[classOf(h)] ?? 0.2), 0) * 0.02
  );

  const expectedReturn = RF + weightedBeta * EQUITY_PREMIUM;
  const sharpe = weightedVol > 0 ? (expectedReturn - RF) / weightedVol : 0;

  const diversificationScore = Math.round(
    Math.max(0, Math.min(100, 100 * (1 - hhi) * Math.min(1, holdings.length / 15)))
  );

  let riskGrade: RiskMetrics['riskGrade'] = 'Balanced';
  if (weightedBeta < 0.5) riskGrade = 'Conservative';
  else if (weightedBeta < 0.9) riskGrade = 'Balanced';
  else if (weightedBeta < 1.2) riskGrade = 'Growth';
  else if (weightedBeta < 1.6) riskGrade = 'Aggressive';
  else riskGrade = 'Speculative';

  return {
    totalValue: total,
    positionCount: holdings.length,
    hhi,
    topWeight,
    weightedBeta,
    volatility: weightedVol,
    sharpe,
    diversificationScore,
    riskGrade,
  };
}

export type SectorSlice = { sector: string; value: number; weight: number };
export function sectorBreakdown(holdings: Holding[]): SectorSlice[] {
  const total = holdings.reduce((s, h) => s + (h.market_value || 0), 0) || 1;
  const map = new Map<string, number>();
  for (const h of holdings) {
    const key = h.sector || h.asset_class || 'Other';
    map.set(key, (map.get(key) ?? 0) + (h.market_value || 0));
  }
  return [...map.entries()]
    .map(([sector, value]) => ({ sector, value, weight: value / total }))
    .sort((a, b) => b.value - a.value);
}

// Preset target models. Weights on broad asset classes.
export type ModelId = 'conservative' | 'balanced' | 'growth' | 'aggressive';
export const MODELS: Record<ModelId, { label: string; description: string; targets: Record<string, number> }> = {
  conservative: {
    label: 'Conservative',
    description: 'Capital preservation with modest growth.',
    targets: { equity: 0.35, fixed_income: 0.55, cash: 0.1 },
  },
  balanced: {
    label: 'Balanced',
    description: 'Steady long-term growth with buffered downside.',
    targets: { equity: 0.6, fixed_income: 0.35, cash: 0.05 },
  },
  growth: {
    label: 'Growth',
    description: 'Long-horizon growth with meaningful volatility.',
    targets: { equity: 0.8, fixed_income: 0.17, cash: 0.03 },
  },
  aggressive: {
    label: 'Aggressive',
    description: 'Maximum growth, high volatility tolerance.',
    targets: { equity: 0.95, fixed_income: 0.03, cash: 0.02 },
  },
};

export type RebalanceRow = {
  asset_class: string;
  currentWeight: number;
  targetWeight: number;
  currentValue: number;
  targetValue: number;
  deltaValue: number; // positive = buy, negative = sell
  action: 'Buy' | 'Sell' | 'Hold';
};

export function buildRebalance(holdings: Holding[], modelId: ModelId): RebalanceRow[] {
  const total = holdings.reduce((s, h) => s + (h.market_value || 0), 0);
  const model = MODELS[modelId].targets;
  const currentByClass = new Map<string, number>();
  for (const h of holdings) {
    const c = (h.asset_class ?? 'equity').toLowerCase();
    const bucket = c.includes('bond') || c.includes('fixed') ? 'fixed_income'
      : c.includes('cash') ? 'cash'
      : c.includes('crypto') ? 'crypto'
      : 'equity';
    currentByClass.set(bucket, (currentByClass.get(bucket) ?? 0) + (h.market_value || 0));
  }
  const classes = new Set<string>([...Object.keys(model), ...currentByClass.keys()]);
  const rows: RebalanceRow[] = [];
  for (const c of classes) {
    const currentValue = currentByClass.get(c) ?? 0;
    const currentWeight = total > 0 ? currentValue / total : 0;
    const targetWeight = model[c] ?? 0;
    const targetValue = total * targetWeight;
    const deltaValue = targetValue - currentValue;
    const action: RebalanceRow['action'] =
      Math.abs(deltaValue) < total * 0.02 ? 'Hold' : deltaValue > 0 ? 'Buy' : 'Sell';
    rows.push({ asset_class: c, currentWeight, targetWeight, currentValue, targetValue, deltaValue, action });
  }
  return rows.sort((a, b) => Math.abs(b.deltaValue) - Math.abs(a.deltaValue));
}

// Position-level improvement recommendations.
// Uses concentration + placeholder vantage rating; the AI recs panel will
// enrich with LLM rationale.
export type PositionRec = {
  symbol: string;
  name?: string | null;
  weight: number;
  action: 'Add' | 'Trim' | 'Sell' | 'Hold' | 'Replace';
  reason: string;
};

export function positionRecs(holdings: Holding[]): PositionRec[] {
  const total = holdings.reduce((s, h) => s + (h.market_value || 0), 0) || 1;
  return holdings.map((h) => {
    const weight = (h.market_value || 0) / total;
    let action: PositionRec['action'] = 'Hold';
    let reason = 'Position size and asset class look reasonable for a diversified portfolio.';
    if (weight > 0.25) {
      action = 'Trim';
      reason = `${(weight * 100).toFixed(1)}% of the book — trim to below 15% to reduce single-name concentration risk.`;
    } else if (weight < 0.02 && (h.market_value || 0) > 0) {
      action = 'Sell';
      reason = 'Position is too small to move the portfolio — consolidate into higher-conviction names.';
    } else if (weight > 0.06 && weight <= 0.15) {
      action = 'Add';
      reason = 'Well-sized core position — add on weakness to lift conviction weight.';
    }
    return { symbol: h.symbol, name: h.name, weight, action, reason };
  }).sort((a, b) => b.weight - a.weight);
}

// Demo data used until a real brokerage is linked.
export const DEMO_HOLDINGS: Holding[] = [
  { symbol: 'AAPL', name: 'Apple Inc.',            quantity: 42,  cost_basis: 6800,  market_value: 9820,  asset_class: 'equity', sector: 'Technology' },
  { symbol: 'MSFT', name: 'Microsoft Corp.',       quantity: 22,  cost_basis: 7100,  market_value: 10450, asset_class: 'equity', sector: 'Technology' },
  { symbol: 'NVDA', name: 'NVIDIA Corp.',          quantity: 18,  cost_basis: 4200,  market_value: 14580, asset_class: 'equity', sector: 'Technology' },
  { symbol: 'AMZN', name: 'Amazon.com Inc.',       quantity: 15,  cost_basis: 2100,  market_value: 3145,  asset_class: 'equity', sector: 'Consumer Discretionary' },
  { symbol: 'GOOGL',name: 'Alphabet Inc.',         quantity: 24,  cost_basis: 3400,  market_value: 4990,  asset_class: 'equity', sector: 'Communication Services' },
  { symbol: 'BRK.B',name: 'Berkshire Hathaway',    quantity: 12,  cost_basis: 4400,  market_value: 5720,  asset_class: 'equity', sector: 'Financials' },
  { symbol: 'JPM',  name: 'JPMorgan Chase',        quantity: 20,  cost_basis: 3200,  market_value: 4680,  asset_class: 'equity', sector: 'Financials' },
  { symbol: 'UNH',  name: 'UnitedHealth Group',    quantity: 8,   cost_basis: 3900,  market_value: 4320,  asset_class: 'equity', sector: 'Healthcare' },
  { symbol: 'VTI',  name: 'Vanguard Total Market', quantity: 30,  cost_basis: 6900,  market_value: 8250,  asset_class: 'etf',    sector: 'Diversified' },
  { symbol: 'BND',  name: 'Vanguard Total Bond',   quantity: 60,  cost_basis: 4700,  market_value: 4520,  asset_class: 'fixed_income', sector: 'Fixed Income' },
  { symbol: 'CASH', name: 'Cash & Equivalents',    quantity: 1,   cost_basis: 3200,  market_value: 3200,  asset_class: 'cash',    sector: 'Cash' },
];