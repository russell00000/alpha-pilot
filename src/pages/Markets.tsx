import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { RefreshCw, TrendingUp, TrendingDown, Search, X, Loader2, Globe, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import SparklineChart from "@/components/SparklineChart";
import Header from "@/components/Header";
import { useToast } from "@/hooks/use-toast";
import { top100Stocks, topETFs, topMutualFunds } from "@/data/top-stocks";

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
];

const Markets = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("all");
  const [liveData, setLiveData] = useState<MarketData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<MarketData[]>([]);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loadingSymbol, setLoadingSymbol] = useState<string | null>(null);
  const { toast } = useToast();

  // Map to store fetched prices
  const [priceCache, setPriceCache] = useState<Record<string, MarketData>>({});

  // Batch fetch prices for multiple symbols
  const batchFetchPrices = useCallback(async (symbols: string[]) => {
    const uncached = symbols.filter(s => !priceCache[s]);
    if (uncached.length === 0) return;

    try {
      const { data, error } = await supabase.functions.invoke("market-data", {
        body: { symbols: uncached },
      });

      if (!error && data?.data) {
        const cache: Record<string, MarketData> = {};
        data.data.forEach((item: MarketData) => {
          cache[item.symbol] = item;
        });
        setPriceCache(prev => ({ ...prev, ...cache }));
      }
    } catch (err) {
      console.error("Error batch fetching:", err);
    }
  }, [priceCache]);

  const fetchMarketData = useCallback(async () => {
    try {
      const { data, error } = await supabase.functions.invoke("market-data", {
        body: { type: "all" },
      });

      if (error) throw error;

      if (data?.data && Array.isArray(data.data)) {
        setLiveData(data.data);
        setLastUpdated(new Date());
        
        // Cache the prices
        const cache: Record<string, MarketData> = {};
        data.data.forEach((item: MarketData) => {
          cache[item.symbol] = item;
        });
        setPriceCache(prev => ({ ...prev, ...cache }));
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

    const interval = setInterval(fetchMarketData, 60000);
    return () => clearInterval(interval);
  }, [fetchMarketData]);

  // Auto-load prices when tab changes (limit to 10 to avoid rate limits)
  useEffect(() => {
    const loadTabPrices = async () => {
      let symbols: string[] = [];
      
      if (activeTab === "stocks") {
        symbols = top100Stocks.map(s => s.symbol).slice(0, 10);
      } else if (activeTab === "etf") {
        symbols = topETFs.map(e => e.symbol).slice(0, 10);
      } else if (activeTab === "mutual_fund") {
        symbols = topMutualFunds.map(m => m.symbol).slice(0, 10);
      }
      
      if (symbols.length > 0) {
        setIsRefreshing(true);
        await batchFetchPrices(symbols);
        setIsRefreshing(false);
      }
    };
    
    loadTabPrices();
  }, [activeTab, batchFetchPrices]);

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
        // Cache results
        const cache: Record<string, MarketData> = {};
        data.data.forEach((item: MarketData) => {
          cache[item.symbol] = item;
        });
        setPriceCache(prev => ({ ...prev, ...cache }));
        
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

  const fetchSingleStock = async (symbol: string) => {
    if (priceCache[symbol]) return; // Already have data
    
    setLoadingSymbol(symbol);
    try {
      const { data, error } = await supabase.functions.invoke("market-data", {
        body: { search: symbol },
      });

      if (!error && data?.data?.[0]) {
        setPriceCache(prev => ({ ...prev, [symbol]: data.data[0] }));
      }
    } catch (err) {
      console.error("Error fetching stock:", err);
    } finally {
      setLoadingSymbol(null);
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

  // Combine static data with live prices
  const getDisplayData = () => {
    if (searchResults.length > 0) return searchResults;

    switch (activeTab) {
      case "stocks":
        return top100Stocks.map(stock => {
          const cached = priceCache[stock.symbol];
          return cached || {
            symbol: stock.symbol,
            name: stock.name,
            price: "—",
            change: 0,
            changePercent: 0,
            volume: "—",
            type: "stock" as const,
          };
        });
      case "crypto":
        return liveData.filter(item => item.type === "crypto");
      case "etf":
        return topETFs.map(etf => {
          const cached = priceCache[etf.symbol];
          return cached || {
            symbol: etf.symbol,
            name: etf.name,
            price: "—",
            change: 0,
            changePercent: 0,
            volume: "—",
            type: "etf" as const,
          };
        });
      case "mutual_fund":
        return topMutualFunds.map(fund => {
          const cached = priceCache[fund.symbol];
          return cached || {
            symbol: fund.symbol,
            name: fund.name,
            price: "—",
            change: 0,
            changePercent: 0,
            volume: "—",
            type: "mutual_fund" as const,
          };
        });
      default:
        // All tab - show live data + unfetched stocks
        const liveSymbols = new Set(liveData.map(d => d.symbol));
        const additionalStocks = top100Stocks
          .filter(s => !liveSymbols.has(s.symbol))
          .slice(0, 20)
          .map(stock => {
            const cached = priceCache[stock.symbol];
            return cached || {
              symbol: stock.symbol,
              name: stock.name,
              price: "—",
              change: 0,
              changePercent: 0,
              volume: "—",
              type: "stock" as const,
            };
          });
        return [...liveData, ...additionalStocks];
    }
  };

  const displayData = getDisplayData();

  // Filter suggestions from all available assets
  const allAssets = [
    ...top100Stocks.map(s => ({ ...s, type: "stock" })),
    ...topETFs.map(e => ({ ...e, type: "etf" })),
    ...topMutualFunds.map(m => ({ ...m, type: "mutual_fund" })),
  ];

  const filteredSuggestions = searchQuery
    ? allAssets.filter(asset => {
        const query = searchQuery.toLowerCase();
        return (
          asset.symbol.toLowerCase().includes(query) ||
          asset.name.toLowerCase().includes(query)
        );
      }).slice(0, 10)
    : [];

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
            Browse the top 100 stocks or search by ticker symbol.
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
            {showSuggestions && searchQuery && filteredSuggestions.length > 0 && searchResults.length === 0 && (
              <div className="absolute z-10 w-full mt-1 bg-background border border-border rounded-lg shadow-lg max-h-64 overflow-y-auto text-left">
                <p className="px-4 py-2 text-xs text-muted-foreground border-b border-border">
                  Quick suggestions:
                </p>
                {filteredSuggestions.map((asset) => (
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

        {/* Section Header */}
        {searchResults.length === 0 && (
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <div>
              <h2 className="text-2xl font-bold text-foreground">
                {activeTab === "stocks" ? "Top 100 Stocks" :
                 activeTab === "crypto" ? "Cryptocurrencies" :
                 activeTab === "etf" ? "Top ETFs" :
                 activeTab === "mutual_fund" ? "Top Mutual Funds" :
                 "All Markets"}
              </h2>
              <p className="text-muted-foreground">
                {activeTab === "stocks" ? "Top US stocks by market capitalization" :
                 activeTab === "crypto" ? "Live cryptocurrency prices" :
                 activeTab === "etf" ? "Popular exchange-traded funds" :
                 activeTab === "mutual_fund" ? "Top-rated mutual funds" :
                 "Featured assets across all markets"}
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
                {tab.id === "stocks" && <span className="ml-1 text-xs text-muted-foreground">(100)</span>}
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
                  <th className="text-left p-4 text-sm font-medium text-muted-foreground">#</th>
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
                      <td className="p-4"><div className="h-4 bg-muted rounded w-6" /></td>
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-muted" />
                          <div>
                            <div className="h-4 bg-muted rounded w-16 mb-1" />
                            <div className="h-3 bg-muted rounded w-24" />
                          </div>
                        </div>
                      </td>
                      <td className="p-4 text-right"><div className="h-5 bg-muted rounded w-20 ml-auto" /></td>
                      <td className="p-4 text-right"><div className="h-5 bg-muted rounded w-16 ml-auto" /></td>
                      <td className="p-4 text-right hidden md:table-cell"><div className="h-5 bg-muted rounded w-16 ml-auto" /></td>
                      <td className="p-4 text-right hidden md:table-cell"><div className="h-5 bg-muted rounded w-12 ml-auto" /></td>
                      <td className="p-4 text-right hidden lg:table-cell"><div className="h-10 bg-muted rounded w-24 ml-auto" /></td>
                    </tr>
                  ))
                ) : displayData.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-12 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <Search className="w-12 h-12 text-muted-foreground/50" />
                        <p className="text-muted-foreground">
                          {searchQuery 
                            ? "No results found. Try searching for a different symbol." 
                            : "No data available."}
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  displayData.map((item, index) => {
                    const isPositive = item.change >= 0;
                    const hasPrice = item.price !== "—";
                    const isLoadingThis = loadingSymbol === item.symbol;
                    
                    return (
                      <tr 
                        key={item.symbol} 
                        className="border-b border-border/50 hover:bg-muted/20 transition-colors cursor-pointer"
                        onClick={() => navigate(`/stock/${item.symbol}`)}
                      >
                        <td className="p-4 text-muted-foreground text-sm">{index + 1}</td>
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
                          {isLoadingThis ? (
                            <Loader2 className="w-4 h-4 animate-spin ml-auto" />
                          ) : hasPrice ? (
                            <p className="font-semibold text-foreground">${item.price}</p>
                          ) : (
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="text-xs text-primary"
                              onClick={(e) => {
                                e.stopPropagation();
                                fetchSingleStock(item.symbol);
                              }}
                            >
                              Load Price
                            </Button>
                          )}
                        </td>
                        <td className="p-4 text-right">
                          {hasPrice ? (
                            <div className={cn(
                              "inline-flex items-center gap-1 px-2 py-1 rounded-md text-sm font-medium",
                              isPositive ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"
                            )}>
                              {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                              {isPositive ? "+" : ""}{item.changePercent.toFixed(2)}%
                            </div>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
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
            Browse the top 100 US stocks by market cap, popular ETFs, and major cryptocurrencies. 
            Prices update automatically when you switch tabs. Use the search bar to find any publicly traded asset. 
            Real-time data provided by Finnhub and CoinGecko.
          </p>
        </div>

        {/* Live indicator */}
        <div className="flex items-center justify-center gap-2 mt-6">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-success"></span>
          </span>
          <span className="text-sm text-muted-foreground">Live data • Auto-updates every 60s</span>
        </div>
      </main>
    </div>
  );
};

export default Markets;
