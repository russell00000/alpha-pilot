import { useState, useEffect, useCallback } from "react";
import { RefreshCw, TrendingUp, Bitcoin, DollarSign, BarChart3, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import MarketCard from "./MarketCard";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface MarketData {
  symbol: string;
  name: string;
  price: string;
  change: number;
  changePercent: number;
  volume: string;
}

const tabs = [
  { id: "stocks", label: "Stocks", icon: BarChart3 },
  { id: "crypto", label: "Crypto", icon: Bitcoin },
  { id: "forex", label: "Forex", icon: DollarSign },
  { id: "trending", label: "Trending", icon: TrendingUp },
];

const MarketOverview = () => {
  const [activeTab, setActiveTab] = useState("stocks");
  const [marketData, setMarketData] = useState<MarketData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const { toast } = useToast();

  const fetchMarketData = useCallback(async (showToast = false) => {
    try {
      setError(null);
      const { data, error: fetchError } = await supabase.functions.invoke("market-data", {
        body: { symbols: ["AAPL", "GOOGL", "MSFT", "NVDA", "TSLA"] },
      });

      if (fetchError) {
        throw new Error(fetchError.message);
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      if (data?.data && Array.isArray(data.data)) {
        setMarketData(data.data);
        setLastUpdated(new Date());
        if (showToast) {
          toast({
            title: "Data refreshed",
            description: "Market data has been updated",
          });
        }
      }
    } catch (err) {
      console.error("Error fetching market data:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch market data");
      if (showToast) {
        toast({
          title: "Error",
          description: "Failed to refresh market data",
          variant: "destructive",
        });
      }
    }
  }, [toast]);

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      await fetchMarketData();
      setIsLoading(false);
    };
    loadData();

    // Refresh every 60 seconds (Alpha Vantage free tier is limited)
    const interval = setInterval(() => {
      fetchMarketData();
    }, 60000);

    return () => clearInterval(interval);
  }, [fetchMarketData]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchMarketData(true);
    setIsRefreshing(false);
  };

  // Filter data based on active tab
  const filteredData = marketData.filter((item) => {
    if (activeTab === "crypto") return item.symbol === "BTC";
    if (activeTab === "stocks") return item.symbol !== "BTC";
    return true; // trending shows all
  });

  return (
    <div className="glass-card p-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Market Overview</h2>
          <p className="text-sm text-muted-foreground">
            {lastUpdated 
              ? `Updated ${lastUpdated.toLocaleTimeString()}`
              : "Real-time market data"
            }
          </p>
        </div>
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={handleRefresh}
          disabled={isRefreshing || isLoading}
          className="text-muted-foreground"
        >
          <RefreshCw className={cn("w-4 h-4", (isRefreshing || isLoading) && "animate-spin")} />
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

      {/* Error State */}
      {error && (
        <div className="flex items-center justify-between gap-2 p-3 mb-4 rounded-lg bg-destructive/10 text-destructive">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            <span className="text-sm">{error}</span>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="text-destructive border-destructive/50 hover:bg-destructive/10"
          >
            Retry
          </Button>
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="glass-card p-4 animate-pulse">
              <div className="h-4 bg-muted rounded w-16 mb-2" />
              <div className="h-3 bg-muted rounded w-24 mb-4" />
              <div className="h-8 bg-muted rounded w-20" />
            </div>
          ))}
        </div>
      )}

      {/* Market Cards Grid */}
      {!isLoading && filteredData.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredData.map((item, index) => (
            <div
              key={item.symbol}
              className="animate-fade-in"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <MarketCard {...item} />
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !error && filteredData.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          <p>No data available for this category</p>
        </div>
      )}

      {/* Live indicator */}
      <div className="flex items-center justify-center gap-2 mt-4 pt-4 border-t border-border/50">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-success"></span>
        </span>
        <span className="text-xs text-muted-foreground">Live • Alpha Vantage + CoinGecko</span>
      </div>
    </div>
  );
};

export default MarketOverview;
