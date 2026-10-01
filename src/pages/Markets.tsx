import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { RefreshCw, TrendingUp, TrendingDown, Search, X, Loader2, Globe, BarChart3, Briefcase, PieChart, Layers, Star } from "lucide-react";
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
import IndicesBar from "@/components/markets/IndicesBar";
import SectorHeatMap from "@/components/markets/SectorHeatMap";
import { useFinnhubQuotes } from "@/hooks/useFinnhubQuotes";
import { useMarketClock } from "@/hooks/useMarketClock";
import { useWatchlist } from "@/hooks/useWatchlist";

const prefetchStockPage = () => { void import("@/pages/Stock"); };

interface MarketData {
  symbol: string;
  name: string;
  price: string;
  change: number;
  changePercent: number;
  volume: string;
  sparkline?: number[];
  type: "stock" | "crypto" | "etf" | "mutual_fund";
  /** Live Finnhub extras */
  dayHigh?: number | null;
  dayLow?: number | null;
  marketCap?: number | null;
  volumeShares?: number | null;
  /** Direction of the latest tick, used for the 600ms price flash. */
  tick?: "up" | "down" | "flat";
  /** True when the newest poll failed and we're showing the last known price. */
  delayed?: boolean;
}

const compact = (value?: number | null) => {
  if (!value || !Number.isFinite(value)) return "—";
  const units = [
    { limit: 1e12, suffix: "T" },
    { limit: 1e9, suffix: "B" },
    { limit: 1e6, suffix: "M" },
    { limit: 1e3, suffix: "K" },
  ];
  const unit = units.find((u) => Math.abs(value) >= u.limit);
  return unit ? `${(value / unit.limit).toFixed(2)}${unit.suffix}` : value.toFixed(2);
};

const formatPrice = (value: number) =>
  value >= 1000
    ? value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : value < 1
      ? value.toFixed(4)
      : value.toFixed(2);

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
  { id: "all", label: "All", icon: Globe, description: "Everything we track" },
  { id: "stocks", label: "Stocks", icon: BarChart3, description: "US equities" },
  { id: "etf", label: "ETFs", icon: PieChart, description: "Exchange-traded funds" },
  { id: "crypto", label: "Crypto", icon: Globe, description: "Digital assets" },
  { id: "mutual_fund", label: "Mutual Funds", icon: Briefcase, description: "Managed portfolios" },
  { id: "sectors", label: "Sectors", icon: Layers, description: "S&P 500 sector moves" },
];

// Crypto tickers priced through the Finnhub proxy (with CoinGecko fallback).
const cryptoUniverse = [
  { symbol: "BTC", name: "Bitcoin" },
  { symbol: "ETH", name: "Ethereum" },
  { symbol: "SOL", name: "Solana" },
  { symbol: "XRP", name: "XRP" },
  { symbol: "ADA", name: "Cardano" },
  { symbol: "AVAX", name: "Avalanche" },
  { symbol: "LINK", name: "Chainlink" },
  { symbol: "DOGE", name: "Dogecoin" },
];

