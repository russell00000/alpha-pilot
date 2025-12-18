import { AssessmentData } from "@/components/InvestmentAssessment";

interface FundRecommendation {
  symbol: string;
  name: string;
  category: string;
  allocation: number;
  expenseRatio: string;
  description: string;
}

interface PortfolioAllocation {
  stocks: number;
  bonds: number;
  cash: number;
  alternatives: number;
}

interface PortfolioRecommendation {
  allocation: PortfolioAllocation;
  funds: FundRecommendation[];
  rationale: string;
}

// Calculate age from date of birth
function calculateAge(dateOfBirth: string): number {
  const today = new Date();
  const birth = new Date(dateOfBirth);
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}

// Risk score from 1-10 based on inputs
function calculateRiskScore(data: AssessmentData): number {
  let score = 5; // Start at moderate
  const age = calculateAge(data.dateOfBirth);

  // Age factor (younger = more risk capacity)
  if (age < 30) score += 2;
  else if (age < 40) score += 1;
  else if (age > 60) score -= 2;
  else if (age > 50) score -= 1;

  // Risk tolerance
  switch (data.riskTolerance) {
    case "conservative": score -= 2; break;
    case "moderate": break;
    case "aggressive": score += 2; break;
    case "very_aggressive": score += 3; break;
  }

  // Timeline
  switch (data.investmentTimeline) {
    case "less_than_1_year": score -= 3; break;
    case "1_to_3_years": score -= 2; break;
    case "3_to_5_years": score -= 1; break;
    case "5_to_10_years": score += 1; break;
    case "more_than_10_years": score += 2; break;
  }

  // Income stability
  switch (data.incomeStability) {
    case "very_stable": score += 1; break;
    case "stable": break;
    case "somewhat_unstable": score -= 1; break;
    case "unstable": score -= 2; break;
  }

  // Goal adjustments
  switch (data.investmentGoal) {
    case "emergency_fund": score -= 2; break;
    case "short_term": score -= 1; break;
    case "income": score -= 1; break;
    case "retirement": score += 1; break;
    case "wealth_building": score += 1; break;
  }

  return Math.max(1, Math.min(10, score));
}

// Fund options by category
const STOCK_FUNDS = [
  { symbol: "VTI", name: "Vanguard Total Stock Market ETF", expenseRatio: "0.03%", description: "Broad US stock market exposure" },
  { symbol: "VOO", name: "Vanguard S&P 500 ETF", expenseRatio: "0.03%", description: "Large-cap US stocks" },
  { symbol: "VGT", name: "Vanguard Information Technology ETF", expenseRatio: "0.10%", description: "Technology sector focus" },
  { symbol: "VXUS", name: "Vanguard Total International Stock ETF", expenseRatio: "0.07%", description: "International stocks diversification" },
  { symbol: "VIG", name: "Vanguard Dividend Appreciation ETF", expenseRatio: "0.06%", description: "Dividend growth stocks" },
  { symbol: "SCHD", name: "Schwab US Dividend Equity ETF", expenseRatio: "0.06%", description: "High dividend yield stocks" },
];

const BOND_FUNDS = [
  { symbol: "BND", name: "Vanguard Total Bond Market ETF", expenseRatio: "0.03%", description: "Broad US bond market" },
  { symbol: "VGSH", name: "Vanguard Short-Term Treasury ETF", expenseRatio: "0.04%", description: "Short-term government bonds" },
  { symbol: "VCIT", name: "Vanguard Intermediate-Term Corporate Bond ETF", expenseRatio: "0.04%", description: "Investment-grade corporate bonds" },
  { symbol: "TIP", name: "iShares TIPS Bond ETF", expenseRatio: "0.19%", description: "Inflation-protected securities" },
  { symbol: "VTEB", name: "Vanguard Tax-Exempt Bond ETF", expenseRatio: "0.05%", description: "Municipal bonds, tax-advantaged" },
];

