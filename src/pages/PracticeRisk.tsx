import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { usePracticeTrading } from "@/hooks/usePracticeTrading";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import {
  ArrowLeft, ShieldAlert, TrendingUp, BarChart3, PieChart,
  AlertTriangle, Activity, Target, Zap, TrendingDown, Shield, Layers
} from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface StockRiskData {
  symbol: string;
  name: string;
  quantity: number;
  avgCost: number;
  currentPrice: number;
  dailyChange: number;
  dailyChangePct: number;
  weight: number;
}

// Simulated asset-class volatility profiles (annualized daily std dev estimates)
const ASSET_VOLATILITY: Record<string, number> = {
  // Crypto
  BTC: 4.2, ETH: 5.1, SOL: 6.5, DOGE: 7.0, ADA: 5.8, XRP: 5.0, AVAX: 6.0, DOT: 5.5, MATIC: 5.8, LINK: 5.3,
  // High-vol stocks
  TSLA: 3.2, NVDA: 3.0, AMD: 2.8, MSTR: 4.5, RIVN: 4.0, PLTR: 3.5,
  // Moderate stocks
  AAPL: 1.5, MSFT: 1.4, AMZN: 1.8, GOOGL: 1.6, META: 2.2, NFLX: 2.5,
  // Low-vol / defensive
  JNJ: 0.9, PG: 0.8, KO: 0.7, WMT: 0.9, BRK: 0.9,
  // Bonds / ETFs
  BND: 0.3, AGG: 0.3, TLT: 0.8, SPY: 1.1, QQQ: 1.5, VOO: 1.1, VTI: 1.1, IWM: 1.5, DIA: 1.0, GLD: 1.0, SLV: 1.8,
};

const ASSET_BETA: Record<string, number> = {
  BTC: 1.8, ETH: 2.0, SOL: 2.5, DOGE: 2.8, ADA: 2.2, XRP: 2.0, AVAX: 2.3,
  TSLA: 1.9, NVDA: 1.7, AMD: 1.6, PLTR: 1.8, RIVN: 2.1, MSTR: 2.5,
  AAPL: 1.2, MSFT: 1.1, AMZN: 1.3, GOOGL: 1.1, META: 1.4, NFLX: 1.3,
  JNJ: 0.6, PG: 0.5, KO: 0.5, WMT: 0.5, BRK: 0.8,
  BND: 0.05, AGG: 0.05, TLT: -0.2, SPY: 1.0, QQQ: 1.15, VOO: 1.0, VTI: 1.0, IWM: 1.2, DIA: 0.95, GLD: 0.1, SLV: 0.3,
};

function getVolatility(symbol: string, dailyPct: number): number {
  return ASSET_VOLATILITY[symbol.toUpperCase()] ?? Math.max(Math.abs(dailyPct) * 1.5, 1.0);
}

function getBeta(symbol: string): number {
  return ASSET_BETA[symbol.toUpperCase()] ?? 1.0;
}

// Stress scenario multipliers (how much worse than normal daily move)
const STRESS_SCENARIOS = [
  { name: "Market Correction (-10%)", marketDrop: -10, description: "Broad market decline similar to typical correction" },
  { name: "Flash Crash (-20%)", marketDrop: -20, description: "Severe single-day crash event like 2020 COVID shock" },
  { name: "Rate Shock (-15%)", marketDrop: -15, description: "Sudden interest rate spike impacting growth stocks heavily" },
  { name: "Mild Pullback (-5%)", marketDrop: -5, description: "Routine pullback within a bull market trend" },
];