// SPDR sector ETFs used as proxies for how each S&P 500 sector is moving today.
const sectorProxies: Array<{ symbol: string; name: string; description: string; weight: number }> = [
  { symbol: "XLK", name: "Technology", description: "Software, semis, hardware" , weight: 33 },
  { symbol: "XLV", name: "Health Care", description: "Pharma, biotech, devices" , weight: 9 },
  { symbol: "XLF", name: "Financials", description: "Banks, insurance, capital markets" , weight: 13 },
  { symbol: "XLY", name: "Consumer Discretionary", description: "Retail, autos, leisure" , weight: 11 },
  { symbol: "XLP", name: "Consumer Staples", description: "Food, beverage, household" , weight: 5 },
  { symbol: "XLI", name: "Industrials", description: "Aerospace, machinery, transport" , weight: 8 },
  { symbol: "XLE", name: "Energy", description: "Oil, gas, services" , weight: 3 },
  { symbol: "XLU", name: "Utilities", description: "Electric, water, gas utilities" , weight: 2.5 },
  { symbol: "XLB", name: "Materials", description: "Chemicals, metals, mining" , weight: 2 },
  { symbol: "XLRE", name: "Real Estate", description: "REITs & real estate services" , weight: 2 },
  { symbol: "XLC", name: "Communication Services", description: "Media, telecom, internet" , weight: 10 },
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
  // Remember the last viewed tab so the page picks up where you left off.
  const [activeTab, setActiveTabState] = useState(() => {
    try { return localStorage.getItem("vantage:markets-tab") || "stocks"; } catch { return "stocks"; }
  });
  const setActiveTab = useCallback((tab: string) => {
    setActiveTabState(tab);
    try { localStorage.setItem("vantage:markets-tab", tab); } catch { /* ignore */ }
  }, []);
  const { entries: watchlist, toggle: toggleWatch, isWatched } = useWatchlist();
  const [activeSuggestion, setActiveSuggestion] = useState(-1);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [liveData, setLiveData] = useState<MarketData[]>([]);
  const [isLoading, setIsLoading] = useState(false); // Start false - show content immediately
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<MarketData[]>([]);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  // Debounced mirror of the search box (200ms) so suggestion work never runs per keystroke.
  const [debouncedQuery, setDebouncedQuery] = useState("");
  useEffect(() => {
    const id = setTimeout(() => setDebouncedQuery(searchQuery), 200);
    return () => clearTimeout(id);
  }, [searchQuery]);
  const [loadingSymbol, setLoadingSymbol] = useState<string | null>(null);
  const [visibleRows, setVisibleRows] = useState(30);
  const { toast } = useToast();
  const { clock, isOpen: isMarketOpen } = useMarketClock();

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
      
      // The edge function now uses Yahoo's crumbed v7 bulk quote endpoint
      // (one HTTP call, ~100+ symbols). Push bigger batches so a whole tab
      // typically resolves in a single request.
      const batchSize = 120;
      const batches: string[][] = [];
      for (let i = 0; i < uncached.length; i += batchSize) {
        batches.push(uncached.slice(i, i + batchSize));
      }
      const CONCURRENCY = 2;
      for (let i = 0; i < batches.length; i += CONCURRENCY) {
        if (isCancelled) break;
        await Promise.all(batches.slice(i, i + CONCURRENCY).map(batchFetchPrices));
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
    await Promise.all([fetchMarketData(), refreshLive()]);
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
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      if (!showSuggestions || mergedSuggestions.length === 0) return;
      e.preventDefault();
      setActiveSuggestion((prev) => {
        const next = e.key === "ArrowDown" ? prev + 1 : prev - 1;
        if (next < 0) return mergedSuggestions.length - 1;
        return next % mergedSuggestions.length;
      });
      return;
    }
    if (e.key === "Enter") {
      if (showSuggestions && activeSuggestion >= 0 && mergedSuggestions[activeSuggestion]) {
        handleQuickSearch(mergedSuggestions[activeSuggestion].symbol);
        setActiveSuggestion(-1);
        return;
      }
      handleSearch();
    }
    if (e.key === "Escape") {
      setShowSuggestions(false);
      setActiveSuggestion(-1);
    }
  };

  // Press "/" anywhere on the page to jump straight to the search box.
  useEffect(() => {
    const onGlobalKey = (e: KeyboardEvent) => {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
      e.preventDefault();
      searchInputRef.current?.focus();
    };
    window.addEventListener("keydown", onGlobalKey);
    return () => window.removeEventListener("keydown", onGlobalKey);
  }, []);

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

    const fromList = (
      list: Array<{ symbol: string; name: string }>,
      type: MarketData["type"],
    ) =>
      list.map((entry) => {
        const cached = priceCache[entry.symbol];
        return ensureSparkline(
          cached || {
            symbol: entry.symbol,
            name: entry.name,
            price: "—",
            change: 0,
            changePercent: 0,
            volume: "—",
            type,
          },
        );
      });

    switch (activeTab) {
      case "all":
        return [
          ...fromList(top100Stocks.slice(0, 40), "stock"),
          ...fromList(topETFs.slice(0, 15), "etf"),
          ...fromList(cryptoUniverse, "crypto"),
          ...fromList(topMutualFunds.slice(0, 10), "mutual_fund"),
        ];
      case "crypto":
        return fromList(cryptoUniverse, "crypto");
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

  const baseDisplayData = getDisplayData();

  // Symbols currently on screen (plus the sector proxies powering the heat map).
  const visibleSlice = baseDisplayData.slice(0, visibleRows);
  const liveEquitySymbols = Array.from(
    new Set([
      ...visibleSlice.filter((item) => item.type !== "crypto").map((item) => item.symbol),
      ...sectorProxies.map((sector) => sector.symbol),
    ]),
  ).slice(0, 55);
  const liveCryptoSymbols = Array.from(
    new Set(visibleSlice.filter((item) => item.type === "crypto").map((item) => item.symbol)),
  );

  const {
    quotes: liveQuotes,
    isFetching: isLiveFetching,
    lastUpdated: liveUpdated,
    isDelayed,
    refresh: refreshLive,
  } = useFinnhubQuotes({
    symbols: liveEquitySymbols,
    cryptoSymbols: liveCryptoSymbols,
    intervalMs: 15000,
  });

  // Market Cap / Volume come from Finnhub fundamentals (cached for hours).
  const [fundamentals, setFundamentals] = useState<Record<string, { marketCap: number | null; volume: number | null }>>({});
  const fundamentalsRef = useRef<Record<string, { marketCap: number | null; volume: number | null }>>({});
  const equityKey = liveEquitySymbols.join(",");

  useEffect(() => {
    const wanted = equityKey ? equityKey.split(",").filter((s) => !fundamentalsRef.current[s]) : [];
    if (wanted.length === 0) return;
    let cancelled = false;

    (async () => {
      try {
        const { data } = await supabase.functions.invoke("finnhub", {
          body: { action: "metrics", symbols: wanted.slice(0, 40) },
        });
        if (cancelled || !Array.isArray(data?.data)) return;
        const next = { ...fundamentalsRef.current };
        data.data.forEach((row: any) => {
          if (row?.symbol) next[row.symbol] = { marketCap: row.marketCap ?? null, volume: row.volume ?? null };
        });
        fundamentalsRef.current = next;
        setFundamentals(next);
      } catch (err) {
        console.error("metrics fetch failed", err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [equityKey]);

  const withLiveQuote = (item: MarketData): MarketData => {
    const quote = liveQuotes[item.symbol];
    const meta = fundamentals[item.symbol];
    if (!quote) {
      return { ...item, marketCap: meta?.marketCap ?? null, volumeShares: meta?.volume ?? null };
    }
    return {
      ...item,
      price: formatPrice(quote.c),
      change: quote.d,
      changePercent: quote.dp,
      dayHigh: quote.h ?? null,
      dayLow: quote.l ?? null,
      delayed: quote.delayed,
      tick: quote.tick,
      marketCap: meta?.marketCap ?? null,
      volumeShares: meta?.volume ?? null,
      sparkline: item.sparkline,
    };
  };

  const displayData = baseDisplayData.map(withLiveQuote);
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

  const filteredSuggestions = debouncedQuery.trim()
    ? (() => {
        const query = debouncedQuery.toLowerCase().trim();

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
  const { results: remoteSuggestions } = useSymbolSearch(debouncedQuery, 1, 250);

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
      <div className="fixed inset-0 pointer-events-none opacity-[0.16]" style={{ filter: "brightness(1.2) saturate(0.3) contrast(0.9)", backgroundImage: `url(${financeBg})`, backgroundSize: 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat' }} />
      <div className="fixed inset-0 pointer-events-none bg-background/90" />

      <Header />
      
      <main
        data-scene="analytics"
        className="relative mx-auto w-full max-w-[1280px] py-8"
        style={{ paddingInline: "clamp(1.5rem, 4vw, 3rem)" }}
      >
        {/* Editorial header + search */}
        <section className="relative z-20 mb-10 overflow-visible">
          <p className="font-mono text-[0.65rem] uppercase tracking-[0.2em] text-primary">
            — Markets · Real-Time
          </p>
          <h1 className="mt-3 font-display text-[2.6rem] font-medium italic leading-[1.05] text-foreground">
            Search the entire market.
          </h1>
          <p className="mt-2 font-sans text-[0.88rem] text-muted-foreground">
            Live data across stocks, ETFs, mutual funds, and crypto.
          </p>

          {/* Main Search Bar */}
          <div className="relative mt-6 w-full">
            <Search className="pointer-events-none absolute left-5 top-1/2 z-10 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              ref={searchInputRef}
              placeholder="Search any stock, ETF, or crypto (e.g., AAPL, TSLA, BTC)..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setShowSuggestions(true);
                setActiveSuggestion(-1);
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
              className="markets-search-input h-[52px] rounded-full border-foreground/[0.12] bg-foreground/[0.05] pl-12 pr-36 font-sans text-[0.9rem] text-foreground placeholder:text-muted-foreground focus-visible:ring-0 focus-visible:ring-offset-0"
            />
            {searchQuery && (
              <button
                onClick={clearSearch}
                className="absolute right-[7.5rem] top-1/2 z-10 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={() => handleSearch()}
              disabled={isSearching || !searchQuery.trim()}
              className="absolute right-1.5 top-1/2 z-10 flex h-[40px] -translate-y-1/2 items-center gap-2 rounded-full bg-primary px-5 font-mono text-[0.7rem] uppercase tracking-[0.16em] text-primary-foreground shadow-none transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              {isSearching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
              Search
            </button>

            <SearchSuggestions
              suggestions={mergedSuggestions}
              onSelect={(asset) => handleQuickSearch(asset.symbol)}
              visible={showSuggestions && searchQuery.length > 0}
              query={searchQuery}
              activeIndex={activeSuggestion}
            />
          </div>

          {/* Popular Searches */}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="mr-1 font-mono text-[0.62rem] uppercase tracking-[0.18em] text-primary">
              Popular
            </span>
            {popularSearches.map((item) => (
              <button
                key={item.symbol}
                onClick={() => handleQuickSearch(item.symbol)}
                className="rounded-full border border-foreground/[0.15] bg-transparent px-[0.9rem] py-[0.3rem] font-mono text-[0.72rem] text-foreground transition-colors duration-200 hover:border-primary hover:text-primary"
              >
                {item.symbol}
              </button>
            ))}
          </div>
        </section>


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

        {/* Index chips */}
        {searchResults.length === 0 && <IndicesBar />}

        {/* Sector heat map */}
        {searchResults.length === 0 && (
          <SectorHeatMap
            sectors={sectorProxies.map((sector) => {
              const quote = liveQuotes[sector.symbol];
              const cached = priceCache[sector.symbol];
              const changePercent = quote ? quote.dp : safeNumber(cached?.changePercent, 0);
              return {
                symbol: sector.symbol,
                name: sector.name,
                weight: sector.weight,
                changePercent,
                hasPrice: !!quote || (!!cached && cached.price !== "—"),
              };
            })}
            onSelect={(symbol) => navigate(`/stock/${symbol}`)}
          />
        )}

        {/* Asset category tabs */}
        {searchResults.length === 0 && (
          <div className="mb-6 flex flex-wrap items-center gap-1 border-b border-border/25">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "relative px-4 py-3 font-mono text-[11px] uppercase tracking-[0.2em] transition-colors duration-300",
                    isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground/80",
                  )}
                >
                  {tab.label}
                  <span
                    className={cn(
                      "absolute inset-x-2 -bottom-px h-px transition-all duration-300",
                      isActive ? "bg-primary opacity-100" : "opacity-0",
                    )}
                  />
                </button>
              );
            })}
          </div>
        )}

        {/* Section header */}
        {searchResults.length === 0 && (
          <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="font-display text-[2.2rem] font-medium italic leading-none tracking-tight text-foreground">
                {activeTab === "all" ? "All Markets" :
                 activeTab === "stocks" ? "Stocks" :
                 activeTab === "etf" ? "ETFs" :
                 activeTab === "crypto" ? "Crypto" :
                 activeTab === "sectors" ? "Market Sectors" :
                 "Mutual Funds"}
              </h2>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                  Updated {clock} ET
                </span>
                <span className="flex items-center gap-1.5 rounded-full border border-border/30 bg-background/40 px-2.5 py-1">
                  <span className={cn("h-1.5 w-1.5 rounded-full", isMarketOpen ? "bg-success" : "bg-muted-foreground")} />
                  <span className="font-mono text-[9px] uppercase tracking-[0.22em] text-muted-foreground">
                    {isMarketOpen ? "Market Open" : "Market Closed"}
                  </span>
                </span>
                {isDelayed && (
                  <span className="font-mono text-[9px] uppercase tracking-[0.22em] text-primary/80">Delayed data</span>
                )}
              </div>
            </div>
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="group flex items-center gap-2 rounded-full border border-border/30 bg-background/40 px-4 py-2 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
            >
              <RefreshCw
                className={cn(
                  "h-3.5 w-3.5 transition-transform duration-500 group-hover:text-primary",
                  (isRefreshing || isLiveFetching) && "animate-spin",
                )}
              />
              Refresh
            </button>
          </div>
        )}

        {/* Sectors Grid */}
        {searchResults.length === 0 && activeTab === "sectors" && (() => {
          const sectorData = sectorProxies.map((sec) => {
            const cached = priceCache[sec.symbol];
            return {
              ...sec,
              price: cached?.price ?? "—",
              changePercent: safeNumber(cached?.changePercent, 0),
              change: safeNumber(cached?.change, 0),
              sparkline: cached?.sparkline,
              hasPrice: !!cached && cached.price !== "—",
            };
          });
          const sorted = [...sectorData].sort((a, b) => b.changePercent - a.changePercent);
          const withPrice = sorted.filter((s) => s.hasPrice);
          const avg = withPrice.length
            ? withPrice.reduce((sum, s) => sum + s.changePercent, 0) / withPrice.length
            : 0;
          const leader = withPrice[0];
          const laggard = withPrice[withPrice.length - 1];

          return (
            <>
              {/* Breadth summary */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
                <div className="rounded-xl bg-background/50 backdrop-blur-sm border border-border/20 p-4">
                  <p className="text-[10px] uppercase tracking-[0.2em] font-medium text-muted-foreground mb-1">Sector Average</p>
                  <p className={cn("text-2xl font-semibold font-mono", avg >= 0 ? "text-success" : "text-destructive")}>
                    {avg >= 0 ? "+" : ""}{avg.toFixed(2)}%
                  </p>
                </div>
                <div className="rounded-xl bg-background/50 backdrop-blur-sm border border-border/20 p-4">
                  <p className="text-[10px] uppercase tracking-[0.2em] font-medium text-muted-foreground mb-1">Leading Sector</p>
                  <p className="text-lg font-semibold text-foreground truncate">
                    {leader ? leader.name : "—"}
                    {leader && <span className="ml-2 text-success font-mono text-sm">+{leader.changePercent.toFixed(2)}%</span>}
                  </p>
                </div>
                <div className="rounded-xl bg-background/50 backdrop-blur-sm border border-border/20 p-4">
                  <p className="text-[10px] uppercase tracking-[0.2em] font-medium text-muted-foreground mb-1">Lagging Sector</p>
                  <p className="text-lg font-semibold text-foreground truncate">
                    {laggard ? laggard.name : "—"}
                    {laggard && (
                      <span className={cn("ml-2 font-mono text-sm", laggard.changePercent >= 0 ? "text-success" : "text-destructive")}>
                        {laggard.changePercent >= 0 ? "+" : ""}{laggard.changePercent.toFixed(2)}%
                      </span>
                    )}
                  </p>
                </div>
              </div>

              {/* Sector cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {sorted.map((sec) => {
                  const isPositive = sec.changePercent >= 0;
                  const intensity = Math.min(Math.abs(sec.changePercent) / 3, 1); // scale 0-1 (3% = full)
                  return (
                    <button
                      key={sec.symbol}
                      onClick={() => navigate(`/stock/${sec.symbol}`)}
                      className={cn(
                        "text-left rounded-xl border border-border/30 bg-background/50 backdrop-blur-sm p-5 transition-all duration-300 hover:border-primary/40 hover:-translate-y-0.5 hover:shadow-lg",
                        "group relative overflow-hidden"
                      )}
                      style={{
                        boxShadow: sec.hasPrice
                          ? `inset 3px 0 0 0 ${isPositive ? "hsl(var(--success))" : "hsl(var(--destructive))"}`
                          : undefined,
                      }}
                    >
                      <div
                        aria-hidden
                        className="absolute inset-0 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity"
                        style={{
                          background: `radial-gradient(600px circle at 0% 0%, ${isPositive ? "hsl(var(--success) / 0.08)" : "hsl(var(--destructive) / 0.08)"}, transparent 40%)`,
                        }}
                      />
                      <div className="flex items-start justify-between mb-3 relative">
                        <div>
                          <p className="text-[10px] uppercase tracking-[0.2em] font-medium text-muted-foreground">{sec.symbol}</p>
                          <h3 className="text-base font-semibold text-foreground leading-tight">{sec.name}</h3>
                        </div>
                        {sec.hasPrice ? (
                          <div
                            className={cn(
                              "inline-flex items-center gap-1 px-2 py-1 rounded-md text-sm font-mono font-semibold",
                              isPositive ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"
                            )}
                            style={{ opacity: 0.7 + intensity * 0.3 }}
                          >
                            {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                            {isPositive ? "+" : ""}{sec.changePercent.toFixed(2)}%
                          </div>
                        ) : (
                          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mb-3">{sec.description}</p>
                      <div className="h-10 -mx-1">
                        <SparklineChart
                          data={sec.sparkline && sec.sparkline.length ? sec.sparkline : generateSparkline(sec.symbol, sec.changePercent)}
                          positive={isPositive}
                        />
                      </div>
                      <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/30">
                        <span className="text-xs text-muted-foreground">Proxy · {sec.symbol}</span>
                        <span className="text-sm font-mono text-foreground">{sec.hasPrice ? `$${sec.price}` : "—"}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </>
          );
        })()}

        {/* Market Table */}
        {(searchResults.length > 0 || activeTab !== "sectors") && (
        <div className="rounded-2xl bg-background/50 backdrop-blur-sm border border-border/20 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border/30">
                  <th className="p-4 text-left font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">#</th>
                  <th className="p-4 text-left font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Asset</th>
                  <th className="p-4 text-right font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Price</th>
                  <th className="p-4 text-right font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Change</th>
                  <th className="hidden p-4 text-right font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground lg:table-cell">Market Cap</th>
                  <th className="hidden p-4 text-right font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground lg:table-cell">Volume</th>
                  <th className="hidden p-4 text-right font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground md:table-cell">Day Range</th>
                  <th className="w-32 p-4 text-right font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground md:w-40">Chart</th>
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
                      <td className="hidden p-4 text-right lg:table-cell"><div className="h-5 bg-muted rounded w-16 ml-auto" /></td>
                      <td className="hidden p-4 text-right lg:table-cell"><div className="h-5 bg-muted rounded w-14 ml-auto" /></td>
                      <td className="hidden p-4 text-right md:table-cell"><div className="h-5 bg-muted rounded w-20 ml-auto" /></td>
                      <td className="p-4 text-right"><div className="h-12 bg-muted rounded w-24 md:w-32 ml-auto" /></td>
                    </tr>
                  ))
                ) : displayData.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-12 text-center">
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
                        className="group cursor-pointer border-b border-border/25 shadow-[inset_3px_0_0_0_transparent] transition-all duration-300 hover:bg-foreground/[0.035] hover:shadow-[inset_3px_0_0_0_hsl(var(--primary))]"
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
                            <div className="min-w-0">
                              <p className="font-mono text-[1rem] uppercase leading-tight text-primary">{item.symbol}</p>
                              <p className="truncate text-[0.82rem] text-muted-foreground">{item.name}</p>
                            </div>
                          </div>
                        </td>
                        <td className="p-4 text-right">
                          {isLoadingThis ? (
                            <Loader2 className="w-4 h-4 animate-spin ml-auto text-muted-foreground" />
                          ) : hasPrice ? (
                            <div className="flex items-center justify-end gap-2">
                              <p className="font-display text-[1.2rem] font-medium leading-none text-foreground tabular-nums">
                                ${item.price}
                              </p>
                              {item.delayed && (
                                <span className="font-mono text-[8px] uppercase tracking-[0.18em] text-muted-foreground">delayed</span>
                              )}
                            </div>
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
                              "inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-mono text-xs font-semibold tabular-nums",
                              isPositive ? "bg-success/[0.08] text-success" : "bg-destructive/[0.08] text-destructive"
                            )}>
                              {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                              {isPositive ? "+" : ""}{safeNumber(item.changePercent).toFixed(2)}%
                            </div>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="hidden p-4 text-right font-mono text-xs text-muted-foreground tabular-nums lg:table-cell">
                          {compact(item.marketCap)}
                        </td>
                        <td className="hidden p-4 text-right font-mono text-xs text-muted-foreground tabular-nums lg:table-cell">
                          {compact(item.volumeShares)}
                        </td>
                        <td className="hidden p-4 text-right font-mono text-xs text-muted-foreground tabular-nums md:table-cell">
                          {item.dayLow && item.dayHigh
                            ? `${formatPrice(item.dayLow)} – ${formatPrice(item.dayHigh)}`
                            : "—"}
                        </td>
                        <td className="w-32 p-4 text-right md:w-40">
                          <div className="ml-auto h-12 w-24 md:w-32">
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
        )}

        {(searchResults.length > 0 || activeTab !== "sectors") && visibleRows < displayData.length && (
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
            Browse the top 100 US stocks by market cap, popular ETFs, mutual funds, and how the eleven S&P 500 sectors are moving today.
            Prices update automatically when you switch tabs. Use the search bar to find any publicly traded asset.
            Real-time quotes, fundamentals and crypto pricing are provided by Finnhub, refreshed every 15 seconds. Sector moves are tracked via SPDR sector ETFs.
          </p>
        </div>

        {/* Live indicator */}
        <div className="flex items-center justify-center gap-2 mt-6">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-success"></span>
          </span>
          <span className="text-sm text-muted-foreground">Live data • Auto-updates every 15s</span>
        </div>
      </main>
    </div>
  );
};

export default Markets;