const ALTERNATIVE_FUNDS = [
  { symbol: "VNQ", name: "Vanguard Real Estate ETF", expenseRatio: "0.12%", description: "Real estate investment trusts" },
  { symbol: "GLD", name: "SPDR Gold Shares", expenseRatio: "0.40%", description: "Gold bullion exposure" },
  { symbol: "DBC", name: "Invesco DB Commodity Index", expenseRatio: "0.85%", description: "Diversified commodities" },
];

const CASH_EQUIVALENTS = [
  { symbol: "VMFXX", name: "Vanguard Federal Money Market Fund", expenseRatio: "0.11%", description: "High-yield cash equivalent" },
  { symbol: "SGOV", name: "iShares 0-3 Month Treasury Bond ETF", expenseRatio: "0.05%", description: "Ultra short-term treasuries" },
];

export function generatePortfolioRecommendation(data: AssessmentData): PortfolioRecommendation {
  const riskScore = calculateRiskScore(data);
  const age = calculateAge(data.dateOfBirth);
  
  // Determine allocation based on risk score
  let allocation: PortfolioAllocation;
  let funds: FundRecommendation[] = [];
  let rationale = "";

  if (riskScore <= 2) {
    // Very Conservative
    allocation = { stocks: 15, bonds: 55, cash: 25, alternatives: 5 };
    rationale = `Based on your ${formatRiskTolerance(data.riskTolerance)} risk tolerance, ${formatTimeline(data.investmentTimeline)} investment timeline, and ${formatGoal(data.investmentGoal)} goal, we recommend a very conservative portfolio. At ${age} years old with ${formatStability(data.incomeStability)} income, this allocation prioritizes capital preservation with minimal volatility. The heavy bond allocation provides steady income while the small stock position offers some growth potential.`;
  } else if (riskScore <= 4) {
    // Conservative
    allocation = { stocks: 30, bonds: 45, cash: 15, alternatives: 10 };
    rationale = `Your ${formatRiskTolerance(data.riskTolerance)} approach combined with a ${formatTimeline(data.investmentTimeline)} timeline suggests a conservative portfolio. At ${age}, this balanced approach emphasizes stability while still participating in market growth. The bond-heavy allocation reduces volatility while providing income, ideal for your ${formatGoal(data.investmentGoal)} objective.`;
  } else if (riskScore <= 6) {
    // Moderate
    allocation = { stocks: 50, bonds: 30, cash: 10, alternatives: 10 };
    rationale = `With a ${formatRiskTolerance(data.riskTolerance)} risk profile and ${formatTimeline(data.investmentTimeline)} horizon, a balanced portfolio suits your needs. At ${age} with ${formatStability(data.incomeStability)} income, you can handle moderate market fluctuations. This 50/30 stock-to-bond split balances growth potential with stability, supporting your ${formatGoal(data.investmentGoal)} goal.`;
  } else if (riskScore <= 8) {
    // Aggressive
    allocation = { stocks: 70, bonds: 15, cash: 5, alternatives: 10 };
    rationale = `Your ${formatRiskTolerance(data.riskTolerance)} stance and ${formatTimeline(data.investmentTimeline)} timeline allow for growth-focused investing. At ${age}, you have time to recover from market downturns. This stock-heavy portfolio maximizes long-term growth potential while maintaining some bond allocation for stability, aligned with your ${formatGoal(data.investmentGoal)} objective.`;
  } else {
    // Very Aggressive
    allocation = { stocks: 85, bonds: 5, cash: 2, alternatives: 8 };
    rationale = `Given your ${formatRiskTolerance(data.riskTolerance)} risk tolerance, ${formatTimeline(data.investmentTimeline)} investment horizon, and ${formatGoal(data.investmentGoal)} focus, we recommend an aggressive growth portfolio. At ${age} with ${formatStability(data.incomeStability)} income, you can maximize equity exposure for long-term wealth building. This allocation accepts higher volatility in pursuit of superior returns.`;
  }

  // Select specific funds based on allocation
  funds = selectFunds(allocation, data);

  return { allocation, funds, rationale };
}

