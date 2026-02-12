import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { usePracticeTrading } from "@/hooks/usePracticeTrading";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, ShieldAlert, TrendingUp, BarChart3, PieChart, AlertTriangle } from "lucide-react";

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
  const concentrationRisk = maxWeight > 50 ? "High" : maxWeight > 30 ? "Medium" : "Low";
  const numHoldings = holdings.length;
  const diversificationScore = numHoldings === 0 ? 0 : Math.min(100, numHoldings * 15 + (cashWeight > 5 ? 10 : 0));

  const avgVolatility = stockRiskData.length > 0
    ? stockRiskData.reduce((sum, s) => sum + Math.abs(s.dailyChangePct), 0) / stockRiskData.length
    : 0;

  const overallRisk = avgVolatility > 3 ? "High" : avgVolatility > 1.5 ? "Medium" : "Low";
  const riskColor = (level: string) =>
    level === "High" ? "text-red-500" : level === "Medium" ? "text-amber-500" : "text-green-500";
  const riskBg = (level: string) =>
    level === "High" ? "bg-red-500/10" : level === "Medium" ? "bg-amber-500/10" : "bg-green-500/10";

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
            Portfolio risk metrics and per-security volatility breakdown
          </p>
        </div>

        {/* Portfolio-level metrics */}
        <div className="grid gap-4 md:grid-cols-4 mb-8">
          <div className="rounded-xl border border-border/60 bg-card p-5">
            <div className="flex items-center gap-2 mb-2">
              <ShieldAlert className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground uppercase tracking-wide">Overall Risk</span>
            </div>
            <p className={`text-2xl font-bold ${riskColor(overallRisk)}`}>{loading ? "—" : overallRisk}</p>
            <p className="text-xs text-muted-foreground mt-1">Based on avg daily volatility</p>
          </div>

          <div className="rounded-xl border border-border/60 bg-card p-5">
            <div className="flex items-center gap-2 mb-2">
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground uppercase tracking-wide">Concentration</span>
            </div>
            <p className={`text-2xl font-bold ${riskColor(concentrationRisk)}`}>{loading ? "—" : concentrationRisk}</p>
            <p className="text-xs text-muted-foreground mt-1">Max position: {maxWeight.toFixed(1)}%</p>
          </div>

          <div className="rounded-xl border border-border/60 bg-card p-5">
            <div className="flex items-center gap-2 mb-2">
              <PieChart className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground uppercase tracking-wide">Diversification</span>
            </div>
            <p className="text-2xl font-bold text-foreground">{loading ? "—" : `${diversificationScore}/100`}</p>
            <p className="text-xs text-muted-foreground mt-1">{numHoldings} holding{numHoldings !== 1 ? "s" : ""} + {cashWeight.toFixed(1)}% cash</p>
          </div>

          <div className="rounded-xl border border-border/60 bg-card p-5">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground uppercase tracking-wide">Avg Volatility</span>
            </div>
            <p className="text-2xl font-bold text-foreground">{loading ? "—" : `${avgVolatility.toFixed(2)}%`}</p>
            <p className="text-xs text-muted-foreground mt-1">Daily price movement</p>
          </div>
        </div>

        {/* Per-stock risk cards */}
        <h2 className="text-lg font-semibold text-foreground mb-4">Per-Security Risk Breakdown</h2>

        {stockRiskData.length === 0 ? (
          <div className="rounded-xl border border-border/60 bg-card p-8 text-center">
            <p className="text-muted-foreground text-sm">No holdings to analyze. Buy some securities first!</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {stockRiskData.map((stock) => {
              const stockVolRisk = Math.abs(stock.dailyChangePct) > 3 ? "High" : Math.abs(stock.dailyChangePct) > 1.5 ? "Medium" : "Low";
              const gainLoss = (stock.currentPrice - stock.avgCost) * stock.quantity;
              const gainLossPct = stock.avgCost > 0 ? ((stock.currentPrice - stock.avgCost) / stock.avgCost) * 100 : 0;

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
                      {stockVolRisk} Risk
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-xs text-muted-foreground">Weight</p>
                      <p className="font-medium text-foreground">{stock.weight.toFixed(1)}%</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Daily Move</p>
                      <p className={`font-medium ${stock.dailyChangePct >= 0 ? "text-green-500" : "text-red-500"}`}>
                        {stock.dailyChangePct >= 0 ? "+" : ""}{stock.dailyChangePct.toFixed(2)}%
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Position Value</p>
                      <p className="font-medium text-foreground">${(stock.quantity * stock.currentPrice).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Gain/Loss</p>
                      <p className={`font-medium ${gainLoss >= 0 ? "text-green-500" : "text-red-500"}`}>
                        {gainLoss >= 0 ? "+" : ""}${Math.abs(gainLoss).toFixed(2)} ({gainLossPct >= 0 ? "+" : ""}{gainLossPct.toFixed(2)}%)
                      </p>
                    </div>
                  </div>

                  {stock.weight > 40 && (
                    <div className="mt-3 flex items-center gap-2 text-xs text-amber-500 bg-amber-500/10 px-3 py-2 rounded-lg">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      <span>High concentration — consider diversifying</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Cash position note */}
        <div className="mt-6 rounded-xl border border-border/60 bg-card p-5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center text-lg font-bold text-primary">$</div>
            <div className="flex-1">
              <p className="font-medium text-foreground">Cash Reserve</p>
              <p className="text-xs text-muted-foreground">
                ${cashBalance.toLocaleString("en-US", { minimumFractionDigits: 2 })} · {cashWeight.toFixed(1)}% of portfolio
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
