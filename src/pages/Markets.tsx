import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { RefreshCw, TrendingUp, TrendingDown, Search, X, Loader2, Globe, BarChart3, Briefcase, PieChart, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import SparklineChart from "@/components/SparklineChart";
import Header from "@/components/Header";
import { useToast } from "@/hooks/use-toast";
import { top100Stocks, topETFs, topMutualFunds } from "@/data/top-stocks";
import financeBg from "@/assets/finance-bg.webp";
import { SearchSuggestions } from "@/components/SearchSuggestions";
import { useSymbolSearch } from "@/hooks/useSymbolSearch";

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

const safeNumber = (value: unknown, fallback = 0) => {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : fallback;
};

const normalizeMarketData = (item: any, fallback?: Partial<MarketData>): MarketData => {
  const symbol = String(item?.symbol || fallback?.symbol || "").toUpperCase();
  const type = (item?.type || fallback?.type || "stock") as MarketData["type"];

  return {
    symbol,
    name: String(item?.name || fallback?.name || symbol || "Unknown"),
    price: item?.price === undefined || item?.price === null || item?.price === "" ? fallback?.price || "—" : String(item.price),
    change: safeNumber(item?.change, fallback?.change || 0),
    changePercent: safeNumber(item?.changePercent, fallback?.changePercent || 0),
    volume: String(item?.volume || fallback?.volume || "—"),
    sparkline: Array.isArray(item?.sparkline)
      ? item.sparkline.map((point: unknown) => safeNumber(point)).filter(Number.isFinite)
      : fallback?.sparkline,
    type,
  };
};

const tabs = [
  { id: "stocks", label: "Stocks", icon: BarChart3, count: null, description: "US equities" },
  { id: "etf", label: "ETFs", icon: PieChart, count: null, description: "Exchange-traded funds" },
  { id: "mutual_fund", label: "Mutual Funds", icon: Briefcase, count: null, description: "Managed portfolios" },
  { id: "sectors", label: "Sectors", icon: Layers, count: null, description: "S&P 500 sector moves" },
];

// SPDR sector ETFs used as proxies for how each S&P 500 sector is moving today.
const sectorProxies: Array<{ symbol: string; name: string; description: string }> = [
  { symbol: "XLK", name: "Technology", description: "Software, semis, hardware" },
  { symbol: "XLV", name: "Health Care", description: "Pharma, biotech, devices" },
  { symbol: "XLF", name: "Financials", description: "Banks, insurance, capital markets" },
  { symbol: "XLY", name: "Consumer Discretionary", description: "Retail, autos, leisure" },
  { symbol: "XLP", name: "Consumer Staples", description: "Food, beverage, household" },
  { symbol: "XLI", name: "Industrials", description: "Aerospace, machinery, transport" },
  { symbol: "XLE", name: "Energy", description: "Oil, gas, services" },
  { symbol: "XLU", name: "Utilities", description: "Electric, water, gas utilities" },
  { symbol: "XLB", name: "Materials", description: "Chemicals, metals, mining" },
  { symbol: "XLRE", name: "Real Estate", description: "REITs & real estate services" },
  { symbol: "XLC", name: "Communication Services", description: "Media, telecom, internet" },
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
  const [activeTab, setActiveTab] = useState("stocks");
  const [liveData, setLiveData] = useState<MarketData[]>([]);
  const [isLoading, setIsLoading] = useState(false); // Start false - show content immediately
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<MarketData[]>([]);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loadingSymbol, setLoadingSymbol] = useState<string | null>(null);
  const [visibleRows, setVisibleRows] = useState(30);
  const { toast } = useToast();

  // Map to store fetched prices
  const [priceCache, setPriceCache] = useState<Record<string, MarketData>>({});
  const priceCacheRef = useRef<Record<string, MarketData>>({});

  const mergePriceCache = useCallback((cache: Record<string, MarketData>) => {
    setPriceCache(prev => {
      const next = { ...prev, ...cache };
      priceCacheRef.current = next;
      return next;
    });
  }, []);

  // Batch fetch prices for multiple symbols
  const batchFetchPrices = useCallback(async (symbols: string[]) => {
    const uncached = symbols.filter(s => !priceCacheRef.current[s]);
    if (uncached.length === 0) return;

    try {
      const { data, error } = await supabase.functions.invoke("market-data", {
        body: { symbols: uncached },
      });

      if (!error && Array.isArray(data?.data)) {
        const cache: Record<string, MarketData> = {};
        data.data.forEach((item: any) => {
          const normalized = normalizeMarketData(item);
          if (normalized.symbol) cache[normalized.symbol] = normalized;
        });
        mergePriceCache(cache);
      }
    } catch (err) {
      console.error("Error batch fetching:", err);
    }
  }, [mergePriceCache]);

  const fetchMarketData = useCallback(async () => {
    try {
      const { data, error } = await supabase.functions.invoke("market-data", {
        body: { type: "all" },
      });

      if (error) throw error;

      if (data?.data && Array.isArray(data.data)) {
        const normalizedData = data.data.map((item: any) => normalizeMarketData(item)).filter((item) => item.symbol);
        setLiveData(normalizedData);
        setLastUpdated(new Date());
        
        // Cache all returned prices immediately
        const cache: Record<string, MarketData> = {};
        normalizedData.forEach((item) => {
          cache[item.symbol] = item;
        });
        mergePriceCache(cache);
        setIsLoading(false);
      }
    } catch (err) {
      console.error("Error fetching market data:", err);
      setIsLoading(false);
    }
  }, [mergePriceCache]);

  useEffect(() => {
    // Fetch data in background - don't block UI with loading state
    fetchMarketData();

    const interval = setInterval(fetchMarketData, 60000);
    return () => clearInterval(interval);
  }, [fetchMarketData]);

  // Only load additional prices if not already loaded from "type: all"
  useEffect(() => {
    let isCancelled = false;
    
    const loadAdditionalPrices = async () => {
      let allSymbols: string[] = [];
      
      if (activeTab === "stocks") {
        // Only load stocks not already in cache (first 30 already loaded by "type:all")
        allSymbols = top100Stocks.map(s => s.symbol);
      } else if (activeTab === "etf") {
        allSymbols = topETFs.map(e => e.symbol);
      } else if (activeTab === "mutual_fund") {
        allSymbols = topMutualFunds.map(m => m.symbol);
      } else if (activeTab === "sectors") {
        allSymbols = sectorProxies.map(s => s.symbol);
      }
      
      if (allSymbols.length === 0) return;
      
      // Filter out already cached symbols
      const uncached = allSymbols.filter(s => !priceCacheRef.current[s]);
      if (uncached.length === 0) return;
      
      // Load visible prices quickly, then continue in controlled batches.
      const batchSize = 10;
      for (let i = 0; i < uncached.length; i += batchSize) {
        if (isCancelled) break;
        const batch = uncached.slice(i, i + batchSize);
        await batchFetchPrices(batch);
        if (i + batchSize < uncached.length) {
          await new Promise(resolve => setTimeout(resolve, 350));
        }
      }
    };
    
    const timer = setTimeout(loadAdditionalPrices, 500);
    
    return () => { 
      isCancelled = true;
      clearTimeout(timer);
    };
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
        const normalizedResults = data.data.map((item: any) => normalizeMarketData(item)).filter((item) => item.symbol);
        setSearchResults(normalizedResults);
        // Cache results
        const cache: Record<string, MarketData> = {};
        normalizedResults.forEach((item) => {
          cache[item.symbol] = item;
        });
        mergePriceCache(cache);
        
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
        const normalized = normalizeMarketData(data.data[0], { symbol });
        mergePriceCache({ [normalized.symbol]: normalized });
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

  // Generate realistic sparkline data with pronounced daily movement
  const generateSparkline = (symbol: string, changePercent: number): number[] => {
    const points = 78; // Mimics ~5 min intervals in a trading day
    const sparkline: number[] = [];
    
    // Use symbol to generate a consistent seed
    let seed = symbol.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const pseudoRandom = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };
    
    const startValue = 100;
    const endValue = startValue * (1 + changePercent / 100);
    
    // Base volatility scales with the magnitude of change
    const baseVolatility = Math.max(0.3, Math.abs(changePercent) * 0.15);
    
    // Create distinct intraday phases (pre-market momentum, mid-day chop, power hour)
    const phases = [
      { start: 0, end: 0.15, volatility: baseVolatility * 1.8, trend: pseudoRandom() - 0.4 },
      { start: 0.15, end: 0.4, volatility: baseVolatility * 0.8, trend: pseudoRandom() - 0.5 },
      { start: 0.4, end: 0.6, volatility: baseVolatility * 0.6, trend: 0 },
      { start: 0.6, end: 0.85, volatility: baseVolatility * 1.0, trend: pseudoRandom() - 0.5 },
      { start: 0.85, end: 1, volatility: baseVolatility * 1.5, trend: (endValue - startValue) / startValue * 2 },
    ];
    
    let currentValue = startValue;
    let momentum = 0;
    let prevDirection = 0;
    
    for (let i = 0; i < points; i++) {
      const progress = i / (points - 1);
      
      // Find current phase
      const phase = phases.find(p => progress >= p.start && progress < p.end) || phases[phases.length - 1];
      
      // Add occasional sharp moves (news events, volume spikes)
      const isSharpMove = pseudoRandom() > 0.92;
      const sharpMultiplier = isSharpMove ? (2 + pseudoRandom() * 2) : 1;
      
      // Random walk with varying intensity
      const randomDirection = pseudoRandom() - 0.5;
      
      // Add some continuation bias (trends tend to continue briefly)
      const continuationBias = prevDirection * 0.3;
      
      const volatilityNow = phase.volatility * sharpMultiplier;
      const move = (randomDirection + continuationBias + phase.trend * 0.1) * volatilityNow;
      
      // Momentum smoothing
      momentum = momentum * 0.4 + move * 0.6;
      
      // Mean reversion towards end value (stronger near the end)
      const meanReversion = (endValue - currentValue) * progress * 0.08;
      
      currentValue += momentum + meanReversion;
      prevDirection = move > 0 ? 1 : -1;
      
      // Keep within reasonable intraday bounds
      const maxSwing = startValue * 0.08;
      currentValue = Math.max(currentValue, Math.min(startValue, endValue) - maxSwing);
      currentValue = Math.min(currentValue, Math.max(startValue, endValue) + maxSwing);
      
      sparkline.push(parseFloat(currentValue.toFixed(2)));
    }
    
    // Ensure last point matches the actual change
    sparkline[sparkline.length - 1] = endValue;
    
    return sparkline;
  };

  // Add sparkline to item if missing
  const ensureSparkline = (item: MarketData): MarketData => {
    const normalized = normalizeMarketData(item);
    if (normalized.sparkline && normalized.sparkline.length > 0) return normalized;
    return {
      ...normalized,
      sparkline: generateSparkline(normalized.symbol, normalized.changePercent || 0),
    };
  };

  // Combine static data with live prices
  const getDisplayData = () => {
    if (searchResults.length > 0) return searchResults.map(ensureSparkline);

    switch (activeTab) {
      case "stocks":
        return top100Stocks.map(stock => {
          const cached = priceCache[stock.symbol];
          const item = cached || {
            symbol: stock.symbol,
            name: stock.name,
            price: "—",
            change: 0,
            changePercent: 0,
            volume: "—",
            type: "stock" as const,
          };
          return ensureSparkline(item);
        });
      case "etf":
        return topETFs.map(etf => {
          const cached = priceCache[etf.symbol];
          const item = cached || {
            symbol: etf.symbol,
            name: etf.name,
            price: "—",
            change: 0,
            changePercent: 0,
            volume: "—",
            type: "etf" as const,
          };
          return ensureSparkline(item);
        });
      case "mutual_fund":
        return topMutualFunds.map(fund => {
          const cached = priceCache[fund.symbol];
          const item = cached || {
            symbol: fund.symbol,
            name: fund.name,
            price: "—",
            change: 0,
            changePercent: 0,
            volume: "—",
            type: "mutual_fund" as const,
          };
          return ensureSparkline(item);
        });
      default:
        return top100Stocks.map(stock => {
          const cached = priceCache[stock.symbol];
          const item = cached || {
            symbol: stock.symbol,
            name: stock.name,
            price: "—",
            change: 0,
            changePercent: 0,
            volume: "—",
            type: "stock" as const,
          };
          return ensureSparkline(item);
        });
    }
  };

  const displayData = getDisplayData();
  const visibleDisplayData = displayData.slice(0, visibleRows);

  useEffect(() => {
    setVisibleRows(30);
  }, [activeTab, searchQuery, searchResults.length]);

  // Filter suggestions from all available assets including cryptos
  const cryptoAssets = [
    { symbol: "BTC", name: "Bitcoin", type: "crypto" },
    { symbol: "ETH", name: "Ethereum", type: "crypto" },
    { symbol: "XRP", name: "XRP", type: "crypto" },
    { symbol: "SOL", name: "Solana", type: "crypto" },
    { symbol: "DOGE", name: "Dogecoin", type: "crypto" },
    { symbol: "ADA", name: "Cardano", type: "crypto" },
    { symbol: "LINK", name: "Chainlink", type: "crypto" },
    { symbol: "AVAX", name: "Avalanche", type: "crypto" },
    { symbol: "DOT", name: "Polkadot", type: "crypto" },
    { symbol: "MATIC", name: "Polygon", type: "crypto" },
    { symbol: "SHIB", name: "Shiba Inu", type: "crypto" },
    { symbol: "LTC", name: "Litecoin", type: "crypto" },
    { symbol: "UNI", name: "Uniswap", type: "crypto" },
    { symbol: "ATOM", name: "Cosmos", type: "crypto" },
    { symbol: "XLM", name: "Stellar", type: "crypto" },
    { symbol: "ALGO", name: "Algorand", type: "crypto" },
    { symbol: "VET", name: "VeChain", type: "crypto" },
    { symbol: "NEAR", name: "NEAR Protocol", type: "crypto" },
    { symbol: "FTM", name: "Fantom", type: "crypto" },
    { symbol: "SAND", name: "The Sandbox", type: "crypto" },
    { symbol: "MANA", name: "Decentraland", type: "crypto" },
    { symbol: "AXS", name: "Axie Infinity", type: "crypto" },
    { symbol: "APE", name: "ApeCoin", type: "crypto" },
    { symbol: "CRO", name: "Cronos", type: "crypto" },
    { symbol: "FIL", name: "Filecoin", type: "crypto" },
    { symbol: "AAVE", name: "Aave", type: "crypto" },
    { symbol: "MKR", name: "Maker", type: "crypto" },
    { symbol: "COMP", name: "Compound", type: "crypto" },
    { symbol: "SNX", name: "Synthetix", type: "crypto" },
  ];

  const allAssets = [
    ...top100Stocks.map(s => ({ ...s, type: "stock" })),
    ...topETFs.map(e => ({ ...e, type: "etf" })),
    ...topMutualFunds.map(m => ({ ...m, type: "mutual_fund" })),
    ...cryptoAssets,
  ];

  const filteredSuggestions = searchQuery.trim()
    ? (() => {
        const query = searchQuery.toLowerCase().trim();

        const score = (asset: { symbol: string; name: string }) => {
          const sym = asset.symbol.toLowerCase();
          const name = asset.name.toLowerCase();

          // Exact matches first
          if (sym === query) return 0;
          if (name === query) return 1;

          // Symbol or name prefix
          const symPrefix = sym.startsWith(query);
          const namePrefix = name.startsWith(query);
          if (symPrefix) return 10;
          if (namePrefix) return 11;

          // Word prefix (a word in the name starts with query)
          const wordPrefix = name.split(/\s+/).some((w) => w.startsWith(query));
          if (wordPrefix) return 20;

          // Contains match (symbol or name contains the query anywhere)
          const symContains = sym.includes(query);
          const nameContains = name.includes(query);
          if (symContains) return 30;
          if (nameContains) return 31;

          return 999; // no match
        };

        return allAssets
          .map((asset) => ({ asset, score: score(asset) }))
          .filter((x) => x.score < 999)
          .sort((a, b) => {
            if (a.score !== b.score) return a.score - b.score;
            // Tie-breakers: prefer the shortest match overall (symbol + name length)
            const lenA = a.asset.symbol.length + a.asset.name.length;
            const lenB = b.asset.symbol.length + b.asset.name.length;
            return lenA - lenB;
          })
          .slice(0, 8)
          .map((x) => x.asset);
      })()
    : [];

  // Dynamic, market-wide symbol search (Yahoo). Ensures any listed security
  // is reachable even if it's not in our static list.
  const { results: remoteSuggestions } = useSymbolSearch(searchQuery, 1, 250);

  // Merge: local matches first, then any remote symbols we don't already show.
  const mergedSuggestions = (() => {
    const seen = new Set(filteredSuggestions.map((s: any) => s.symbol.toUpperCase()));
    const remote = remoteSuggestions
      .filter((r) => r.symbol && !seen.has(r.symbol.toUpperCase()))
      .map((r) => ({ symbol: r.symbol, name: r.name, type: r.type }));
    return [...filteredSuggestions, ...remote].slice(0, 15);
  })();


  return (
    <div className="min-h-screen bg-background relative">
      {/* Finance background */}
      <div className="fixed inset-0 pointer-events-none opacity-100" style={{ backgroundImage: `url(${financeBg})`, backgroundSize: 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat' }} />
      <div className="fixed inset-0 pointer-events-none bg-background/70" />

      <Header />
      
      <main className="container mx-auto px-4 py-8 relative">
        {/* Hero Search Section */}
        <div className="rounded-2xl bg-background/50 backdrop-blur-sm border border-border/20 p-8 mb-8 text-center overflow-visible relative z-20">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Globe className="w-8 h-8 text-primary" />
            <h1 className="text-3xl md:text-4xl font-bold text-foreground">
              Search the Entire Market
            </h1>
          </div>
          <p className="text-muted-foreground mb-6 max-w-2xl mx-auto">
            Access real-time data for thousands of stocks, ETFs, mutual funds, and cryptocurrencies.
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
                // Clear previous search results when typing again
                if (searchResults.length > 0) {
                  setSearchResults([]);
                }
              }}
              onKeyDown={handleKeyDown}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => {
                // Delay hiding suggestions to allow click to register
                setTimeout(() => setShowSuggestions(false), 200);
              }}
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
            
            <SearchSuggestions
              suggestions={mergedSuggestions}
              onSelect={(asset) => handleQuickSearch(asset.symbol)}
              visible={showSuggestions && searchQuery.length > 0}
              query={searchQuery}
            />
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
          <div className="flex items-center justify-between mb-6 p-4 rounded-2xl bg-background/50 backdrop-blur-sm border border-border/20">
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

        {/* Category Cards */}
        {searchResults.length === 0 && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "relative p-5 rounded-xl border-2 transition-all duration-300 text-left group",
                    isActive
                      ? "border-primary bg-primary/5 shadow-lg shadow-primary/10"
                      : "border-border/50 bg-card hover:border-primary/50 hover:bg-primary/5"
                  )}
                >
                  <div className={cn(
                    "w-10 h-10 rounded-lg flex items-center justify-center mb-3 transition-colors",
                    isActive ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground group-hover:bg-primary/20 group-hover:text-primary"
                  )}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <h3 className={cn(
                    "font-semibold text-lg mb-1 transition-colors",
                    isActive ? "text-primary" : "text-foreground"
                  )}>
                    {tab.label}
                    {tab.count && <span className="text-sm font-normal text-muted-foreground ml-1">({tab.count})</span>}
                  </h3>
                  <p className="text-sm text-muted-foreground">{tab.description}</p>
                  {isActive && (
                    <div className="absolute top-3 right-3 w-2 h-2 rounded-full bg-primary animate-pulse" />
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Section Header */}
        {searchResults.length === 0 && (
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-semibold text-foreground">
                {activeTab === "stocks" ? "Stocks" :
                 activeTab === "crypto" ? "Cryptocurrencies" :
                 activeTab === "etf" ? "ETFs" :
                 "Mutual Funds"}
              </h2>
              <p className="text-sm text-muted-foreground">
                {lastUpdated && `Updated ${lastUpdated.toLocaleTimeString()}`}
              </p>
            </div>
            <Button 
              variant="outline" 
              size="sm"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="gap-2"
            >
              <RefreshCw className={cn("w-4 h-4", isRefreshing && "animate-spin")} />
              Refresh
            </Button>
          </div>
        )}


        {/* Market Table */}
        <div className="rounded-2xl bg-background/50 backdrop-blur-sm border border-border/20 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border/50">
                  <th className="text-left p-4 text-sm font-medium text-muted-foreground">#</th>
                  <th className="text-left p-4 text-sm font-medium text-muted-foreground">Asset</th>
                  <th className="text-right p-4 text-sm font-medium text-muted-foreground">Price</th>
                  <th className="text-right p-4 text-sm font-medium text-muted-foreground">24h Change</th>
                  <th className="text-right p-4 text-sm font-medium text-muted-foreground hidden md:table-cell">Type</th>
                  <th className="text-right p-4 text-sm font-medium text-muted-foreground w-28 md:w-32">Chart</th>
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
                      <td className="p-4 text-right hidden md:table-cell"><div className="h-5 bg-muted rounded w-12 ml-auto" /></td>
                      <td className="p-4 text-right"><div className="h-10 bg-muted rounded w-20 md:w-24 ml-auto" /></td>
                    </tr>
                  ))
                ) : displayData.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-12 text-center">
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
                  visibleDisplayData.map((item, index) => {
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
                              "w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm overflow-hidden bg-secondary",
                              item.type === "crypto" ? "bg-primary/20 text-primary" :
                              item.type === "etf" ? "bg-accent/20 text-accent-foreground" :
                              item.type === "mutual_fund" ? "bg-warning/20 text-warning" :
                              "text-foreground"
                            )}>
                              <img
                                src={`https://assets.parqet.com/logos/symbol/${item.symbol}`}
                                alt={item.symbol}
                                loading="lazy"
                                decoding="async"
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  const target = e.currentTarget;
                                  target.style.display = 'none';
                                  if (target.nextElementSibling) (target.nextElementSibling as HTMLElement).style.display = 'flex';
                                }}
                              />
                              <span className="hidden items-center justify-center w-full h-full text-sm font-bold">
                                {item.symbol.slice(0, 2)}
                              </span>
                            </div>
                            <div>
                              <p className="font-semibold text-foreground">{item.symbol}</p>
                              <p className="text-sm text-muted-foreground">{item.name}</p>
                            </div>
                          </div>
                        </td>
                        <td className="p-4 text-right">
                          {isLoadingThis ? (
                            <Loader2 className="w-4 h-4 animate-spin ml-auto text-muted-foreground" />
                          ) : hasPrice ? (
                            <p className="font-semibold text-foreground">${item.price}</p>
                          ) : (
                            <div className="flex items-center justify-end gap-2">
                              <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
                              <span className="text-sm text-muted-foreground">Loading...</span>
                            </div>
                          )}
                        </td>
                        <td className="p-4 text-right">
                          {hasPrice ? (
                            <div className={cn(
                              "inline-flex items-center gap-1 px-2 py-1 rounded-md text-sm font-medium",
                              isPositive ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"
                            )}>
                              {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                              {isPositive ? "+" : ""}{safeNumber(item.changePercent).toFixed(2)}%
                            </div>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
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
                        <td className="p-4 text-right w-28 md:w-32">
                          <div className="w-20 md:w-24 h-10 ml-auto">
                            <SparklineChart data={item.sparkline || []} positive={isPositive} />
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {visibleRows < displayData.length && (
          <div className="flex justify-center mt-4">
            <Button variant="outline" size="sm" onClick={() => setVisibleRows((count) => Math.min(count + 30, displayData.length))}>
              Load more assets
            </Button>
          </div>
        )}

        {/* Info Section */}
        <div className="mt-6 p-4 rounded-2xl bg-background/50 backdrop-blur-sm border border-border/20">
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