function selectFunds(allocation: PortfolioAllocation, data: AssessmentData): FundRecommendation[] {
  const funds: FundRecommendation[] = [];
  let remainingStocks = allocation.stocks;
  let remainingBonds = allocation.bonds;

  // Stock allocation
  if (allocation.stocks > 0) {
    // Core US stocks
    const vtiAlloc = Math.min(Math.round(allocation.stocks * 0.5), remainingStocks);
    funds.push({ ...STOCK_FUNDS[0], category: "Stock", allocation: vtiAlloc });
    remainingStocks -= vtiAlloc;

    // International diversification
    if (remainingStocks >= 10) {
      const intlAlloc = Math.min(Math.round(allocation.stocks * 0.2), remainingStocks);
      funds.push({ ...STOCK_FUNDS[3], category: "Stock", allocation: intlAlloc });
      remainingStocks -= intlAlloc;
    }

    // Dividend stocks for income goal
    if (data.investmentGoal === "income" && remainingStocks >= 10) {
      const divAlloc = remainingStocks;
      funds.push({ ...STOCK_FUNDS[5], category: "Stock", allocation: divAlloc });
      remainingStocks = 0;
    } else if (remainingStocks > 0) {
      // Growth stocks
      funds.push({ ...STOCK_FUNDS[2], category: "Stock", allocation: remainingStocks });
    }
  }

  // Bond allocation
  if (allocation.bonds > 0) {
    // Core bonds
    const bndAlloc = Math.min(Math.round(allocation.bonds * 0.6), remainingBonds);
    funds.push({ ...BOND_FUNDS[0], category: "Bond", allocation: bndAlloc });
    remainingBonds -= bndAlloc;

    // Short-term for stability
    if (remainingBonds > 0 && data.investmentTimeline === "less_than_1_year") {
      funds.push({ ...BOND_FUNDS[1], category: "Bond", allocation: remainingBonds });
    } else if (remainingBonds > 0) {
      // Inflation protection
      funds.push({ ...BOND_FUNDS[3], category: "Bond", allocation: remainingBonds });
    }
  }

  // Alternatives
  if (allocation.alternatives > 0) {
    if (allocation.alternatives >= 5) {
      funds.push({ ...ALTERNATIVE_FUNDS[0], category: "Alternative", allocation: Math.round(allocation.alternatives * 0.6) });
      funds.push({ ...ALTERNATIVE_FUNDS[1], category: "Alternative", allocation: Math.round(allocation.alternatives * 0.4) });
    } else {
      funds.push({ ...ALTERNATIVE_FUNDS[0], category: "Alternative", allocation: allocation.alternatives });
    }
  }

  // Cash
  if (allocation.cash > 0) {
    funds.push({ ...CASH_EQUIVALENTS[0], category: "Cash", allocation: allocation.cash });
  }

  return funds;
}

function formatRiskTolerance(risk: string): string {
  const map: Record<string, string> = {
    conservative: "conservative",
    moderate: "moderate",
    aggressive: "aggressive",
    very_aggressive: "very aggressive",
  };
  return map[risk] || risk;
}

function formatTimeline(timeline: string): string {
  const map: Record<string, string> = {
    less_than_1_year: "short-term (< 1 year)",
    "1_to_3_years": "1-3 year",
    "3_to_5_years": "3-5 year",
    "5_to_10_years": "5-10 year",
    more_than_10_years: "long-term (10+ year)",
  };
  return map[timeline] || timeline;
}

function formatGoal(goal: string): string {
  const map: Record<string, string> = {
    retirement: "retirement planning",
    wealth_building: "wealth building",
    income: "income generation",
    short_term: "short-term savings",
    education: "education funding",
    emergency_fund: "emergency fund",
  };
  return map[goal] || goal;
}

function formatStability(stability: string): string {
  const map: Record<string, string> = {
    very_stable: "very stable",
    stable: "stable",
    somewhat_unstable: "somewhat variable",
    unstable: "variable",
  };
  return map[stability] || stability;
}