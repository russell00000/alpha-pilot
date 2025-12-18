import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { Button } from "@/components/ui/button";
import { RefreshCw, TrendingUp, Shield, Clock, Target } from "lucide-react";
import { cn } from "@/lib/utils";

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

interface RecommendationProps {
  allocation: PortfolioAllocation;
  funds: FundRecommendation[];
  rationale: string;
  investmentAmount: number;
  riskProfile: string;
  timeline: string;
  goal: string;
  onRetakeAssessment: () => void;
}

const COLORS = {
  stocks: "hsl(var(--primary))",
  bonds: "hsl(var(--chart-2))",
  cash: "hsl(var(--chart-4))",
  alternatives: "hsl(var(--chart-5))",
};

const PortfolioRecommendation = ({
  allocation,
  funds,
  rationale,
  investmentAmount,
  riskProfile,
  timeline,
  goal,
  onRetakeAssessment,
}: RecommendationProps) => {
  const pieData = [
    { name: "Stocks", value: allocation.stocks, color: COLORS.stocks },
    { name: "Bonds", value: allocation.bonds, color: COLORS.bonds },
    { name: "Cash", value: allocation.cash, color: COLORS.cash },
    { name: "Alternatives", value: allocation.alternatives, color: COLORS.alternatives },
  ].filter((item) => item.value > 0);

  const formatRiskProfile = (risk: string) => {
    const map: Record<string, string> = {
      conservative: "Conservative",
      moderate: "Moderate",
      aggressive: "Aggressive",
      very_aggressive: "Very Aggressive",
    };
    return map[risk] || risk;
  };

  const formatTimeline = (t: string) => {
    const map: Record<string, string> = {
      less_than_1_year: "< 1 Year",
      "1_to_3_years": "1-3 Years",
      "3_to_5_years": "3-5 Years",
      "5_to_10_years": "5-10 Years",
      more_than_10_years: "10+ Years",
    };
    return map[t] || t;
  };

  const formatGoal = (g: string) => {
    const map: Record<string, string> = {
      retirement: "Retirement",
      wealth_building: "Wealth Building",
      income: "Income Generation",
      short_term: "Short-term Savings",
      education: "Education",
      emergency_fund: "Emergency Fund",
    };
    return map[g] || g;
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const amount = (investmentAmount * data.value) / 100;
      return (
        <div className="bg-popover border border-border rounded-lg p-3 shadow-lg">
          <p className="font-semibold text-foreground">{data.name}</p>
          <p className="text-sm text-muted-foreground">{data.value.toFixed(1)}%</p>
          <p className="text-sm font-medium text-primary">
            ${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Your Personalized Portfolio</h2>
          <p className="text-muted-foreground">Based on your investment profile and goals</p>
        </div>
        <Button variant="outline" onClick={onRetakeAssessment} className="gap-2">
          <RefreshCw className="w-4 h-4" />
          Retake Assessment
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="glass-card p-4">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="w-4 h-4 text-primary" />
            <span className="text-xs text-muted-foreground">Risk Profile</span>
          </div>
          <p className="font-semibold text-foreground">{formatRiskProfile(riskProfile)}</p>
        </div>
        <div className="glass-card p-4">
          <div className="flex items-center gap-2 mb-1">
            <Clock className="w-4 h-4 text-primary" />
            <span className="text-xs text-muted-foreground">Timeline</span>
          </div>
          <p className="font-semibold text-foreground">{formatTimeline(timeline)}</p>
        </div>
        <div className="glass-card p-4">
          <div className="flex items-center gap-2 mb-1">
            <Target className="w-4 h-4 text-primary" />
            <span className="text-xs text-muted-foreground">Goal</span>
          </div>
          <p className="font-semibold text-foreground">{formatGoal(goal)}</p>
        </div>
        <div className="glass-card p-4">
          <div className="flex items-center gap-2 mb-1">
            <Shield className="w-4 h-4 text-primary" />
            <span className="text-xs text-muted-foreground">Investment</span>
          </div>
          <p className="font-semibold text-foreground">
            ${investmentAmount.toLocaleString()}
          </p>
        </div>
      </div>

      {/* Allocation Chart & Breakdown */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Pie Chart */}
        <div className="glass-card p-6">
          <h3 className="text-lg font-semibold text-foreground mb-4">Asset Allocation</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={2}
                  dataKey="value"
                  label={({ name, value }) => `${name} ${value.toFixed(0)}%`}
                  labelLine={false}
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} strokeWidth={0} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap justify-center gap-4 mt-4">
            {pieData.map((entry) => (
              <div key={entry.name} className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: entry.color }}
                />
                <span className="text-sm text-muted-foreground">{entry.name}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Allocation Breakdown */}
        <div className="glass-card p-6">
          <h3 className="text-lg font-semibold text-foreground mb-4">Dollar Breakdown</h3>
          <div className="space-y-4">
            {pieData.map((entry) => {
              const amount = (investmentAmount * entry.value) / 100;
              return (
                <div key={entry.name} className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-foreground font-medium">{entry.name}</span>
                    <span className="text-muted-foreground">
                      ${amount.toLocaleString(undefined, { minimumFractionDigits: 2 })} ({entry.value.toFixed(1)}%)
                    </span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${entry.value}%`,
                        backgroundColor: entry.color,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Rationale */}
      <div className="glass-card p-6">
        <h3 className="text-lg font-semibold text-foreground mb-3">Why This Portfolio?</h3>
        <p className="text-muted-foreground leading-relaxed">{rationale}</p>
      </div>

      {/* Fund Recommendations */}
      <div className="glass-card overflow-hidden">
        <div className="p-4 border-b border-border/50">
          <h3 className="text-lg font-semibold text-foreground">Recommended Funds</h3>
          <p className="text-sm text-muted-foreground">Specific investments to build your portfolio</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border/50 bg-muted/30">
                <th className="text-left p-4 text-sm font-medium text-muted-foreground">Fund</th>
                <th className="text-left p-4 text-sm font-medium text-muted-foreground">Category</th>
                <th className="text-right p-4 text-sm font-medium text-muted-foreground">Allocation</th>
                <th className="text-right p-4 text-sm font-medium text-muted-foreground">Amount</th>
                <th className="text-right p-4 text-sm font-medium text-muted-foreground">Expense Ratio</th>
              </tr>
            </thead>
            <tbody>
              {funds.map((fund) => {
                const amount = (investmentAmount * fund.allocation) / 100;
                return (
                  <tr key={fund.symbol} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                    <td className="p-4">
                      <div>
                        <p className="font-semibold text-foreground">{fund.symbol}</p>
                        <p className="text-sm text-muted-foreground">{fund.name}</p>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className={cn(
                        "px-2 py-1 rounded-full text-xs font-medium",
                        fund.category === "Stock" && "bg-primary/10 text-primary",
                        fund.category === "Bond" && "bg-chart-2/20 text-chart-2",
                        fund.category === "ETF" && "bg-chart-3/20 text-chart-3",
                        fund.category === "Cash" && "bg-chart-4/20 text-chart-4",
                        fund.category === "Alternative" && "bg-chart-5/20 text-chart-5"
                      )}>
                        {fund.category}
                      </span>
                    </td>
                    <td className="p-4 text-right font-medium text-foreground">{fund.allocation}%</td>
                    <td className="p-4 text-right text-foreground">
                      ${amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-4 text-right text-muted-foreground">{fund.expenseRatio}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Disclaimer */}
      <p className="text-xs text-muted-foreground text-center p-4 bg-muted/30 rounded-lg">
        <strong>Disclaimer:</strong> This portfolio recommendation is for educational purposes only and does not constitute financial advice. 
        Past performance is not indicative of future results. Please consult a licensed financial advisor before making investment decisions.
      </p>
    </div>
  );
};

export default PortfolioRecommendation;