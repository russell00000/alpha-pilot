import { useState } from "react";
import { Wallet, TrendingUp, TrendingDown, PieChart, Plus, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import Header from "@/components/Header";
import SparklineChart from "@/components/SparklineChart";
import { useToast } from "@/hooks/use-toast";

interface Holding {
  symbol: string;
  name: string;
  shares: number;
  avgCost: number;
  currentPrice: number;
  sparkline: number[];
}

// Demo portfolio data
const demoHoldings: Holding[] = [
  { symbol: "AAPL", name: "Apple Inc.", shares: 15, avgCost: 175.50, currentPrice: 286.19, sparkline: [170, 175, 180, 185, 190, 200, 220, 250, 270, 286] },
  { symbol: "GOOGL", name: "Alphabet Inc.", shares: 8, avgCost: 135.20, currentPrice: 176.49, sparkline: [130, 135, 140, 145, 150, 155, 160, 165, 170, 176] },
  { symbol: "MSFT", name: "Microsoft Corp.", shares: 10, avgCost: 350.00, currentPrice: 432.61, sparkline: [340, 350, 360, 370, 380, 390, 400, 410, 420, 432] },
  { symbol: "BTC", name: "Bitcoin", shares: 0.5, avgCost: 45000, currentPrice: 92550, sparkline: [42000, 45000, 50000, 55000, 60000, 70000, 80000, 85000, 90000, 92550] },
  { symbol: "ETH", name: "Ethereum", shares: 3, avgCost: 2200, currentPrice: 3099.96, sparkline: [2000, 2100, 2200, 2400, 2500, 2700, 2800, 2900, 3000, 3100] },
];

const Portfolio = () => {
  const [holdings] = useState<Holding[]>(demoHoldings);
  const { toast } = useToast();

  const totalValue = holdings.reduce((sum, h) => sum + h.shares * h.currentPrice, 0);
  const totalCost = holdings.reduce((sum, h) => sum + h.shares * h.avgCost, 0);
  const totalGain = totalValue - totalCost;
  const totalGainPercent = ((totalGain / totalCost) * 100);

  const handleAddPosition = () => {
    toast({
      title: "Coming Soon",
      description: "Portfolio tracking with real positions will be available soon!",
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container mx-auto px-4 py-8">
        {/* Page Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Portfolio</h1>
            <p className="text-muted-foreground">Track your investments and performance</p>
          </div>
          <Button onClick={handleAddPosition} className="gap-2">
            <Plus className="w-4 h-4" />
            Add Position
          </Button>
        </div>

        {/* Portfolio Summary */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="glass-card p-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-lg bg-primary/10">
                <Wallet className="w-5 h-5 text-primary" />
              </div>
              <span className="text-sm text-muted-foreground">Total Value</span>
            </div>
            <p className="text-3xl font-bold text-foreground">${totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
          </div>
          
          <div className="glass-card p-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-lg bg-success/10">
                <TrendingUp className="w-5 h-5 text-success" />
              </div>
              <span className="text-sm text-muted-foreground">Total Gain/Loss</span>
            </div>
            <p className={cn("text-3xl font-bold", totalGain >= 0 ? "text-success" : "text-destructive")}>
              {totalGain >= 0 ? "+" : ""}${totalGain.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <p className={cn("text-sm", totalGain >= 0 ? "text-success" : "text-destructive")}>
              {totalGainPercent >= 0 ? "+" : ""}{totalGainPercent.toFixed(2)}%
            </p>
          </div>
          
          <div className="glass-card p-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-lg bg-accent/10">
                <PieChart className="w-5 h-5 text-accent-foreground" />
              </div>
              <span className="text-sm text-muted-foreground">Positions</span>
            </div>
            <p className="text-3xl font-bold text-foreground">{holdings.length}</p>
          </div>
          
          <div className="glass-card p-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-lg bg-warning/10">
                <TrendingDown className="w-5 h-5 text-warning" />
              </div>
              <span className="text-sm text-muted-foreground">Cost Basis</span>
            </div>
            <p className="text-3xl font-bold text-foreground">${totalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
          </div>
        </div>

        {/* Holdings Table */}
        <div className="glass-card overflow-hidden">
          <div className="p-4 border-b border-border/50">
            <h2 className="text-lg font-semibold text-foreground">Holdings</h2>
            <p className="text-sm text-muted-foreground">Demo portfolio - Sign in to track your real positions</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border/50">
                  <th className="text-left p-4 text-sm font-medium text-muted-foreground">Asset</th>
                  <th className="text-right p-4 text-sm font-medium text-muted-foreground">Shares</th>
                  <th className="text-right p-4 text-sm font-medium text-muted-foreground">Avg Cost</th>
                  <th className="text-right p-4 text-sm font-medium text-muted-foreground">Current Price</th>
                  <th className="text-right p-4 text-sm font-medium text-muted-foreground">Value</th>
                  <th className="text-right p-4 text-sm font-medium text-muted-foreground">Gain/Loss</th>
                  <th className="text-right p-4 text-sm font-medium text-muted-foreground hidden lg:table-cell w-28">Chart</th>
                </tr>
              </thead>
              <tbody>
                {holdings.map((holding) => {
                  const value = holding.shares * holding.currentPrice;
                  const cost = holding.shares * holding.avgCost;
                  const gain = value - cost;
                  const gainPercent = ((gain / cost) * 100);
                  const isPositive = gain >= 0;

                  return (
                    <tr key={holding.symbol} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center font-bold text-sm text-primary">
                            {holding.symbol.slice(0, 2)}
                          </div>
                          <div>
                            <p className="font-semibold text-foreground">{holding.symbol}</p>
                            <p className="text-sm text-muted-foreground">{holding.name}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-4 text-right font-medium text-foreground">{holding.shares}</td>
                      <td className="p-4 text-right text-muted-foreground">${holding.avgCost.toLocaleString()}</td>
                      <td className="p-4 text-right font-medium text-foreground">${holding.currentPrice.toLocaleString()}</td>
                      <td className="p-4 text-right font-semibold text-foreground">${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      <td className="p-4 text-right">
                        <div className={cn(
                          "inline-flex items-center gap-1 px-2 py-1 rounded-md text-sm font-medium",
                          isPositive ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"
                        )}>
                          {isPositive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                          {isPositive ? "+" : ""}{gainPercent.toFixed(2)}%
                        </div>
                      </td>
                      <td className="p-4 text-right hidden lg:table-cell w-28">
                        <div className="w-24 h-10 ml-auto">
                          <SparklineChart data={holding.sparkline} positive={isPositive} />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Disclaimer */}
        <p className="text-center text-sm text-muted-foreground mt-6">
          This is a demo portfolio with simulated data. Sign up to track your real investments.
        </p>
      </main>
    </div>
  );
};

export default Portfolio;
