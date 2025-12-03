import { useState, useEffect, useCallback } from "react";
import { RefreshCw, TrendingUp, TrendingDown, Search, X, Loader2, Globe, BarChart3 } from "lucide-react";
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
  { id: "mutual_fund", label: "Mutual Funds" },
];

const popularSearches = [
  { symbol: "AAPL", name: "Apple" },
  { symbol: "TSLA", name: "Tesla" },
  { symbol: "GOOGL", name: "Google" },
  { symbol: "AMZN", name: "Amazon" },
  { symbol: "NVDA", name: "NVIDIA" },
  { symbol: "META", name: "Meta" },
  { symbol: "NFLX", name: "Netflix" },
  { symbol: "MSFT", name: "Microsoft" },
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
  const [showSuggestions, setShowSuggestions] = useState(false);
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

  const handleSearch = async (query?: string) => {
    const searchTerm = query || searchQuery;
    if (!searchTerm.trim()) {
      setSearchResults([]);
      return;
    }

    setShowSuggestions(false);
    setIsSearching(true);
    try {
      const { data, error } = await supabase.functions.invoke("market-data", {
        body: { search: searchTerm.trim().toUpperCase() },
      });

      if (error) throw error;

      if (data?.data && Array.isArray(data.data)) {
        setSearchResults(data.data);
        if (data.data.length === 0) {
          toast({
            title: "No results",
            description: `No assets found matching "${searchTerm}". Try a different symbol.`,
          });
        }
      }
    } catch (err) {
      console.error("Search error:", err);
      toast({
        title: "Search error",
        description: "Unable to search. Please try again in a moment.",
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
    setShowSuggestions(false);
  };

  const handleQuickSearch = (symbol: string) => {
    setSearchQuery(symbol);
    handleSearch(symbol);
  };

  // Filter data based on tab and search
  const displayData = searchResults.length > 0 
    ? searchResults 
    : marketData.filter((item) => {
        if (activeTab === "all") return true;
        if (activeTab === "stocks") return item.type === "stock";
        if (activeTab === "crypto") return item.type === "crypto";
        if (activeTab === "etf") return item.type === "etf";
        if (activeTab === "mutual_fund") return item.type === "mutual_fund";
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
  }).slice(0, 10);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container mx-auto px-4 py-8">
        {/* Hero Search Section */}
        <div className="glass-card p-8 mb-8 text-center">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Globe className="w-8 h-8 text-primary" />
            <h1 className="text-3xl md:text-4xl font-bold text-foreground">
              Search the Entire Market
            </h1>
          </div>
          <p className="text-muted-foreground mb-6 max-w-2xl mx-auto">
            Access real-time data for thousands of stocks, ETFs, mutual funds, and cryptocurrencies. 
            Search by ticker symbol or company name.
          </p>
          
          {/* Main Search Bar */}
          <div className="relative max-w-2xl mx-auto mb-6">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              placeholder="Search any stock, ETF, or crypto (e.g., AAPL, TSLA, BTC)..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setShowSuggestions(true);
              }}
              onKeyDown={handleKeyDown}
              onFocus={() => setShowSuggestions(true)}
              className="pl-12 pr-32 h-14 text-lg"
            />
            {searchQuery && (
              <button
                onClick={clearSearch}
                className="absolute right-28 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="w-5 h-5" />
              </button>
            )}
            <Button
              onClick={() => handleSearch()}
              disabled={isSearching || !searchQuery.trim()}
              className="absolute right-2 top-1/2 -translate-y-1/2 h-10"
            >
              {isSearching ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Search
            </Button>
            
            {/* Search suggestions dropdown */}
            {showSuggestions && searchQuery && filteredAssets.length > 0 && searchResults.length === 0 && (
              <div className="absolute z-10 w-full mt-1 bg-background border border-border rounded-lg shadow-lg max-h-64 overflow-y-auto text-left">
                <p className="px-4 py-2 text-xs text-muted-foreground border-b border-border">
                  Quick suggestions:
                </p>
                {filteredAssets.map((asset) => (
                  <button
                    key={asset.symbol}
                    onClick={() => handleQuickSearch(asset.symbol)}
                    className="w-full px-4 py-3 text-left hover:bg-muted/50 flex items-center justify-between border-b border-border/50 last:border-b-0"
                  >
                    <div>
                      <span className="font-semibold text-foreground">{asset.symbol}</span>
                      <span className="text-muted-foreground ml-2">•</span>
                      <span className="text-sm text-muted-foreground ml-2">{asset.name}</span>
                    </div>
                    <span className="text-xs bg-secondary px-2 py-1 rounded">
                      {asset.type === "mutual_fund" ? "Mutual Fund" : asset.type.toUpperCase()}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Popular Searches */}
          <div className="flex flex-wrap items-center justify-center gap-2">
            <span className="text-sm text-muted-foreground">Popular:</span>
            {popularSearches.map((item) => (
              <Button
                key={item.symbol}
                variant="outline"
                size="sm"
                onClick={() => handleQuickSearch(item.symbol)}
                className="text-xs"
              >
                {item.symbol}
              </Button>
            ))}
          </div>
        </div>

        {/* Search Results Banner */}
        {searchResults.length > 0 && (
          <div className="flex items-center justify-between mb-6 p-4 glass-card">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-primary" />
              <span className="font-medium text-foreground">
                Search results for "{searchQuery}"
              </span>
              <span className="text-sm text-muted-foreground">
                ({searchResults.length} found)
              </span>
            </div>
            <Button variant="ghost" size="sm" onClick={clearSearch}>
              <X className="w-4 h-4 mr-1" />
              Clear
            </Button>
          </div>
        )}

        {/* Trending Section Header */}
        {searchResults.length === 0 && (
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <div>
              <h2 className="text-2xl font-bold text-foreground">Trending Assets</h2>
              <p className="text-muted-foreground">
                Featured stocks, crypto, and ETFs
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
        )}

        {/* Filter Tabs */}
        {searchResults.length === 0 && (
          <div className="flex gap-1 p-1 bg-secondary/50 rounded-lg mb-6 overflow-x-auto">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "px-4 py-2 rounded-md text-sm font-medium transition-all whitespace-nowrap",
                  activeTab === tab.id
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}

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
                  [...Array(12)].map((_, i) => (
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
                    <td colSpan={6} className="p-12 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <Search className="w-12 h-12 text-muted-foreground/50" />
                        <p className="text-muted-foreground">
                          {searchQuery 
                            ? "No results found. Try searching for a different symbol or company name." 
                            : "No data available. Use the search bar above to find any stock."}
                        </p>
                      </div>
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
            Search for any publicly traded stock, ETF, or mutual fund by entering the ticker symbol (e.g., AAPL, SPY, VFIAX) 
            or company name. Cryptocurrency data includes all major coins. Stock data is provided by Alpha Vantage, 
            cryptocurrency data by CoinGecko. Data refreshes automatically every 30 seconds.
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
