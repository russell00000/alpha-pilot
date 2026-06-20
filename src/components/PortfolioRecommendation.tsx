import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw, TrendingUp, Shield, Clock, Target, ArrowUpRight, ArrowDownRight, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import WhatIfInvested from "./WhatIfInvested";

interface LiveMarketData {
  symbol: string;
  price: string;
  change: number;
  changePercent: number;
}

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

const CATEGORY_COLORS: Record<string, string> = {
  "Stock ETF": "hsl(212, 88%, 62%)",          // Vivid blue
  "International ETF": "hsl(268, 75%, 68%)",  // Vivid purple
  "Dividend ETF": "hsl(150, 65%, 50%)",       // Emerald
  "Sector ETF": "hsl(18, 88%, 60%)",          // Bright terracotta
  "Bond ETF": "hsl(45, 95%, 58%)",            // Gold
  "Treasury ETF": "hsl(180, 70%, 48%)",       // Teal
  "TIPS ETF": "hsl(348, 82%, 62%)",           // Rose
  "Real Estate": "hsl(320, 75%, 62%)",        // Magenta
  "Commodity": "hsl(82, 60%, 52%)",           // Lime
  "Money Market": "hsl(195, 80%, 58%)",       // Sky
  // Fallbacks for older data
  "Stock": "hsl(212, 88%, 62%)",
  "Bond": "hsl(45, 95%, 58%)",
  "ETF": "hsl(18, 88%, 60%)",
  "Cash": "hsl(150, 65%, 50%)",
  "Alternative": "hsl(320, 75%, 62%)",
  "Cash + Alternatives": "hsl(150, 65%, 50%)",
};

const getColor = (category: string) => CATEGORY_COLORS[category] || "hsl(var(--muted-foreground))";

