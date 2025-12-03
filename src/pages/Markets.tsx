import { useState, useEffect, useCallback } from "react";
import { RefreshCw, TrendingUp, TrendingDown, Search, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import SparklineChart from "@/components/SparklineChart";
import Header from "@/components/Header";
import { useToast } from "@/hooks/use-toast";

interface MarketData {
  symbol: string;
  name: string;
  price: string;
  change: number;
  changePercent: number;
  volume: string;
  sparkline?: number[];
  type: "stock" | "crypto" | "etf" | "mutual_fund";
}

interface AssetInfo {
  symbol: string;
  name: string;
  type: string;
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
  const [availableAssets, setAvailableAssets] = useState<AssetInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<MarketData[]>([]);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const { toast } = useToast();

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
      
      if (data?.availableAssets) {
        setAvailableAssets(data.availableAssets);
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
    toast({
      title: "Data refreshed",
      description: "Market data has been updated",
    });
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const { data, error } = await supabase.functions.invoke("market-data", {
        body: { search: searchQuery.trim() },
      });

      if (error) throw error;

      if (data?.data && Array.isArray(data.data)) {
        setSearchResults(data.data);
        if (data.data.length === 0) {
          toast({
            title: "No results",
            description: `No assets found matching "${searchQuery}"`,
          });
        }
      }
    } catch (err) {
      console.error("Search error:", err);
      toast({
        title: "Search error",
        description: "Unable to search. API rate limit may have been reached.",
        variant: "destructive",
      });
    } finally {
      setIsSearching(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  const clearSearch = () => {
    setSearchQuery("");
    setSearchResults([]);
  };

  // Filter data based on tab and search
  const displayData = searchResults.length > 0 
    ? searchResults 
    : marketData.filter((item) => {
        if (activeTab === "all") return true;
        if (activeTab === "stocks") return item.type === "stock";
        if (activeTab === "crypto") return item.type === "crypto";
        if (activeTab === "etf") return item.type === "etf";
        return true;
      });

  // Filter available assets for suggestions
  const filteredAssets = availableAssets.filter((asset) => {
    if (!searchQuery) return false;
    const query = searchQuery.toLowerCase();
    return (
      asset.symbol.toLowerCase().includes(query) ||
      asset.name.toLowerCase().includes(query)
    );
  }).slice(0, 8);

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
        <div className="flex flex-col gap-4 mb-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search stocks, ETFs, crypto by symbol or name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                className="pl-10 pr-20"
              />
              {searchQuery && (
                <button
                  onClick={clearSearch}
                  className="absolute right-12 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
              <Button
                size="sm"
                onClick={handleSearch}
                disabled={isSearching || !searchQuery.trim()}
                className="absolute right-1 top-1/2 -translate-y-1/2"
              >
                {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : "Search"}
              </Button>
              
              {/* Search suggestions dropdown */}
              {searchQuery && filteredAssets.length > 0 && searchResults.length === 0 && (
                <div className="absolute z-10 w-full mt-1 bg-background border border-border rounded-lg shadow-lg max-h-64 overflow-y-auto">
                  <p className="px-3 py-2 text-xs text-muted-foreground border-b border-border">
                    Available to search:
                  </p>
                  {filteredAssets.map((asset) => (
                    <button
                      key={asset.symbol}
                      onClick={() => {
                        setSearchQuery(asset.symbol);
                        handleSearch();
                      }}
                      className="w-full px-3 py-2 text-left hover:bg-muted/50 flex items-center justify-between"
                    >
                      <span className="font-medium text-foreground">{asset.symbol}</span>
                      <span className="text-sm text-muted-foreground">{asset.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="flex gap-1 p-1 bg-secondary/50 rounded-lg">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveTab(tab.id);
                    clearSearch();
                  }}
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
          
          {searchResults.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                Showing search results for "{searchQuery}"
              </span>
              <Button variant="ghost" size="sm" onClick={clearSearch}>
                Clear
              </Button>
            </div>
          )}
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
                  <th className="text-right p-4 text-sm font-medium text-muted-foreground hidden md:table-cell">Type</th>
                  <th className="text-right p-4 text-sm font-medium text-muted-foreground hidden lg:table-cell w-32">Chart</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  [...Array(10)].map((_, i) => (
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
                      <td className="p-4 text-right hidden md:table-cell">
                        <div className="h-5 bg-muted rounded w-12 ml-auto" />
                      </td>
                      <td className="p-4 text-right hidden lg:table-cell">
                        <div className="h-10 bg-muted rounded w-24 ml-auto" />
                      </td>
                    </tr>
                  ))
                ) : displayData.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-muted-foreground">
                      {searchQuery ? "No results found. Try a different search term." : "No data available"}
                    </td>
                  </tr>
                ) : (
                  displayData.map((item) => {
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
                              item.type === "mutual_fund" ? "bg-warning/20 text-warning" :
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
                        <td className="p-4 text-right hidden md:table-cell">
                          <span className={cn(
                            "text-xs px-2 py-1 rounded-full",
                            item.type === "crypto" ? "bg-primary/10 text-primary" :
                            item.type === "etf" ? "bg-accent/10 text-accent-foreground" :
                            item.type === "mutual_fund" ? "bg-warning/10 text-warning" :
                            "bg-secondary text-muted-foreground"
                          )}>
                            {item.type === "mutual_fund" ? "Mutual Fund" : item.type.toUpperCase()}
                          </span>
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

        {/* Info Section */}
        <div className="mt-6 p-4 glass-card">
          <h3 className="font-semibold text-foreground mb-2">About Market Data</h3>
          <p className="text-sm text-muted-foreground">
            Stock and ETF data is provided by Alpha Vantage. Cryptocurrency data is provided by CoinGecko.
            Use the search bar to find specific stocks, ETFs, or mutual funds by symbol or name.
            Data refreshes automatically every 30 seconds.
          </p>
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
