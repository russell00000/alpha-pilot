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

const MarketOverview = () => {
  const navigate = useNavigate();
  const [marketData, setMarketData] = useState<MarketData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
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

      if (fetchError) throw new Error(fetchError.message);
      if (data?.error) throw new Error(data.error);

      if (data?.data && Array.isArray(data.data)) {
        setMarketData(data.data);
        setLastUpdated(new Date());
        if (showToast) {
          toast({ title: "Data refreshed", description: "Market data has been updated" });
        }
      }
    } catch (err) {
      console.error("Error fetching market data:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch market data");
      if (showToast) {
        toast({ title: "Error", description: "Failed to refresh market data", variant: "destructive" });
      }
    }
  }, [toast]);

  useEffect(() => {
    fetchMarketData();
    const interval = setInterval(() => fetchMarketData(), 60000);
    return () => clearInterval(interval);
  }, [fetchMarketData]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchMarketData(true);
    setIsRefreshing(false);
  };

  const displayData = marketData.length > 0
    ? [...marketData].sort((a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent)).slice(0, 6)
    : [
        { symbol: "AAPL", name: "Apple Inc.", price: "—", change: 0, changePercent: 0.5, volume: "—", type: "stock" as const },
        { symbol: "MSFT", name: "Microsoft Corp.", price: "—", change: 0, changePercent: 0.3, volume: "—", type: "stock" as const },
        { symbol: "GOOGL", name: "Alphabet Inc.", price: "—", change: 0, changePercent: -0.2, volume: "—", type: "stock" as const },
        { symbol: "BTC", name: "Bitcoin", price: "—", change: 0, changePercent: 1.5, volume: "—", type: "crypto" as const },
        { symbol: "ETH", name: "Ethereum", price: "—", change: 0, changePercent: 1.2, volume: "—", type: "crypto" as const },
        { symbol: "NVDA", name: "NVIDIA Corp.", price: "—", change: 0, changePercent: 0.8, volume: "—", type: "stock" as const },
      ];

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-2xl font-semibold text-foreground tracking-tight">Top Movers</h2>
          <p className="text-[10px] text-muted-foreground uppercase tracking-[0.2em] font-medium mt-1.5">
            {lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString()}` : "Institutional data stream"}
          </p>
        </div>
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={handleRefresh}
          disabled={isRefreshing || isLoading}
          className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-secondary/40"
        >
          <RefreshCw className={cn("w-3.5 h-3.5", (isRefreshing || isLoading) && "animate-spin")} />
        </Button>
      </div>

      {error && (
        <div className="flex items-center justify-between gap-2 p-3 mb-4 rounded-xl bg-destructive/5 border border-destructive/15 text-destructive">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            <span className="text-xs">{error}</span>
          </div>
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isRefreshing} className="text-destructive border-destructive/20 hover:bg-destructive/10 text-xs h-7">
            Retry
          </Button>
        </div>
      )}

      {isLoading && marketData.length === 0 && (
        <div className="grid grid-cols-2 gap-3 flex-1">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="p-4 rounded-xl bg-secondary/20">
              <div className="h-4 bg-muted rounded w-16 mb-2 shimmer" />
              <div className="h-3 bg-muted rounded w-24 mb-4 shimmer" />
              <div className="h-6 bg-muted rounded w-20 shimmer" />
            </div>
          ))}
        </div>
      )}

      {displayData.length > 0 && (
        <div className="grid grid-cols-2 gap-3 flex-1 animate-stagger">
          {displayData.map((item) => (
            <div key={item.symbol} onClick={() => navigate(`/stock/${item.symbol}`)} className="cursor-pointer">
              <MarketCard {...item} />
            </div>
          ))}
        </div>
      )}

      {!isLoading && error && marketData.length === 0 && (
        <div className="text-center py-12 text-muted-foreground text-sm">Unable to load market data</div>
      )}

      <div className="flex items-center gap-2 mt-5 px-3 py-1.5 bg-white/[0.03] border border-white/[0.06] rounded-full w-fit">
        <span className="relative flex h-1.5 w-1.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-success"></span>
        </span>
        <span className="text-[10px] uppercase tracking-[0.2em] font-medium text-muted-foreground">Live · 60s Refresh</span>
      </div>
    </div>
  );
};

export default MarketOverview;