// Custom donut ring chart component matching reference design
const DonutRingChart = ({ data, investmentAmount }: { data: { name: string; value: number; color: string }[]; investmentAmount: number }) => {
  const viewSize = 440;
  const cx = viewSize / 2;
  const cy = viewSize / 2;
  const radius = 165;
  const strokeWidth = 6;
  const gap = 0.04; // gap in radians between segments

  // Calculate arc segments
  const total = data.reduce((sum, d) => sum + d.value, 0);
  let currentAngle = -Math.PI / 2; // start at top

  const rawSegments = data.map((item) => {
    const segAngle = (item.value / total) * (2 * Math.PI) - gap;
    const startAngle = currentAngle + gap / 2;
    const endAngle = startAngle + segAngle;
    const midAngle = startAngle + segAngle / 2;

    const x1 = cx + Math.cos(startAngle) * radius;
    const y1 = cy + Math.sin(startAngle) * radius;
    const x2 = cx + Math.cos(endAngle) * radius;
    const y2 = cy + Math.sin(endAngle) * radius;
    const largeArc = segAngle > Math.PI ? 1 : 0;

    const path = `M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`;

    currentAngle = endAngle + gap / 2;

    return { ...item, path, midAngle, percent: (item.value / total) * 100 };
  });

  // Place labels outside the ring, then resolve vertical overlaps for nearby small slices.
  const labelRadius = radius + 28;
  const labeled = rawSegments.map((seg) => ({
    ...seg,
    labelX: cx + Math.cos(seg.midAngle) * labelRadius,
    labelY: cy + Math.sin(seg.midAngle) * labelRadius,
  }));
  // Resolve overlaps by nudging labels vertically when two are too close together.
  const sorted = [...labeled].sort((a, b) => a.labelY - b.labelY);
  const minGap = 20;
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const cur = sorted[i];
    if (Math.abs(cur.labelX - prev.labelX) < 80 && cur.labelY - prev.labelY < minGap) {
      cur.labelY = prev.labelY + minGap;
    }
  }
  const segments = labeled;

  return (
    <svg viewBox={`0 0 ${viewSize} ${viewSize}`} className="w-full h-full max-w-[440px] mx-auto">
      {/* Arc segments — outline only, no fill */}
      {segments.map((seg, i) => (
        <path
          key={i}
          d={seg.path}
          fill="none"
          stroke={seg.color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />
      ))}

      {/* Category labels */}
      {segments.map((seg, i) => (
        <text
          key={`label-${i}`}
          x={seg.labelX}
          y={seg.labelY}
          textAnchor={seg.labelX > cx + 4 ? "start" : seg.labelX < cx - 4 ? "end" : "middle"}
          dominantBaseline="central"
          className="fill-foreground"
          fontSize={17}
          fontWeight={500}
          style={{ fontFamily: 'Inter, system-ui, sans-serif' }}
        >
          {seg.name}
        </text>
      ))}

      {/* Center dark circle */}
      <circle cx={cx} cy={cy} r={64} className="fill-background" />
      <circle cx={cx} cy={cy} r={64} fill="hsl(var(--foreground))" fillOpacity={0.08} />
      <text
        x={cx}
        y={cy - 10}
        textAnchor="middle"
        dominantBaseline="central"
        className="fill-foreground"
        fontSize={13}
        fontWeight={600}
        letterSpacing="0.1em"
      >
        ASSET
      </text>
      <text
        x={cx}
        y={cy + 10}
        textAnchor="middle"
        dominantBaseline="central"
        className="fill-foreground"
        fontSize={13}
        fontWeight={600}
        letterSpacing="0.1em"
      >
        ALLOCATION
      </text>
    </svg>
  );
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
  const navigate = useNavigate();
  const [liveMarketData, setLiveMarketData] = useState<Record<string, LiveMarketData>>({});
  const [loadingPrices, setLoadingPrices] = useState(false);

  // Fetch live prices for all fund symbols
  useEffect(() => {
    const fetchPrices = async () => {
      const symbols = funds.map(f => f.symbol).filter(s => s !== "CASH");
      if (symbols.length === 0) return;

      setLoadingPrices(true);
      try {
        const { data, error } = await supabase.functions.invoke("market-data", {
          body: { symbols },
        });

        if (!error && data?.data) {
          const map: Record<string, LiveMarketData> = {};
          for (const item of data.data) {
            map[item.symbol] = {
              symbol: item.symbol,
              price: item.price,
              change: item.change,
              changePercent: item.changePercent,
            };
          }
          setLiveMarketData(map);
        }
      } catch (err) {
        console.error("Error fetching live prices:", err);
      } finally {
        setLoadingPrices(false);
      }
    };

    fetchPrices();
    // Refresh every 5 minutes
    const interval = setInterval(fetchPrices, 300000);
    return () => clearInterval(interval);
  }, [funds]);

  // Build pie data from individual fund categories for granular breakdown
  const categoryMap = new Map<string, number>();
  funds.forEach((fund) => {
    const existing = categoryMap.get(fund.category) || 0;
    categoryMap.set(fund.category, existing + fund.allocation);
  });
  // Merge Cash + Alternative into a single allocation slice
  const cashValue = (categoryMap.get("Cash") || 0) + (categoryMap.get("Alternative") || 0);
  categoryMap.delete("Cash");
  categoryMap.delete("Alternative");
  if (cashValue > 0) categoryMap.set("Cash + Alternatives", cashValue);
  const pieData = Array.from(categoryMap.entries())
    .map(([name, value]) => ({ name, value, color: getColor(name) }))
    .filter((item) => item.value > 0)
    .sort((a, b) => b.value - a.value);

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
        {/* Donut Ring Chart */}
        <div className="glass-card p-6">
          <h3 className="text-lg font-semibold text-foreground mb-4">Asset Allocation</h3>
          <div className="flex items-center justify-center h-72">
            <DonutRingChart data={pieData} investmentAmount={investmentAmount} />
          </div>
          <div className="grid grid-cols-2 gap-2 mt-4">
            {pieData.map((entry) => (
              <div key={entry.name} className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-muted/30 transition-colors">
                <div
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: entry.color }}
                />
                <span className="text-sm text-muted-foreground truncate">{entry.name}</span>
                <span className="text-sm font-medium text-foreground ml-auto">{entry.value}%</span>
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

          {/* Per-Security Allocation */}
          <div className="mt-8 pt-6 border-t border-border/40">
            <h3 className="text-lg font-semibold text-foreground mb-1">Per-Security Allocation</h3>
            <p className="text-xs text-muted-foreground mb-4">Percentage of your portfolio in each holding by name</p>
            <div className="space-y-3">
              {[...funds]
                .sort((a, b) => b.allocation - a.allocation)
                .map((fund) => {
                  const amount = (investmentAmount * fund.allocation) / 100;
                  const color = getColor(fund.category);
                  return (
                    <div key={fund.symbol} className="space-y-1.5">
                      <div className="flex justify-between text-sm gap-2">
                        <span className="text-foreground font-medium truncate">
                          <span className="font-mono text-xs text-muted-foreground mr-2">{fund.symbol}</span>
                          {fund.name}
                        </span>
                        <span className="text-muted-foreground whitespace-nowrap">
                          ${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ({fund.allocation.toFixed(1)}%)
                        </span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{ width: `${fund.allocation}%`, backgroundColor: color }}
                        />
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      </div>

      {/* Rationale */}
      <div className="glass-card p-6">
        <h3 className="text-lg font-semibold text-foreground mb-3">Why This Portfolio?</h3>
        <p className="text-muted-foreground leading-relaxed">{rationale}</p>
      </div>

      {/* Fund Recommendations with Live Data */}
      <div className="glass-card overflow-hidden">
        <div className="p-4 border-b border-border/50 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-foreground">Recommended Holdings</h3>
            <p className="text-sm text-muted-foreground">Live prices and portfolio performance</p>
          </div>
          {loadingPrices && (
            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border/50 bg-muted/30">
                <th className="text-left p-4 text-sm font-medium text-muted-foreground">Asset</th>
                <th className="text-left p-4 text-sm font-medium text-muted-foreground">Category</th>
                <th className="text-right p-4 text-sm font-medium text-muted-foreground">Price</th>
                <th className="text-right p-4 text-sm font-medium text-muted-foreground">Daily Change</th>
                <th className="text-right p-4 text-sm font-medium text-muted-foreground">Allocation</th>
                <th className="text-right p-4 text-sm font-medium text-muted-foreground">Value</th>
              </tr>
            </thead>
            <tbody>
              {funds.map((fund) => {
                const allocatedAmount = (investmentAmount * fund.allocation) / 100;
                const liveData = liveMarketData[fund.symbol];
                const currentPrice = liveData ? parseFloat(liveData.price) : null;
                const dailyChange = liveData?.change ?? null;
                const dailyChangePercent = liveData?.changePercent ?? null;
                
                // Simulate total gain based on daily change as a proxy
                // In a real app this would track from purchase date
                const totalGain = dailyChange !== null && currentPrice !== null
                  ? (allocatedAmount * (dailyChangePercent! / 100))
                  : null;
                const totalGainPercent = dailyChangePercent;

                return (
                  <tr
                    key={fund.symbol}
                    className={cn(
                      "border-b border-border/50 transition-colors",
                      fund.symbol !== "CASH" && "hover:bg-muted/20 cursor-pointer"
                    )}
                    onClick={() => fund.symbol !== "CASH" && navigate(`/stock/${fund.symbol}`)}
                  >
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        {fund.symbol === "CASH" ? (
                          <div className="w-8 h-8 rounded-full bg-muted/50 flex-shrink-0 flex items-center justify-center">
                            <span className="text-xs font-bold text-muted-foreground">$</span>
                          </div>
                        ) : (
                          <div className="w-8 h-8 rounded-full overflow-hidden bg-muted/50 flex-shrink-0 flex items-center justify-center">
                            <img
                              src={`https://assets.parqet.com/logos/symbol/${fund.symbol}`}
                              className="w-full h-full object-cover"
                              alt={fund.symbol}
                              onError={(e) => {
                                const target = e.currentTarget;
                                target.style.display = 'none';
                                if (target.nextElementSibling) (target.nextElementSibling as HTMLElement).style.display = 'flex';
                              }}
                            />
                            <span className="hidden items-center justify-center w-full h-full text-xs font-bold text-muted-foreground">
                              {fund.symbol.slice(0, 2)}
                            </span>
                          </div>
                        )}
                        <div>
                          <p className="font-semibold text-foreground">{fund.symbol}</p>
                          <p className="text-sm text-muted-foreground truncate max-w-[180px]">{fund.name}</p>
                          {fund.description && (
                            <p className="text-xs text-muted-foreground/70 mt-0.5 max-w-[260px]">{fund.description}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      <span
                        className="px-2 py-1 rounded-full text-xs font-medium"
                        style={{
                          backgroundColor: `${getColor(fund.category)}20`,
                          color: getColor(fund.category),
                        }}
                      >
                        {fund.category}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      {currentPrice !== null ? (
                        <span className="font-medium text-foreground">${currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      ) : (
                        <span className="text-muted-foreground text-sm">—</span>
                      )}
                    </td>
                    <td className="p-4 text-right">
                      {dailyChange !== null ? (
                        <div className="flex items-center justify-end gap-1">
                          {dailyChangePercent! >= 0 ? (
                            <ArrowUpRight className="w-3.5 h-3.5 text-emerald-500" />
                          ) : (
                            <ArrowDownRight className="w-3.5 h-3.5 text-red-500" />
                          )}
                          <span className={cn("text-sm font-medium", dailyChangePercent! >= 0 ? "text-emerald-500" : "text-red-500")}>
                            {dailyChangePercent! >= 0 ? "+" : ""}{dailyChangePercent!.toFixed(2)}%
                          </span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">—</span>
                      )}
                    </td>
                    <td className="p-4 text-right font-medium text-foreground">{fund.allocation}%</td>
                    <td className="p-4 text-right text-foreground">
                      ${allocatedAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-4 text-right">
                      {totalGain !== null ? (
                        <div>
                          <span className={cn("font-medium", totalGain >= 0 ? "text-emerald-500" : "text-red-500")}>
                            {totalGain >= 0 ? "+" : ""}${Math.abs(totalGain).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                          <p className={cn("text-xs", totalGainPercent! >= 0 ? "text-emerald-500/70" : "text-red-500/70")}>
                            {totalGainPercent! >= 0 ? "+" : ""}{totalGainPercent!.toFixed(2)}%
                          </p>
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {/* Portfolio Total Row */}
            {Object.keys(liveMarketData).length > 0 && (
              <tfoot>
                <tr className="bg-muted/30 font-medium">
                  <td className="p-4 text-foreground" colSpan={5}>Portfolio Total</td>
                  <td className="p-4 text-right text-foreground">
                    ${investmentAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>
                  <td className="p-4 text-right">
                    {(() => {
                      const totalGain = funds.reduce((sum, fund) => {
                        const liveData = liveMarketData[fund.symbol];
                        if (!liveData) return sum;
                        const allocatedAmount = (investmentAmount * fund.allocation) / 100;
                        return sum + (allocatedAmount * (liveData.changePercent / 100));
                      }, 0);
                      return (
                        <span className={cn("font-semibold", totalGain >= 0 ? "text-emerald-500" : "text-red-500")}>
                          {totalGain >= 0 ? "+" : ""}${Math.abs(totalGain).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      );
                    })()}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Historical What-If */}
      <WhatIfInvested funds={funds} investmentAmount={investmentAmount} />

      {/* Disclaimer */}
      <p className="text-xs text-muted-foreground text-center p-4 bg-muted/30 rounded-lg">
        <strong>Disclaimer:</strong> This portfolio recommendation is for educational purposes only and does not constitute financial advice. 
        Past performance is not indicative of future results. Please consult a licensed financial advisor before making investment decisions.
      </p>
    </div>
  );
};

export default PortfolioRecommendation;