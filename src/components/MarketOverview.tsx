import { useState, useEffect } from "react";
import { RefreshCw, TrendingUp, Bitcoin, DollarSign, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import MarketCard from "./MarketCard";
import { cn } from "@/lib/utils";

// Simulated real-time market data
const generateMarketData = () => [
  { symbol: "AAPL", name: "Apple Inc.", price: (178 + Math.random() * 5).toFixed(2), change: Math.random() * 4 - 2, changePercent: Math.random() * 2 - 1, volume: "52.3M" },
  { symbol: "GOOGL", name: "Alphabet Inc.", price: (141 + Math.random() * 3).toFixed(2), change: Math.random() * 3 - 1.5, changePercent: Math.random() * 1.5 - 0.75, volume: "28.1M" },
  { symbol: "MSFT", name: "Microsoft Corp.", price: (378 + Math.random() * 8).toFixed(2), change: Math.random() * 5 - 2.5, changePercent: Math.random() * 1.5 - 0.75, volume: "31.2M" },
  { symbol: "NVDA", name: "NVIDIA Corp.", price: (485 + Math.random() * 15).toFixed(2), change: Math.random() * 10 - 5, changePercent: Math.random() * 3 - 1.5, volume: "48.7M" },
  { symbol: "TSLA", name: "Tesla Inc.", price: (248 + Math.random() * 8).toFixed(2), change: Math.random() * 6 - 3, changePercent: Math.random() * 2 - 1, volume: "95.4M" },
  { symbol: "BTC", name: "Bitcoin", price: (43250 + Math.random() * 500).toFixed(2), change: Math.random() * 800 - 400, changePercent: Math.random() * 3 - 1.5, volume: "24.5B" },
];

const tabs = [
  { id: "stocks", label: "Stocks", icon: BarChart3 },
  { id: "crypto", label: "Crypto", icon: Bitcoin },
  { id: "forex", label: "Forex", icon: DollarSign },
  { id: "trending", label: "Trending", icon: TrendingUp },
];

const MarketOverview = () => {
  const [activeTab, setActiveTab] = useState("stocks");
  const [marketData, setMarketData] = useState(generateMarketData());
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Simulate real-time updates
  useEffect(() => {
    const interval = setInterval(() => {
      setMarketData(generateMarketData());
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const handleRefresh = () => {
    setIsRefreshing(true);
    setMarketData(generateMarketData());
    setTimeout(() => setIsRefreshing(false), 500);
  };

  return (
    <div className="glass-card p-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Market Overview</h2>
          <p className="text-sm text-muted-foreground">Real-time market data</p>
        </div>
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={handleRefresh}
          className="text-muted-foreground"
        >
          <RefreshCw className={cn("w-4 h-4", isRefreshing && "animate-spin")} />
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 p-1 bg-secondary/50 rounded-lg">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all",
              activeTab === tab.id
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <tab.icon className="w-4 h-4" />
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Market Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        {marketData.map((item, index) => (
          <div
            key={item.symbol}
            className="animate-fade-in"
            style={{ animationDelay: `${index * 50}ms` }}
          >
            <MarketCard {...item} />
          </div>
        ))}
      </div>

      {/* Live indicator */}
      <div className="flex items-center justify-center gap-2 mt-4 pt-4 border-t border-border/50">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-success"></span>
        </span>
        <span className="text-xs text-muted-foreground">Live • Updates every 5s</span>
      </div>
    </div>
  );
};

export default MarketOverview;