const PracticeRisk = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { cashBalance, holdings, loading } = usePracticeTrading();
  const [livePrices, setLivePrices] = useState<Record<string, { price: number; change: number; changePct: number }>>({});

  const fetchLivePrices = useCallback(async () => {
    if (holdings.length === 0) return;
    try {
      const symbols = holdings.map(h => h.symbol);
      const { data } = await supabase.functions.invoke("market-data", { body: { symbols } });
      const results = data?.data;
      if (Array.isArray(results)) {
        const p: Record<string, { price: number; change: number; changePct: number }> = {};
        for (const item of results) {
          p[item.symbol] = {
            price: parseFloat(item.price),
            change: item.change || 0,
            changePct: item.changePercent || 0,
          };
        }
        setLivePrices(p);
      }
    } catch { /* ignore */ }
  }, [holdings]);

  useEffect(() => {
    fetchLivePrices();
  }, [fetchLivePrices]);

  if (!authLoading && !user) {
    navigate("/auth");
    return null;
  }

  // Build risk data
  const totalPortfolioValue = cashBalance + holdings.reduce((sum, h) => {
    const price = livePrices[h.symbol]?.price ?? h.avg_cost_basis;
    return sum + h.quantity * price;
  }, 0);

  const stockRiskData: StockRiskData[] = holdings.map(h => {
    const priceData = livePrices[h.symbol];
    const currentPrice = priceData?.price ?? h.avg_cost_basis;
    const holdingValue = h.quantity * currentPrice;
    return {
      symbol: h.symbol,
      name: h.name,
      quantity: h.quantity,
      avgCost: h.avg_cost_basis,
      currentPrice,
      dailyChange: priceData?.change ?? 0,
      dailyChangePct: priceData?.changePct ?? 0,
      weight: totalPortfolioValue > 0 ? (holdingValue / totalPortfolioValue) * 100 : 0,
    };
  });

  // Portfolio-level metrics
  const cashWeight = totalPortfolioValue > 0 ? (cashBalance / totalPortfolioValue) * 100 : 0;
  const maxWeight = Math.max(...stockRiskData.map(s => s.weight), 0);
  const numHoldings = holdings.length;

  // --- QUANTITATIVE METRICS ---

  // Portfolio Beta (weighted average)
  const portfolioBeta = stockRiskData.length > 0
    ? stockRiskData.reduce((sum, s) => sum + (s.weight / 100) * getBeta(s.symbol), 0)
    : 0;

  // Portfolio Std Dev (weighted, simplified - assumes low correlation ~0.5 between assets)
  const avgCorrelation = 0.5;
  const weightedVols = stockRiskData.map(s => ({
    weight: s.weight / 100,
    vol: getVolatility(s.symbol, s.dailyChangePct),
  }));
  
  const portfolioVariance = weightedVols.reduce((sum, a, i) => {
    return sum + weightedVols.reduce((inner, b, j) => {
      const corr = i === j ? 1.0 : avgCorrelation;
      return inner + a.weight * b.weight * a.vol * b.vol * corr;
    }, 0);
  }, 0);
  const portfolioStdDev = Math.sqrt(portfolioVariance);
  const annualizedStdDev = portfolioStdDev * Math.sqrt(252);

  // Expected Daily Movement Range (1 std dev = ~68% of days fall within this range)
  const investedValue = totalPortfolioValue - cashBalance;
  const dailyMoveAmt = investedValue * portfolioStdDev / 100;
  const dailyMovePct = portfolioStdDev;

  // Sharpe Ratio (annualized, risk-free rate ~4.5%)
  const riskFreeRate = 4.5;
  const totalGainLoss = stockRiskData.reduce((sum, s) => sum + (s.currentPrice - s.avgCost) * s.quantity, 0);
  const portfolioReturn = investedValue > 0 ? (totalGainLoss / (investedValue - totalGainLoss)) * 100 : 0;
  const annualizedReturn = portfolioReturn * 252; // rough scaling
  const sharpeRatio = annualizedStdDev > 0 ? (annualizedReturn - riskFreeRate) / annualizedStdDev : 0;

  // Concentration (Herfindahl-Hirschman Index)
  const hhi = stockRiskData.reduce((sum, s) => sum + Math.pow(s.weight, 2), 0) + Math.pow(cashWeight, 2);
  const normalizedHHI = hhi / 10000; // 0-1 scale, 1 = fully concentrated

  // Diversification Score (more sophisticated)
  const diversificationScore = numHoldings === 0
    ? 0
    : Math.min(100, Math.round(
        (1 - normalizedHHI) * 60 + // concentration component
        Math.min(numHoldings, 10) * 3 + // holdings count
        (cashWeight > 5 && cashWeight < 40 ? 10 : 0) // healthy cash buffer
      ));

  // Overall risk classification
  const overallRisk = portfolioStdDev > 3.5 ? "High" : portfolioStdDev > 1.8 ? "Medium" : "Low";

  // Concentration risk
  const concentrationRisk = maxWeight > 50 ? "High" : maxWeight > 30 ? "Medium" : "Low";

  const riskColor = (level: string) =>
    level === "High" ? "text-red-500" : level === "Medium" ? "text-amber-500" : "text-green-500";
  const riskBg = (level: string) =>
    level === "High" ? "bg-red-500/10" : level === "Medium" ? "bg-amber-500/10" : "bg-green-500/10";

  // --- STRESS TESTING ---
  const stressResults = STRESS_SCENARIOS.map(scenario => {
    const portfolioLoss = stockRiskData.reduce((sum, s) => {
      const beta = getBeta(s.symbol);
      const positionValue = s.quantity * s.currentPrice;
      const estimatedLoss = positionValue * (scenario.marketDrop / 100) * beta;
      return sum + estimatedLoss;
    }, 0);
    const lossPercent = totalPortfolioValue > 0 ? (portfolioLoss / totalPortfolioValue) * 100 : 0;
    return { ...scenario, portfolioLoss, lossPercent };
  });

  // --- CORRELATION BUCKETS ---
  type AssetClass = "Growth Tech" | "Value/Defensive" | "Crypto" | "Bonds/Fixed" | "Index ETFs" | "Other";
  const classifyAsset = (symbol: string): AssetClass => {
    const s = symbol.toUpperCase();
    if (["BTC", "ETH", "SOL", "DOGE", "ADA", "XRP", "AVAX", "DOT", "MATIC", "LINK"].includes(s)) return "Crypto";
    if (["BND", "AGG", "TLT"].includes(s)) return "Bonds/Fixed";
    if (["SPY", "QQQ", "VOO", "VTI", "IWM", "DIA"].includes(s)) return "Index ETFs";
    if (["JNJ", "PG", "KO", "WMT", "BRK"].includes(s)) return "Value/Defensive";
    if (["TSLA", "NVDA", "AMD", "AAPL", "MSFT", "AMZN", "GOOGL", "META", "NFLX", "PLTR", "RIVN", "MSTR"].includes(s)) return "Growth Tech";
    return "Other";
  };

  const assetClassWeights: Record<string, number> = {};
  stockRiskData.forEach(s => {
    const cls = classifyAsset(s.symbol);
    assetClassWeights[cls] = (assetClassWeights[cls] || 0) + s.weight;
  });
  if (cashWeight > 0) assetClassWeights["Cash"] = cashWeight;

  const classColors: Record<string, string> = {
    "Growth Tech": "bg-blue-500",
    "Value/Defensive": "bg-emerald-500",
    "Crypto": "bg-orange-500",
    "Bonds/Fixed": "bg-cyan-500",
    "Index ETFs": "bg-violet-500",
    "Cash": "bg-green-500",
    "Other": "bg-gray-500",
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container px-4 md:px-6 py-8">
        <Button variant="ghost" size="sm" className="mb-4 gap-2" onClick={() => navigate("/practice")}>
          <ArrowLeft className="h-4 w-4" /> Back to Practice
        </Button>

        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
            <ShieldAlert className="h-8 w-8 text-primary" />
            Volatility & Risk Analysis
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Institutional-grade portfolio risk metrics, stress testing & correlation analysis
          </p>
        </div>

        {/* ========== SECTION 1: KEY QUANTITATIVE METRICS ========== */}
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
          <Activity className="h-4 w-4" /> Quantitative Risk Metrics
        </h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
          {/* Daily Movement Range */}
          <div className="rounded-xl border border-border/60 bg-card p-5">
            <div className="flex items-center gap-2 mb-2">
              <TrendingDown className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground uppercase tracking-wide">Avg Daily Range</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold text-green-500">{loading ? "—" : `+$${dailyMoveAmt.toFixed(2)}`}</span>
              <span className="text-muted-foreground text-sm">to</span>
              <span className="text-lg font-bold text-red-500">{loading ? "—" : `-$${dailyMoveAmt.toFixed(2)}`}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Expected daily movement (±{dailyMovePct.toFixed(2)}%)</p>
          </div>

          {/* Beta vs S&P 500 */}
          <div className="rounded-xl border border-border/60 bg-card p-5">
            <div className="flex items-center gap-2 mb-2">
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground uppercase tracking-wide">Beta (β) vs S&P 500</span>
            </div>
            <p className={`text-2xl font-bold ${portfolioBeta > 1.5 ? "text-red-400" : portfolioBeta > 1.0 ? "text-amber-400" : "text-green-400"}`}>
              {loading ? "—" : portfolioBeta.toFixed(2)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {portfolioBeta > 1.5
                ? `${(portfolioBeta * 100 - 100).toFixed(0)}% more volatile than S&P 500`
                : portfolioBeta > 1.0
                ? `${(portfolioBeta * 100 - 100).toFixed(0)}% above S&P 500 volatility`
                : portfolioBeta > 0.5
                ? `${(100 - portfolioBeta * 100).toFixed(0)}% less volatile than S&P 500`
                : `${(100 - portfolioBeta * 100).toFixed(0)}% less volatile — very defensive`}
            </p>
          </div>

          {/* Std Dev */}
          <div className="rounded-xl border border-border/60 bg-card p-5">
            <div className="flex items-center gap-2 mb-2">
              <Activity className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground uppercase tracking-wide">Std Deviation</span>
            </div>
            <p className="text-2xl font-bold text-foreground">
              {loading ? "—" : `${portfolioStdDev.toFixed(2)}%`}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Daily · Annualized: {annualizedStdDev.toFixed(1)}%</p>
          </div>

          {/* Sharpe Ratio */}
          <div className="rounded-xl border border-border/60 bg-card p-5">
            <div className="flex items-center gap-2 mb-2">
              <Target className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground uppercase tracking-wide">Sharpe Ratio</span>
            </div>
            <p className={`text-2xl font-bold ${sharpeRatio > 1 ? "text-green-400" : sharpeRatio > 0 ? "text-amber-400" : "text-red-400"}`}>
              {loading ? "—" : sharpeRatio.toFixed(2)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {sharpeRatio > 2 ? "Excellent risk-adjusted return" : sharpeRatio > 1 ? "Good risk-adjusted return" : sharpeRatio > 0 ? "Below optimal risk/return" : "Negative — underperforming risk-free"}
            </p>
          </div>
        </div>

        {/* ========== SECTION 2: PORTFOLIO STRUCTURE ========== */}
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
          <Layers className="h-4 w-4" /> Portfolio Structure & Diversification
        </h2>
        <div className="grid gap-4 md:grid-cols-3 mb-8">
          {/* Overall Risk */}
          <div className="rounded-xl border border-border/60 bg-card p-5">
            <div className="flex items-center gap-2 mb-2">
              <ShieldAlert className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground uppercase tracking-wide">Overall Risk Level</span>
            </div>
            <p className={`text-2xl font-bold ${riskColor(overallRisk)}`}>{loading ? "—" : overallRisk}</p>
            <p className="text-xs text-muted-foreground mt-1">Based on portfolio standard deviation</p>
          </div>

          {/* Concentration */}
          <div className="rounded-xl border border-border/60 bg-card p-5">
            <div className="flex items-center gap-2 mb-2">
              <PieChart className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground uppercase tracking-wide">Concentration (HHI)</span>
            </div>
            <p className={`text-2xl font-bold ${riskColor(concentrationRisk)}`}>
              {loading ? "—" : `${(normalizedHHI * 100).toFixed(0)}%`}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Max position: {maxWeight.toFixed(1)}% · {concentrationRisk} risk</p>
          </div>

          {/* Diversification Score */}
          <div className="rounded-xl border border-border/60 bg-card p-5">
            <div className="flex items-center gap-2 mb-2">
              <Shield className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground uppercase tracking-wide">Diversification Score</span>
            </div>
            <p className="text-2xl font-bold text-foreground">{loading ? "—" : `${diversificationScore}/100`}</p>
            <Progress value={diversificationScore} className="mt-2 h-1.5" />
            <p className="text-xs text-muted-foreground mt-1">{numHoldings} holding{numHoldings !== 1 ? "s" : ""} · {cashWeight.toFixed(1)}% cash</p>
          </div>
        </div>

        {/* Asset Class Breakdown */}
        {Object.keys(assetClassWeights).length > 0 && (
          <div className="rounded-xl border border-border/60 bg-card p-5 mb-8">
            <h3 className="text-sm font-semibold text-foreground mb-4">Asset Class Correlation Exposure</h3>
            <div className="flex gap-1 h-4 rounded-full overflow-hidden mb-4">
              {Object.entries(assetClassWeights)
                .sort((a, b) => b[1] - a[1])
                .map(([cls, weight]) => (
                  <div
                    key={cls}
                    className={`${classColors[cls] || "bg-gray-500"} transition-all`}
                    style={{ width: `${weight}%` }}
                    title={`${cls}: ${weight.toFixed(1)}%`}
                  />
                ))}
            </div>
            <div className="flex flex-wrap gap-3">
              {Object.entries(assetClassWeights)
                .sort((a, b) => b[1] - a[1])
                .map(([cls, weight]) => (
                  <div key={cls} className="flex items-center gap-2 text-xs text-muted-foreground">
                    <div className={`w-2.5 h-2.5 rounded-full ${classColors[cls] || "bg-gray-500"}`} />
                    <span>{cls}: {weight.toFixed(1)}%</span>
                  </div>
                ))}
            </div>
            {Object.keys(assetClassWeights).filter(k => k !== "Cash").length <= 1 && numHoldings > 0 && (
              <div className="mt-3 flex items-center gap-2 text-xs text-amber-500 bg-amber-500/10 px-3 py-2 rounded-lg">
                <AlertTriangle className="h-3.5 w-3.5" />
                <span>Low cross-asset diversification — consider adding different asset classes to reduce correlation risk</span>
              </div>
            )}
          </div>
        )}

        {/* ========== SECTION 3: STRESS TESTING ========== */}
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
          <Zap className="h-4 w-4" /> Stress Testing & Scenario Analysis
        </h2>
        <div className="grid gap-4 md:grid-cols-2 mb-8">
          {stressResults.map(scenario => (
            <div key={scenario.name} className="rounded-xl border border-border/60 bg-card p-5">
              <div className="flex items-center justify-between mb-2">
                <p className="font-semibold text-foreground text-sm">{scenario.name}</p>
                <span className={`text-xs font-semibold px-2 py-1 rounded-md ${
                  Math.abs(scenario.lossPercent) > 15 ? "bg-red-500/10 text-red-500" :
                  Math.abs(scenario.lossPercent) > 8 ? "bg-amber-500/10 text-amber-500" :
                  "bg-green-500/10 text-green-500"
                }`}>
                  {scenario.lossPercent.toFixed(1)}%
                </span>
              </div>
              <p className="text-xs text-muted-foreground mb-3">{scenario.description}</p>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Estimated portfolio impact</span>
                <span className="text-sm font-bold text-red-400">
                  {loading ? "—" : `-$${Math.abs(scenario.portfolioLoss).toFixed(2)}`}
                </span>
              </div>
              <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-red-500/60 rounded-full transition-all"
                  style={{ width: `${Math.min(Math.abs(scenario.lossPercent), 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>

        {/* ========== SECTION 4: PER-SECURITY BREAKDOWN ========== */}
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
          <TrendingUp className="h-4 w-4" /> Per-Security Risk Breakdown
        </h2>

        {stockRiskData.length === 0 ? (
          <div className="rounded-xl border border-border/60 bg-card p-8 text-center">
            <p className="text-muted-foreground text-sm">No holdings to analyze. Buy some securities first!</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mb-6">
            {stockRiskData.map((stock) => {
              const vol = getVolatility(stock.symbol, stock.dailyChangePct);
              const beta = getBeta(stock.symbol);
              const stockVolRisk = vol > 3.5 ? "High" : vol > 1.8 ? "Medium" : "Low";
              const gainLoss = (stock.currentPrice - stock.avgCost) * stock.quantity;
              const gainLossPct = stock.avgCost > 0 ? ((stock.currentPrice - stock.avgCost) / stock.avgCost) * 100 : 0;
              const positionVaR = (stock.quantity * stock.currentPrice) * vol / 100;

              return (
                <div
                  key={stock.symbol}
                  className="rounded-xl border border-border/60 bg-card p-5 hover:bg-muted/10 cursor-pointer transition-colors"
                  onClick={() => navigate(`/stock/${stock.symbol}`)}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <img
                        src={`https://assets.parqet.com/logos/symbol/${stock.symbol}`}
                        alt=""
                        className="w-8 h-8 rounded-full bg-muted/50"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                      />
                      <div>
                        <p className="font-semibold text-foreground">{stock.symbol}</p>
                        <p className="text-xs text-muted-foreground">{stock.name}</p>
                      </div>
                    </div>
                    <span className={`text-xs font-semibold px-2 py-1 rounded-md ${riskBg(stockVolRisk)} ${riskColor(stockVolRisk)}`}>
                      {stockVolRisk}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-3 text-sm mb-3">
                    <div>
                      <p className="text-xs text-muted-foreground">Beta</p>
                      <p className={`font-medium ${beta > 1.5 ? "text-red-400" : beta > 1 ? "text-amber-400" : "text-green-400"}`}>{beta.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Volatility</p>
                      <p className="font-medium text-foreground">{vol.toFixed(1)}%</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Daily Range</p>
                      <p className="font-medium text-foreground">±${positionVaR.toFixed(2)}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3 text-sm">
                    <div>
                      <p className="text-xs text-muted-foreground">Weight</p>
                      <p className="font-medium text-foreground">{stock.weight.toFixed(1)}%</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Value</p>
                      <p className="font-medium text-foreground">${(stock.quantity * stock.currentPrice).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">P&L</p>
                      <p className={`font-medium ${gainLoss >= 0 ? "text-green-500" : "text-red-500"}`}>
                        {gainLoss >= 0 ? "+" : ""}{gainLossPct.toFixed(2)}%
                      </p>
                    </div>
                  </div>

                  {stock.weight > 40 && (
                    <div className="mt-3 flex items-center gap-2 text-xs text-amber-500 bg-amber-500/10 px-3 py-2 rounded-lg">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      <span>High concentration — consider rebalancing</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Cash position */}
        <div className="rounded-xl border border-border/60 bg-card p-5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center text-lg font-bold text-primary">$</div>
            <div className="flex-1">
              <p className="font-medium text-foreground">Cash Reserve</p>
              <p className="text-xs text-muted-foreground">
                ${cashBalance.toLocaleString("en-US", { minimumFractionDigits: 2 })} · {cashWeight.toFixed(1)}% of portfolio — Acts as natural hedge & liquidity buffer
              </p>
            </div>
            <span className="text-xs font-semibold px-2 py-1 rounded-md bg-green-500/10 text-green-500">No Risk</span>
          </div>
        </div>
      </main>
    </div>
  );
};

export default PracticeRisk;
