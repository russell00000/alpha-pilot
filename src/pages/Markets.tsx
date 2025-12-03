import { useState, useEffect, useCallback } from "react";
import { RefreshCw, TrendingUp, TrendingDown, Search, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import SparklineChart from "@/components/SparklineChart";
import Header from "@/components/Header";

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

const tabs = [
  { id: "all", label: "All" },
  { id: "stocks", label: "Stocks" },
  { id: "crypto", label: "Crypto" },
  { id: "etf", label: "ETFs" },
];

const Markets = () => {
  const [activeTab, setActiveTab] = useState("all");
  const [marketData, setMarketData] = useState<MarketData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchMarketData = useCallback(async () => {
    try {
      const { data, error } = await supabase.functions.invoke("market-data", {
        body: { type: "all" },
      });

      if (error) throw error;

      if (data?.data && Array.isArray(data.data)) {
        setMarketData(data.data);
        setLastUpdated(new Date());
      }
    } catch (err) {
      console.error("Error fetching market data:", err);
    }
  }, []);

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      await fetchMarketData();
      setIsLoading(false);
    };
    loadData();

    const interval = setInterval(fetchMarketData, 30000);
    return () => clearInterval(interval);
  }, [fetchMarketData]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchMarketData();
    setIsRefreshing(false);
  };

  // Filter data
  const filteredData = marketData.filter((item) => {
    const matchesTab = activeTab === "all" || 
      (activeTab === "stocks" && item.type === "stock") ||
      (activeTab === "crypto" && item.type === "crypto") ||
      (activeTab === "etf" && item.type === "etf");
    
    const matchesSearch = !searchQuery || 
      item.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.name.toLowerCase().includes(searchQuery.toLowerCase());
    
    return matchesTab && matchesSearch;
  });

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container mx-auto px-4 py-8">
        {/* Page Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Markets</h1>
            <p className="text-muted-foreground">
              Real-time prices for stocks, crypto, and ETFs
              {lastUpdated && ` • Updated ${lastUpdated.toLocaleTimeString()}`}
            </p>
          </div>
          <Button 
            variant="outline" 
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="gap-2"
          >
            <RefreshCw className={cn("w-4 h-4", isRefreshing && "animate-spin")} />
            Refresh
          </Button>
        </div>

        {/* Search and Filters */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by symbol or name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex gap-1 p-1 bg-secondary/50 rounded-lg">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "px-4 py-2 rounded-md text-sm font-medium transition-all",
                  activeTab === tab.id
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Market Table */}
        <div className="glass-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border/50">
                  <th className="text-left p-4 text-sm font-medium text-muted-foreground">Asset</th>
                  <th className="text-right p-4 text-sm font-medium text-muted-foreground">Price</th>
                  <th className="text-right p-4 text-sm font-medium text-muted-foreground">24h Change</th>
                  <th className="text-right p-4 text-sm font-medium text-muted-foreground hidden md:table-cell">Volume</th>
                  <th className="text-right p-4 text-sm font-medium text-muted-foreground hidden lg:table-cell w-32">Chart</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  [...Array(8)].map((_, i) => (
                    <tr key={i} className="border-b border-border/50 animate-pulse">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-muted" />
                          <div>
                            <div className="h-4 bg-muted rounded w-16 mb-1" />
                            <div className="h-3 bg-muted rounded w-24" />
                          </div>
                        </div>
                      </td>
                      <td className="p-4 text-right">
                        <div className="h-5 bg-muted rounded w-20 ml-auto" />
                      </td>
                      <td className="p-4 text-right">
                        <div className="h-5 bg-muted rounded w-16 ml-auto" />
                      </td>
                      <td className="p-4 text-right hidden md:table-cell">
                        <div className="h-5 bg-muted rounded w-16 ml-auto" />
                      </td>
                      <td className="p-4 text-right hidden lg:table-cell">
                        <div className="h-10 bg-muted rounded w-24 ml-auto" />
                      </td>
                    </tr>
                  ))
                ) : filteredData.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-muted-foreground">
                      No results found
                    </td>
                  </tr>
                ) : (
                  filteredData.map((item) => {
                    const isPositive = item.change >= 0;
                    return (
                      <tr 
                        key={item.symbol} 
                        className="border-b border-border/50 hover:bg-muted/20 transition-colors cursor-pointer"
                      >
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <div className={cn(
                              "w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm",
                              item.type === "crypto" ? "bg-primary/20 text-primary" :
                              item.type === "etf" ? "bg-accent/20 text-accent-foreground" :
                              "bg-secondary text-foreground"
                            )}>
                              {item.symbol.slice(0, 2)}
                            </div>
                            <div>
                              <p className="font-semibold text-foreground">{item.symbol}</p>
                              <p className="text-sm text-muted-foreground">{item.name}</p>
                            </div>
                          </div>
                        </td>
                        <td className="p-4 text-right">
                          <p className="font-semibold text-foreground">${item.price}</p>
                        </td>
                        <td className="p-4 text-right">
                          <div className={cn(
                            "inline-flex items-center gap-1 px-2 py-1 rounded-md text-sm font-medium",
                            isPositive ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"
                          )}>
                            {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                            {isPositive ? "+" : ""}{item.changePercent.toFixed(2)}%
                          </div>
                        </td>
                        <td className="p-4 text-right hidden md:table-cell">
                          <p className="text-muted-foreground">{item.volume}</p>
                        </td>
                        <td className="p-4 text-right hidden lg:table-cell w-32">
                          {item.sparkline && item.sparkline.length > 0 && (
                            <div className="w-24 h-10 ml-auto">
                              <SparklineChart data={item.sparkline} positive={isPositive} />
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Live indicator */}
        <div className="flex items-center justify-center gap-2 mt-6">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-success"></span>
          </span>
          <span className="text-sm text-muted-foreground">Live data • Auto-updates every 30s</span>
        </div>
      </main>
    </div>
  );
};

export default Markets;
