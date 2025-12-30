import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { RefreshCw, AlertCircle } from "lucide-react";
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
  sparkline?: number[];
  type: "stock" | "crypto" | "etf";
}

// Removed tabs - now showing top 6 movers only

const MarketOverview = () => {
  const navigate = useNavigate();
  
  const [marketData, setMarketData] = useState<MarketData[]>([]);
  const [isLoading, setIsLoading] = useState(false); // Start false - show placeholder immediately
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const { toast } = useToast();

  const fetchMarketData = useCallback(async (showToast = false) => {
    try {
      setError(null);
      const { data, error: fetchError } = await supabase.functions.invoke("market-data", {
        body: { type: "all" },
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
    // Fetch data in background without blocking UI
    fetchMarketData();

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

  // Get top 6 daily movers sorted by absolute change percentage
  // Show placeholder data if no market data yet
  const displayData = marketData.length > 0
    ? [...marketData]
        .sort((a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent))
        .slice(0, 6)
    : [
        { symbol: "AAPL", name: "Apple Inc.", price: "—", change: 0, changePercent: 0.5, volume: "—", type: "stock" as const },
        { symbol: "MSFT", name: "Microsoft Corp.", price: "—", change: 0, changePercent: 0.3, volume: "—", type: "stock" as const },
        { symbol: "GOOGL", name: "Alphabet Inc.", price: "—", change: 0, changePercent: -0.2, volume: "—", type: "stock" as const },
        { symbol: "BTC", name: "Bitcoin", price: "—", change: 0, changePercent: 1.5, volume: "—", type: "crypto" as const },
        { symbol: "ETH", name: "Ethereum", price: "—", change: 0, changePercent: 1.2, volume: "—", type: "crypto" as const },
        { symbol: "NVDA", name: "NVIDIA Corp.", price: "—", change: 0, changePercent: 0.8, volume: "—", type: "stock" as const },
      ];

  return (
    <div className="glass-card p-5">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Top Daily Movers</h2>
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
          className="text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors duration-200"
        >
          <RefreshCw className={cn("w-4 h-4", (isRefreshing || isLoading) && "animate-spin")} />
        </Button>
      </div>

      {/* Error State */}
      {error && (
        <div className="flex items-center justify-between gap-2 p-4 mb-5 rounded-xl bg-destructive/5 border border-destructive/20 text-destructive">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            <span className="text-sm">{error}</span>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="text-destructive border-destructive/30 hover:bg-destructive/10"
          >
            Retry
          </Button>
        </div>
      )}

      {/* Loading State - only show when explicitly loading and no data */}
      {isLoading && marketData.length === 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="glass-card p-4">
              <div className="h-4 bg-muted rounded-lg w-16 mb-2 shimmer" />
              <div className="h-3 bg-muted rounded-lg w-24 mb-4 shimmer" />
              <div className="h-8 bg-muted rounded-lg w-full mb-2 shimmer" />
              <div className="h-6 bg-muted rounded-lg w-20 shimmer" />
            </div>
          ))}
        </div>
      )}

      {/* Market Cards Grid - always show */}
      {displayData.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 animate-stagger">
          {displayData.map((item) => (
            <div
              key={item.symbol}
              onClick={() => navigate(`/stock/${item.symbol}`)}
            >
              <MarketCard {...item} />
            </div>
          ))}
        </div>
      )}

      {/* Empty State - only if error and no fallback */}
      {!isLoading && error && marketData.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <p>Unable to load market data</p>
        </div>
      )}

      {/* Live indicator */}
      <div className="flex items-center justify-center gap-2 mt-5 pt-5 border-t border-border/30">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-success"></span>
        </span>
        <span className="text-xs text-muted-foreground">Live • Updates every 60s</span>
      </div>
    </div>
  );
};

export default MarketOverview;