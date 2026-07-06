import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, TrendingUp, TrendingDown, RefreshCw, Loader2, ExternalLink, Eye } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/Header";
import { useToast } from "@/hooks/use-toast";
import { ForecastChart, type ForecastData } from "@/components/ForecastChart";
import {
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Area,
  ComposedChart,
  CartesianGrid,
  ReferenceLine,
  Line,
} from "recharts";

interface StockData {
  symbol: string;
  name: string;
  price: string;
  change: number;
  changePercent: number;
  volume: string;
  type: "stock" | "crypto" | "etf" | "mutual_fund";
  high?: string;
  low?: string;
  open?: string;
  previousClose?: string;
  marketCap?: string;
}

interface StockDetails {
  week52High: number;
  week52Low: number;
  marketCap: number;
  peRatio: number;
  eps: number;
  dividend: number;
  avgVolume: number;
}

interface StockAnalysis {
  recommendation: "STRONG BUY" | "BUY" | "HOLD" | "SELL" | "STRONG SELL";
  confidence: "HIGH" | "MEDIUM" | "LOW";
  reasoning: string;
  priceTarget: number;
  riskLevel: "LOW" | "MEDIUM" | "HIGH";
  thesis?: string;
  businessOverview?: string;
  fundamentals?: string;
  technicals?: string;
  bullCase?: string[];
  bearCase?: string[];
  catalysts?: string[];
  bullTarget?: number;
  bearTarget?: number;
  priceTargetRationale?: string;
}

const isBuyRecommendation = (recommendation: StockAnalysis["recommendation"]) =>
  recommendation === "BUY" || recommendation === "STRONG BUY";

const isSellRecommendation = (recommendation: StockAnalysis["recommendation"]) =>
  recommendation === "SELL" || recommendation === "STRONG SELL";

interface HistoricalDataPoint {
  date: string;
  price: number;
  open: number;
  high: number;
  low: number;
  volume: number;
  displayDate: string;
}

const timeRanges = [
  { id: "1D", label: "1D", days: 1 },
  { id: "1W", label: "1W", days: 7 },
  { id: "1M", label: "1M", days: 30 },
  { id: "3M", label: "3M", days: 90 },
  { id: "6M", label: "6M", days: 180 },
  { id: "1Y", label: "1Y", days: 365 },
  { id: "5Y", label: "5Y", days: 1825 },
  { id: "ALL", label: "All", days: 0 },
];

const Stock = () => {
  const { symbol } = useParams<{ symbol: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [stockData, setStockData] = useState<StockData | null>(null);
  const [stockDetails, setStockDetails] = useState<StockDetails | null>(null);
  const [stockAnalysis, setStockAnalysis] = useState<StockAnalysis | null>(null);
  const [historicalData, setHistoricalData] = useState<HistoricalDataPoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingChart, setIsLoadingChart] = useState(true);
  const [isLoadingAnalysis, setIsLoadingAnalysis] = useState(false);
  const [activeRange, setActiveRange] = useState("1M");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [insiderView, setInsiderView] = useState(false);
  const [forecast, setForecast] = useState<ForecastData | null>(null);
  const [isLoadingForecast, setIsLoadingForecast] = useState(false);

  // Fallback stock names
  const stockNames: Record<string, string> = {
    AAPL: "Apple Inc.", MSFT: "Microsoft Corp.", GOOGL: "Alphabet Inc.", AMZN: "Amazon.com Inc.",
    NVDA: "NVIDIA Corp.", META: "Meta Platforms", TSLA: "Tesla Inc.", V: "Visa Inc.",
    JPM: "JPMorgan Chase", WMT: "Walmart Inc.", SPY: "SPDR S&P 500 ETF", QQQ: "Invesco QQQ Trust",
    BTC: "Bitcoin", ETH: "Ethereum", SOL: "Solana",
  };

  const fetchStockData = useCallback(async () => {
    if (!symbol) return;
    
    try {
      const { data, error } = await supabase.functions.invoke("market-data", {
        body: { symbols: [symbol.toUpperCase()] },
      });

      if (error) throw error;

      if (data?.data?.[0]) {
        setStockData(data.data[0]);
      } else {
        // Use fallback data when API returns no results
        setStockData({
          symbol: symbol.toUpperCase(),
          name: stockNames[symbol.toUpperCase()] || symbol.toUpperCase(),
          price: "—",
          change: 0,
          changePercent: 0,
          volume: "—",
          type: "stock",
        });
      }
    } catch (err) {
      console.error("Error fetching stock data:", err);
      // Use fallback data on error
      setStockData({
        symbol: symbol.toUpperCase(),
        name: stockNames[symbol.toUpperCase()] || symbol.toUpperCase(),
        price: "—",
        change: 0,
        changePercent: 0,
        volume: "—",
        type: "stock",
      });
      toast({
        title: "Limited data",
        description: "Real-time price unavailable. Showing chart data only.",
      });
    } finally {
      setIsLoading(false);
    }
  }, [symbol, toast]);

  const fetchHistoricalData = useCallback(async (range: string) => {
    if (!symbol) return;

    // 5-minute sessionStorage cache keyed by symbol+range. Historical candles
    // barely move intraday and the fetch is by far the slowest part of this page.
    const cacheKey = `hist:${symbol.toUpperCase()}:${range}`;
    try {
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed?.t && Date.now() - parsed.t < 5 * 60 * 1000 && Array.isArray(parsed.data)) {
          setHistoricalData(parsed.data);
          setIsLoadingChart(false);
          return;
        }
      }
    } catch { /* ignore cache errors */ }

    setIsLoadingChart(true);
    try {
      const { data, error } = await supabase.functions.invoke("market-data", {
        body: { 
          historical: true, 
          symbol: symbol.toUpperCase(),
          range 
        },
      });

      if (error) throw error;

      if (data?.data && Array.isArray(data.data) && data.data.length > 0) {
        setHistoricalData(data.data);
        try {
          sessionStorage.setItem(cacheKey, JSON.stringify({ t: Date.now(), data: data.data }));
        } catch { /* quota — ignore */ }
      } else {
        // Generate mock data if API returns empty results
        generateMockHistoricalData(range);
      }
    } catch (err) {
      console.error("Error fetching historical data:", err);
      // Generate mock data if API fails
      generateMockHistoricalData(range);
    } finally {
      setIsLoadingChart(false);
    }
  }, [symbol]);

  const generateMockHistoricalData = (range: string) => {
    const rangeConfig = timeRanges.find(r => r.id === range);
    const days = rangeConfig?.days || 30;
    const actualDays = days === 0 ? 3650 : days;
    
    const basePrice = stockData?.price ? parseFloat(stockData.price) : 150;
    const data: HistoricalDataPoint[] = [];
    
    // Calculate data points based on range for smooth, detailed charts
    let numPoints: number;
    if (actualDays <= 1) {
      numPoints = 78; // 5-min intervals for 6.5hr trading day
    } else if (actualDays <= 7) {
      numPoints = actualDays * 12; // Every 30 min
    } else if (actualDays <= 30) {
      numPoints = actualDays * 2; // Every 12 hours
    } else if (actualDays <= 90) {
      numPoints = actualDays;
    } else if (actualDays <= 365) {
      numPoints = Math.min(365, actualDays);
    } else {
      numPoints = Math.min(500, Math.ceil(actualDays / 7)); // Weekly for long ranges
    }
    
    // Start price calculation - work backwards from current price
    // Deterministic seed per symbol+range so the mock chart is stable across renders
    const seedStr = `${symbol}-${range}`;
    let seed = 0;
    for (let i = 0; i < seedStr.length; i++) seed = (seed * 31 + seedStr.charCodeAt(i)) >>> 0;
    const rand = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };
    const endPrice = basePrice;
    const trendDirection = rand() > 0.4 ? 1 : -1; // Slight bullish bias
    const overallTrendStrength = (rand() * 0.3 + 0.1) * trendDirection;
    const startPrice = endPrice / (1 + overallTrendStrength);
    
    let currentPrice = startPrice;
    
    // Volatility settings based on time range
    const baseVolatility = actualDays <= 1 ? 0.003 : 
                          actualDays <= 7 ? 0.008 : 
                          actualDays <= 30 ? 0.015 : 
                          actualDays <= 90 ? 0.02 : 0.025;
    
    // Generate trend phases for realistic movement
    const numPhases = Math.max(3, Math.floor(numPoints / 20));
    const phases: { trend: number; volatility: number; length: number }[] = [];
    let remainingPoints = numPoints;
    
    for (let i = 0; i < numPhases; i++) {
      const isLastPhase = i === numPhases - 1;
      const phaseLength = isLastPhase ? remainingPoints : Math.floor(remainingPoints / (numPhases - i) * (0.5 + rand()));
      remainingPoints -= phaseLength;
      
      phases.push({
        trend: (rand() - 0.45) * baseVolatility * 3,
        volatility: baseVolatility * (0.5 + rand() * 1.5),
        length: phaseLength
      });
    }
    
    let phaseIndex = 0;
    let pointsInPhase = 0;
    let currentPhase = phases[0];
    
    // Base volume varies by stock price
    const avgVolume = basePrice > 500 ? 500000 : basePrice > 100 ? 2000000 : 5000000;
    
    for (let i = 0; i < numPoints; i++) {
      // Phase management
      if (pointsInPhase >= currentPhase.length && phaseIndex < phases.length - 1) {
        phaseIndex++;
        currentPhase = phases[phaseIndex];
        pointsInPhase = 0;
      }
      pointsInPhase++;
      
      // Calculate date/time
      const date = new Date();
      if (actualDays <= 1) {
        // Intraday: 9:30 AM to 4:00 PM
        const minutesFromStart = Math.floor((i / numPoints) * 390);
        date.setHours(9, 30 + minutesFromStart, 0, 0);
      } else {
        const daysBack = Math.floor((1 - i / numPoints) * actualDays);
        date.setDate(date.getDate() - daysBack);
      }
      
      // Price movement with momentum and mean reversion
      const momentum = i > 0 && data.length > 0 
        ? (currentPrice - data[data.length - 1].price) / currentPrice * 0.3 
        : 0;
      
      const meanReversion = (endPrice - currentPrice) / endPrice * 0.01;
      const randomWalk = (rand() - 0.5) * currentPhase.volatility;
      const trend = currentPhase.trend;
      
      const priceChange = trend + randomWalk + momentum + meanReversion;
      currentPrice = currentPrice * (1 + priceChange);
      currentPrice = Math.max(currentPrice, basePrice * 0.2);
      currentPrice = Math.min(currentPrice, basePrice * 2);
      
      // Generate OHLC data
      const intraVolatility = currentPhase.volatility * 0.5;
      const open = currentPrice * (1 + (rand() - 0.5) * intraVolatility);
      const high = Math.max(currentPrice, open) * (1 + rand() * intraVolatility);
      const low = Math.min(currentPrice, open) * (1 - rand() * intraVolatility);
      
      // Volume with some randomness and spikes
      const volumeMultiplier = rand() > 0.95 ? (2 + rand() * 3) : (0.5 + rand());
      const volume = Math.floor(avgVolume * volumeMultiplier / numPoints * 100);
      
      // Format display date
      let displayDate: string;
      if (actualDays <= 1) {
        displayDate = date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
      } else if (actualDays <= 7) {
        displayDate = date.toLocaleDateString([], { weekday: 'short', hour: 'numeric' });
      } else if (actualDays <= 90) {
        displayDate = date.toLocaleDateString([], { month: 'short', day: 'numeric' });
      } else if (actualDays <= 365) {
        displayDate = date.toLocaleDateString([], { month: 'short', day: 'numeric' });
      } else {
        displayDate = date.toLocaleDateString([], { month: 'short', year: '2-digit' });
      }
      
      data.push({
        date: date.toISOString(),
        price: parseFloat(currentPrice.toFixed(2)),
        open: parseFloat(open.toFixed(2)),
        high: parseFloat(high.toFixed(2)),
        low: parseFloat(low.toFixed(2)),
        volume,
        displayDate,
      });
    }
    
    // Ensure last point matches current price
    if (data.length > 0 && stockData?.price && stockData.price !== "—") {
      const lastPoint = data[data.length - 1];
      lastPoint.price = parseFloat(stockData.price);
      lastPoint.high = Math.max(lastPoint.high, lastPoint.price);
      lastPoint.low = Math.min(lastPoint.low, lastPoint.price);
    }
    
    setHistoricalData(data);
  };

  const fetchStockDetails = useCallback(async () => {
    if (!symbol) return;
    
    try {
      const { data, error } = await supabase.functions.invoke("market-data", {
        body: { details: true, symbol: symbol.toUpperCase() },
      });

      if (error) throw error;
      if (data?.data) {
        setStockDetails(data.data);
      }
    } catch (err) {
      console.error("Error fetching stock details:", err);
    }
  }, [symbol]);

  const fetchStockAnalysis = useCallback(async () => {
    if (!symbol) return;
    
    setIsLoadingAnalysis(true);
    try {
      const { data, error } = await supabase.functions.invoke("stock-analysis", {
        body: {
          symbol: symbol.toUpperCase(),
          // Optional hints — the edge function fetches its own fundamentals,
          // so we send whatever we have without waiting on extra round-trips.
          price: stockData?.price,
          change: stockData?.change,
          changePercent: stockData?.changePercent,
          week52High: stockDetails?.week52High,
          week52Low: stockDetails?.week52Low,
          volume: stockData?.volume,
        },
      });

      if (error) throw error;
      if (data?.data) {
        setStockAnalysis(data.data);
      }
    } catch (err) {
      console.error("Error fetching stock analysis:", err);
      toast({
        title: "Analysis unavailable",
        description: "Could not generate AI analysis at this time.",
        variant: "destructive",
      });
    } finally {
      setIsLoadingAnalysis(false);
    }
  }, [symbol, toast]);

  useEffect(() => {
    // Kick off ALL independent requests in parallel — including the AI analysis,
    // which fetches its own fundamentals server-side and doesn't need to wait
    // for the quote/details round-trips to finish.
    fetchStockData();
    fetchStockDetails();
    fetchHistoricalData(activeRange);
    fetchStockAnalysis();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol]);

  // Re-fetch the chart only when the user changes the range.
  const isInitialRange = useRef(true);
  useEffect(() => {
    if (isInitialRange.current) { isInitialRange.current = false; return; }
    fetchHistoricalData(activeRange);
  }, [activeRange, fetchHistoricalData]);

  useEffect(() => {
    if (!symbol) return;
    let cancelled = false;
    setIsLoadingForecast(true);
    setForecast(null);
    supabase.functions
      .invoke("stock-forecast", { body: { symbol } })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (!error && data?.forecast) setForecast(data.forecast as ForecastData);
      })
      .finally(() => {
        if (!cancelled) setIsLoadingForecast(false);
      });
    return () => { cancelled = true; };
  }, [symbol]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchStockData();
    await fetchHistoricalData(activeRange);
    setIsRefreshing(false);
    toast({
      title: "Data refreshed",
      description: "Stock data has been updated",
    });
  };

  const handleRangeChange = (range: string) => {
    setActiveRange(range);
  };

  const isPositive = stockData ? stockData.change >= 0 : true;
  const chartColor = isPositive ? "hsl(var(--success))" : "hsl(var(--destructive))";

  const priceChange = historicalData.length > 1 
    ? historicalData[historicalData.length - 1].price - historicalData[0].price 
    : 0;
  const priceChangePercent = historicalData.length > 1 
    ? ((priceChange / historicalData[0].price) * 100) 
    : 0;

  // Calculate period stats for reference lines
  const periodHigh = historicalData.length > 0 ? Math.max(...historicalData.map(d => d.high || d.price)) : 0;
  const periodLow = historicalData.length > 0 ? Math.min(...historicalData.map(d => d.low || d.price)) : 0;
  const openingPrice = historicalData.length > 0 ? historicalData[0].price : 0;

  // Calculate moving averages and technical indicators
  const maWindow = activeRange === '1D' ? 10 : activeRange === '1W' ? 5 : activeRange === '1M' ? 7 : 20;
  const emaWindow = Math.floor(maWindow * 1.5);
  const rsiPeriod = 14;
  const bbPeriod = 20;
  const bbStdDev = 2;

  // Calculate RSI
  const calculateRSI = (prices: number[], period: number): (number | null)[] => {
    const rsi: (number | null)[] = [];
    for (let i = 0; i < prices.length; i++) {
      if (i < period) {
        rsi.push(null);
        continue;
      }
      let gains = 0, losses = 0;
      for (let j = i - period + 1; j <= i; j++) {
        const change = prices[j] - prices[j - 1];
        if (change > 0) gains += change;
        else losses -= change;
      }
      const avgGain = gains / period;
      const avgLoss = losses / period;
      const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
      rsi.push(parseFloat((100 - (100 / (1 + rs))).toFixed(1)));
    }
    return rsi;
  };

  // Calculate EMA
  const calculateEMA = (prices: number[], period: number): (number | null)[] => {
    const ema: (number | null)[] = [];
    const multiplier = 2 / (period + 1);
    for (let i = 0; i < prices.length; i++) {
      if (i < period - 1) {
        ema.push(null);
      } else if (i === period - 1) {
        const sum = prices.slice(0, period).reduce((a, b) => a + b, 0);
        ema.push(parseFloat((sum / period).toFixed(2)));
      } else {
        const prevEma = ema[i - 1] as number;
        ema.push(parseFloat((((prices[i] - prevEma) * multiplier) + prevEma).toFixed(2)));
      }
    }
    return ema;
  };

  // Calculate Bollinger Bands
  const calculateBollingerBands = (prices: number[], period: number, stdDev: number) => {
    const bands: { upper: number | null; middle: number | null; lower: number | null }[] = [];
    for (let i = 0; i < prices.length; i++) {
      if (i < period - 1) {
        bands.push({ upper: null, middle: null, lower: null });
      } else {
        const slice = prices.slice(i - period + 1, i + 1);
        const mean = slice.reduce((a, b) => a + b, 0) / period;
        const variance = slice.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / period;
        const std = Math.sqrt(variance);
        bands.push({
          upper: parseFloat((mean + stdDev * std).toFixed(2)),
          middle: parseFloat(mean.toFixed(2)),
          lower: parseFloat((mean - stdDev * std).toFixed(2)),
        });
      }
    }
    return bands;
  };

  // Calculate VWAP
  const calculateVWAP = (data: HistoricalDataPoint[]): (number | null)[] => {
    const vwap: (number | null)[] = [];
    let cumulativeTPV = 0;
    let cumulativeVolume = 0;
    for (let i = 0; i < data.length; i++) {
      const typicalPrice = (data[i].high + data[i].low + data[i].price) / 3;
      cumulativeTPV += typicalPrice * data[i].volume;
      cumulativeVolume += data[i].volume;
      if (cumulativeVolume === 0) {
        vwap.push(null);
      } else {
        vwap.push(parseFloat((cumulativeTPV / cumulativeVolume).toFixed(2)));
      }
    }
    return vwap;
  };

  const prices = historicalData.map(d => d.price);
  const rsiValues = calculateRSI(prices, rsiPeriod);
  const emaValues = calculateEMA(prices, emaWindow);
  const bbValues = calculateBollingerBands(prices, bbPeriod, bbStdDev);
  const vwapValues = calculateVWAP(historicalData);

  // Calculate max volume for scaling
  const maxVolume = Math.max(...historicalData.map(d => d.volume || 0));

  const chartDataWithMA = historicalData.map((point, index) => {
    // Calculate simple moving average
    const start = Math.max(0, index - maWindow + 1);
    const windowData = historicalData.slice(start, index + 1);
    const ma = windowData.reduce((sum, p) => sum + p.price, 0) / windowData.length;
    
    return {
      ...point,
      ma: index >= maWindow - 1 ? parseFloat(ma.toFixed(2)) : null,
      ema: emaValues[index],
      rsi: rsiValues[index],
      bbUpper: bbValues[index].upper,
      bbMiddle: bbValues[index].middle,
      bbLower: bbValues[index].lower,
      vwap: vwapValues[index],
      volumeScaled: maxVolume > 0 ? (point.volume / maxVolume) * 100 : 0,
      highLow: [point.low, point.high],
      bbBand: bbValues[index].upper && bbValues[index].lower ? [bbValues[index].lower, bbValues[index].upper] : null,
    };
  });

  // Current technical indicators
  const latestData = chartDataWithMA[chartDataWithMA.length - 1];
  const currentRSI = latestData?.rsi;
  const currentVWAP = latestData?.vwap;
  const priceVsVWAP = currentVWAP && latestData ? ((latestData.price - currentVWAP) / currentVWAP * 100).toFixed(2) : null;
  const rsiSignal = currentRSI ? (currentRSI > 70 ? 'Overbought' : currentRSI < 30 ? 'Oversold' : 'Neutral') : null;

  // Support and Resistance levels (simple calculation based on recent highs/lows)
  const recentData = historicalData.slice(-Math.min(50, historicalData.length));
  const resistance = Math.max(...recentData.map(d => d.high));
  const support = Math.min(...recentData.map(d => d.low));

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const changeFromOpen = data.price - openingPrice;
      const changePercentFromOpen = openingPrice > 0 ? (changeFromOpen / openingPrice) * 100 : 0;
      const isUp = changeFromOpen >= 0;
      
      return (
        <div className={cn(
          "bg-background/95 backdrop-blur-sm border border-border rounded-xl p-3 shadow-xl",
          insiderView ? "min-w-[340px]" : "min-w-[200px]"
        )}>
          <div className="flex items-center justify-between mb-2">
            <p className="text-muted-foreground text-xs font-medium">{data.displayDate}</p>
            <span className={cn(
              "text-xs font-medium px-1.5 py-0.5 rounded",
              isUp ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"
            )}>
              {isUp ? "+" : ""}{changePercentFromOpen.toFixed(2)}%
            </span>
          </div>
          <p className="text-foreground font-bold text-2xl tracking-tight">${data.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
          
          {/* OHLC Grid */}
          <div className="grid grid-cols-4 gap-2 mt-3 pt-2 border-t border-border/50">
            <div className="text-center">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">Open</p>
              <p className="text-sm font-semibold text-foreground">${data.open?.toFixed(2)}</p>
            </div>
            <div className="text-center">
              <p className="text-[10px] text-success uppercase tracking-wide mb-0.5">High</p>
              <p className="text-sm font-semibold text-success">${data.high?.toFixed(2)}</p>
            </div>
            <div className="text-center">
              <p className="text-[10px] text-destructive uppercase tracking-wide mb-0.5">Low</p>
              <p className="text-sm font-semibold text-destructive">${data.low?.toFixed(2)}</p>
            </div>
            <div className="text-center">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">Vol</p>
              <p className="text-sm font-semibold text-foreground">{data.volume?.toLocaleString()}</p>
            </div>
          </div>
          
          {/* Extended Technical Indicators - Insider View Only */}
          {insiderView && (
            <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-border/30">
              <div className="text-center">
                <p className="text-[10px] text-primary uppercase tracking-wide mb-0.5">SMA {maWindow}</p>
                <p className="text-sm font-semibold text-primary">{data.ma ? `$${data.ma.toFixed(2)}` : '—'}</p>
              </div>
              <div className="text-center">
                <p className="text-[10px] text-amber-500 uppercase tracking-wide mb-0.5">EMA {emaWindow}</p>
                <p className="text-sm font-semibold text-amber-500">{data.ema ? `$${data.ema.toFixed(2)}` : '—'}</p>
              </div>
              <div className="text-center">
                <p className="text-[10px] text-violet-500 uppercase tracking-wide mb-0.5">VWAP</p>
                <p className="text-sm font-semibold text-violet-500">{data.vwap ? `$${data.vwap.toFixed(2)}` : '—'}</p>
              </div>
            </div>
          )}
          
          {/* RSI & Bollinger - Insider View Only */}
          {insiderView && (
            <div className="grid grid-cols-2 gap-3 mt-3 pt-3 border-t border-border/30">
              <div>
                <p className="text-[10px] text-cyan-500 uppercase tracking-wide mb-1.5">RSI ({rsiPeriod})</p>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden">
                    <div 
                      className={cn(
                        "h-full rounded-full transition-all",
                        data.rsi > 70 ? "bg-destructive" : data.rsi < 30 ? "bg-success" : "bg-cyan-500"
                      )}
                      style={{ width: `${data.rsi || 0}%` }}
                    />
                  </div>
                  <span className={cn(
                    "text-sm font-semibold min-w-[24px] text-right",
                    data.rsi > 70 ? "text-destructive" : data.rsi < 30 ? "text-success" : "text-cyan-500"
                  )}>
                    {data.rsi?.toFixed(0) || '—'}
                  </span>
                </div>
              </div>
              <div>
                <p className="text-[10px] text-pink-500 uppercase tracking-wide mb-1.5">Bollinger</p>
                <div className="text-xs space-y-1">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Upper</span>
                    <span className="text-pink-500 font-medium">{data.bbUpper ? `$${data.bbUpper.toFixed(2)}` : '—'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Lower</span>
                    <span className="text-pink-500 font-medium">{data.bbLower ? `$${data.bbLower.toFixed(2)}` : '—'}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {/* Range indicator */}
          <div className="mt-2 pt-2 border-t border-border/30">
            <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
              <span>${data.low?.toFixed(2)}</span>
              <span>Day Range</span>
              <span>${data.high?.toFixed(2)}</span>
            </div>
            <div className="h-1.5 bg-secondary rounded-full relative overflow-hidden">
              <div 
                className="absolute inset-y-0 bg-gradient-to-r from-destructive/60 via-foreground/40 to-success/60 rounded-full"
                style={{
                  left: '0%',
                  right: '0%',
                }}
              />
              {data.high !== data.low && (
                <div 
                  className="absolute top-1/2 -translate-y-1/2 w-2 h-2 bg-foreground rounded-full border border-background shadow-sm"
                  style={{
                    left: `${((data.price - data.low) / (data.high - data.low)) * 100}%`,
                    transform: 'translate(-50%, -50%)',
                  }}
                />
              )}
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center h-96">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        </main>
      </div>
    );
  }

  if (!stockData) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-4 py-8">
          <Button variant="ghost" onClick={() => navigate("/markets")} className="mb-6">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <div className="text-center py-12">
            <h1 className="text-2xl font-bold text-foreground mb-2">Stock Not Found</h1>
            <p className="text-muted-foreground">Unable to find data for {symbol}</p>
            <Button onClick={() => navigate("/markets")} className="mt-4">
              Browse Markets
            </Button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      <Header />

      {/* Ambient company logo backdrop */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0 flex items-center justify-center"
      >
        <img
          src={`https://assets.parqet.com/logos/symbol/${stockData.symbol}`}
          alt=""
          onError={(e) => ((e.currentTarget.style.display = "none"))}
          className="w-[80vmin] h-[80vmin] object-contain opacity-[0.04] blur-2xl select-none"
          draggable={false}
        />
        <div
          className={cn(
            "absolute inset-0",
            isPositive
              ? "bg-[radial-gradient(ellipse_at_center,hsl(var(--success)/0.08),transparent_60%)]"
              : "bg-[radial-gradient(ellipse_at_center,hsl(var(--destructive)/0.07),transparent_60%)]",
          )}
        />
      </div>

      <main className="container mx-auto px-4 py-8 relative z-10">
        {/* Back Button */}
        <Button variant="ghost" onClick={() => navigate("/markets")} className="mb-6">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>

        {/* Stock Header */}
        <div className="glass-card p-6 mb-6">
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className={cn(
                "relative w-16 h-16 rounded-xl flex items-center justify-center font-bold text-xl overflow-hidden ring-1 ring-border/50 shadow-lg",
                stockData.type === "crypto" ? "bg-primary/20 text-primary" :
                stockData.type === "etf" ? "bg-accent/20 text-accent-foreground" :
                "bg-secondary text-foreground"
              )}>
                <span className="absolute inset-0 flex items-center justify-center">
                  {stockData.symbol.slice(0, 2)}
                </span>
                <img
                  src={`https://assets.parqet.com/logos/symbol/${stockData.symbol}`}
                  alt=""
                  onError={(e) => ((e.currentTarget.style.display = "none"))}
                  className="relative w-full h-full object-contain p-2 bg-background/40 backdrop-blur-sm"
                  draggable={false}
                />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-3xl font-bold text-foreground">{stockData.symbol}</h1>
                  <span className={cn(
                    "text-xs px-2 py-1 rounded-full",
                    stockData.type === "crypto" ? "bg-primary/10 text-primary" :
                    stockData.type === "etf" ? "bg-accent/10 text-accent-foreground" :
                    "bg-secondary text-muted-foreground"
                  )}>
                    {stockData.type.toUpperCase()}
                  </span>
                </div>
                <p className="text-muted-foreground">{stockData.name}</p>
              </div>
            </div>
            
            <div className="text-right">
              <p className="text-4xl font-bold text-foreground">${stockData.price}</p>
              <div className={cn(
                "inline-flex items-center gap-1 px-3 py-1 rounded-lg text-sm font-medium mt-2",
                isPositive ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"
              )}>
                {isPositive ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                {isPositive ? "+" : ""}{stockData.change.toFixed(2)} ({isPositive ? "+" : ""}{stockData.changePercent.toFixed(2)}%)
              </div>
            </div>
          </div>
        </div>

        {/* Chart Section */}
        <div className="glass-card p-3 sm:p-4 mb-6">
          {/* Compact Header with Time Range */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">
                    {activeRange === "1D" ? "Today" : 
                     activeRange === "1W" ? "Past week" :
                     activeRange === "1M" ? "Past month" :
                     activeRange === "3M" ? "Past 3 months" :
                     activeRange === "6M" ? "Past 6 months" :
                     activeRange === "1Y" ? "Past year" :
                     activeRange === "5Y" ? "Past 5 years" : "All time"}
                  </span>
                  {historicalData.length > 1 && (
                    <span className={cn(
                      "text-sm font-semibold px-2 py-0.5 rounded",
                      priceChangePercent >= 0 ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"
                    )}>
                      {priceChangePercent >= 0 ? "+" : ""}{priceChangePercent.toFixed(2)}%
                    </span>
                  )}
                </div>
              </div>
            </div>
            
            {/* Insider View Toggle & Time Range Selector */}
            <div className="flex items-center gap-3">
              {/* Insider View Toggle */}
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <Checkbox 
                  id="insider-view"
                  checked={insiderView}
                  onCheckedChange={(checked) => setInsiderView(checked === true)}
                  className="data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                />
                <div className="flex items-center gap-1.5">
                  <Eye className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-xs font-medium text-muted-foreground">Insider View</span>
                </div>
              </label>
              
              <div className="w-px h-6 bg-border/50" />
              
              <div className="flex gap-0.5 p-0.5 bg-secondary/50 rounded-lg">
                {timeRanges.map((range) => (
                  <button
                    key={range.id}
                    onClick={() => handleRangeChange(range.id)}
                    className={cn(
                      "px-2.5 py-1.5 rounded text-xs font-medium transition-all",
                      activeRange === range.id
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {range.label}
                  </button>
                ))}
              </div>
              <Button 
                variant="ghost" 
                size="icon"
                className="h-8 w-8"
                onClick={handleRefresh}
                disabled={isRefreshing}
              >
                <RefreshCw className={cn("w-4 h-4", isRefreshing && "animate-spin")} />
              </Button>
            </div>
          </div>

          {/* Price Stats Bar */}
          <div className="flex items-center gap-4 mb-2 px-1 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-success" />
              <span className="text-muted-foreground">High:</span>
              <span className="text-success font-medium">${periodHigh.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-destructive" />
              <span className="text-muted-foreground">Low:</span>
              <span className="text-destructive font-medium">${periodLow.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-muted-foreground" />
              <span className="text-muted-foreground">Open:</span>
              <span className="text-foreground font-medium">${openingPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
          </div>

          {/* Chart - Maximized */}
          <div className="h-[450px] sm:h-[500px] w-full -mx-1">
            {isLoadingChart ? (
              <div className="h-full flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartDataWithMA} margin={{ top: 10, right: 10, left: -15, bottom: 5 }}>
                  <defs>
                    <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={chartColor} stopOpacity={0.35} />
                      <stop offset="40%" stopColor={chartColor} stopOpacity={0.15} />
                      <stop offset="100%" stopColor={chartColor} stopOpacity={0.02} />
                    </linearGradient>
                    <linearGradient id="highLowGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={chartColor} stopOpacity={0.08} />
                      <stop offset="50%" stopColor={chartColor} stopOpacity={0.04} />
                      <stop offset="100%" stopColor={chartColor} stopOpacity={0.08} />
                    </linearGradient>
                    <linearGradient id="strokeGradient" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor={chartColor} stopOpacity={0.6} />
                      <stop offset="50%" stopColor={chartColor} stopOpacity={1} />
                      <stop offset="100%" stopColor={chartColor} stopOpacity={0.8} />
                    </linearGradient>
                    <linearGradient id="bbGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#ec4899" stopOpacity={0.15} />
                      <stop offset="50%" stopColor="#ec4899" stopOpacity={0.05} />
                      <stop offset="100%" stopColor="#ec4899" stopOpacity={0.15} />
                    </linearGradient>
                    <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
                      <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                      <feMerge>
                        <feMergeNode in="coloredBlur"/>
                        <feMergeNode in="SourceGraphic"/>
                      </feMerge>
                    </filter>
                  </defs>
                  <CartesianGrid 
                    strokeDasharray="1 4" 
                    stroke="hsl(var(--border))" 
                    strokeOpacity={0.3}
                    vertical={false}
                  />
                  <XAxis 
                    dataKey="displayDate" 
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
                    interval="preserveStartEnd"
                    minTickGap={80}
                    dy={8}
                  />
                  <YAxis 
                    domain={['auto', 'auto']}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
                    tickFormatter={(value) => `$${value.toLocaleString()}`}
                    width={65}
                    tickCount={8}
                  />
                  {/* Opening price reference line - Insider View only */}
                  {insiderView && (
                    <ReferenceLine 
                      y={openingPrice} 
                      stroke="hsl(var(--muted-foreground))" 
                      strokeDasharray="6 4"
                      strokeOpacity={0.4}
                      strokeWidth={1}
                    />
                  )}
                  {/* Support level - Insider View only */}
                  {insiderView && support > 0 && (
                    <ReferenceLine 
                      y={support} 
                      stroke="#22c55e"
                      strokeDasharray="8 4"
                      strokeOpacity={0.5}
                      strokeWidth={1}
                      label={{ value: 'Support', fill: '#22c55e', fontSize: 9, position: 'insideTopRight' }}
                    />
                  )}
                  {/* Resistance level - Insider View only */}
                  {insiderView && resistance > 0 && (
                    <ReferenceLine 
                      y={resistance} 
                      stroke="#ef4444"
                      strokeDasharray="8 4"
                      strokeOpacity={0.5}
                      strokeWidth={1}
                      label={{ value: 'Resistance', fill: '#ef4444', fontSize: 9, position: 'insideBottomRight' }}
                    />
                  )}
                  {/* Current price line - Insider View only */}
                  {insiderView && historicalData.length > 0 && (
                    <ReferenceLine 
                      y={historicalData[historicalData.length - 1].price} 
                      stroke={chartColor}
                      strokeWidth={1}
                      strokeOpacity={0.6}
                    />
                  )}
                  <Tooltip 
                    content={<CustomTooltip />} 
                    cursor={{ 
                      stroke: 'hsl(var(--foreground))', 
                      strokeWidth: 1, 
                      strokeOpacity: 0.15
                    }}
                  />
                  {/* Bollinger Bands - Insider View only */}
                  {insiderView && (
                    <Area
                      type="monotone"
                      dataKey="bbBand"
                      stroke="none"
                      fill="url(#bbGradient)"
                      dot={false}
                      activeDot={false}
                      animationDuration={600}
                    />
                  )}
                  {/* High-Low range band - Insider View only */}
                  {insiderView && (
                    <Area
                      type="monotone"
                      dataKey="highLow"
                      stroke="none"
                      fill="url(#highLowGradient)"
                      dot={false}
                      activeDot={false}
                      animationDuration={600}
                    />
                  )}
                  {/* Main price line with gradient fill */}
                  <Area
                    type="monotone"
                    dataKey="price"
                    stroke="url(#strokeGradient)"
                    strokeWidth={2.5}
                    fill="url(#colorPrice)"
                    dot={false}
                    activeDot={{ 
                      r: 6, 
                      fill: chartColor, 
                      stroke: 'hsl(var(--background))', 
                      strokeWidth: 3,
                      filter: 'url(#glow)'
                    }}
                    animationDuration={600}
                    animationEasing="ease-out"
                  />
                  {/* Moving Average (SMA) line - Insider View only */}
                  {insiderView && (
                    <Line
                      type="monotone"
                      dataKey="ma"
                      stroke="hsl(var(--primary))"
                      strokeWidth={1.5}
                      strokeDasharray="4 2"
                      strokeOpacity={0.7}
                      dot={false}
                      activeDot={{ r: 3, fill: 'hsl(var(--primary))' }}
                      animationDuration={800}
                      connectNulls={false}
                    />
                  )}
                  {/* EMA line - Insider View only */}
                  {insiderView && (
                    <Line
                      type="monotone"
                      dataKey="ema"
                      stroke="#f59e0b"
                      strokeWidth={1.5}
                      strokeOpacity={0.7}
                      dot={false}
                      activeDot={{ r: 3, fill: '#f59e0b' }}
                      animationDuration={800}
                      connectNulls={false}
                    />
                  )}
                  {/* VWAP line - Insider View only */}
                  {insiderView && (
                    <Line
                      type="monotone"
                      dataKey="vwap"
                      stroke="#8b5cf6"
                      strokeWidth={1.5}
                      strokeOpacity={0.6}
                      dot={false}
                      activeDot={{ r: 3, fill: '#8b5cf6' }}
                      animationDuration={800}
                      connectNulls={false}
                    />
                  )}
                  {/* Bollinger Upper Band - Insider View only */}
                  {insiderView && (
                    <Line
                      type="monotone"
                      dataKey="bbUpper"
                      stroke="#ec4899"
                      strokeWidth={1}
                      strokeOpacity={0.5}
                      strokeDasharray="3 3"
                      dot={false}
                      activeDot={false}
                      connectNulls={false}
                    />
                  )}
                  {/* Bollinger Lower Band - Insider View only */}
                  {insiderView && (
                    <Line
                      type="monotone"
                      dataKey="bbLower"
                      stroke="#ec4899"
                      strokeWidth={1}
                      strokeOpacity={0.5}
                      strokeDasharray="3 3"
                      dot={false}
                      activeDot={false}
                      connectNulls={false}
                    />
                  )}
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </div>
          
          {/* Chart Legend - Full legend only in Insider View */}
          {insiderView && (
            <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 mt-3 pt-2 border-t border-border/20">
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-0.5 rounded" style={{ background: chartColor }} />
                <span className="text-xs text-muted-foreground">Price</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-0.5 rounded bg-primary" style={{ opacity: 0.7 }} />
                <span className="text-xs text-muted-foreground">SMA {maWindow}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-0.5 rounded bg-amber-500" />
                <span className="text-xs text-muted-foreground">EMA {emaWindow}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-0.5 rounded bg-violet-500" />
                <span className="text-xs text-muted-foreground">VWAP</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-0.5 rounded bg-pink-500" style={{ opacity: 0.5 }} />
                <span className="text-xs text-muted-foreground">Bollinger</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded opacity-15 bg-pink-500" />
                <span className="text-xs text-muted-foreground">BB Band</span>
              </div>
            </div>
          )}
          
          {/* Technical Indicators Panel - Insider View only */}
          {insiderView && latestData && (
            <div className="mt-4 pt-4 border-t border-border/30">
              <h4 className="text-base font-semibold text-foreground mb-4">Technical Indicators</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {/* RSI */}
                <div className="bg-secondary/30 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-muted-foreground">RSI ({rsiPeriod})</span>
                    <span className={cn(
                      "text-xs px-2 py-0.5 rounded font-semibold",
                      currentRSI && currentRSI > 70 ? "bg-destructive/10 text-destructive" :
                      currentRSI && currentRSI < 30 ? "bg-success/10 text-success" :
                      "bg-secondary text-muted-foreground"
                    )}>
                      {rsiSignal}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden">
                      <div 
                        className={cn(
                          "h-full rounded-full transition-all",
                          currentRSI && currentRSI > 70 ? "bg-destructive" :
                          currentRSI && currentRSI < 30 ? "bg-success" :
                          "bg-cyan-500"
                        )}
                        style={{ width: `${currentRSI || 0}%` }}
                      />
                    </div>
                    <span className="text-base font-bold text-foreground min-w-[36px] text-right">{currentRSI?.toFixed(0) || '—'}</span>
                  </div>
                  <div className="flex justify-between text-[10px] text-muted-foreground mt-1.5">
                    <span>30</span>
                    <span>70</span>
                  </div>
                </div>
                
                {/* VWAP vs Price */}
                <div className="bg-secondary/30 rounded-lg p-4">
                  <span className="text-sm font-medium text-muted-foreground">VWAP Position</span>
                  <div className="mt-2">
                    <div className="text-xl font-bold text-foreground">${currentVWAP?.toFixed(2) || '—'}</div>
                    <div className={cn(
                      "text-xs font-semibold mt-1.5",
                      priceVsVWAP && parseFloat(priceVsVWAP) > 0 ? "text-success" : "text-destructive"
                    )}>
                      {priceVsVWAP ? `${parseFloat(priceVsVWAP) > 0 ? '+' : ''}${priceVsVWAP}% vs price` : '—'}
                    </div>
                  </div>
                </div>
                
                {/* Support Level */}
                <div className="bg-secondary/30 rounded-lg p-4">
                  <span className="text-sm font-medium text-muted-foreground">Support Level</span>
                  <div className="mt-2">
                    <div className="text-xl font-bold text-success">${support.toFixed(2)}</div>
                    <div className="text-xs text-muted-foreground mt-1.5">
                      {latestData.price > support ? `${((latestData.price - support) / support * 100).toFixed(1)}% above` : 'At support'}
                    </div>
                  </div>
                </div>
                
                {/* Resistance Level */}
                <div className="bg-secondary/30 rounded-lg p-4">
                  <span className="text-sm font-medium text-muted-foreground">Resistance Level</span>
                  <div className="mt-2">
                    <div className="text-xl font-bold text-destructive">${resistance.toFixed(2)}</div>
                    <div className="text-xs text-muted-foreground mt-1.5">
                      {latestData.price < resistance ? `${((resistance - latestData.price) / latestData.price * 100).toFixed(1)}% below` : 'At resistance'}
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Moving Averages Summary */}
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-secondary/20 rounded-lg p-3 text-center">
                  <span className="text-[11px] font-medium text-primary uppercase tracking-wide">SMA {maWindow}</span>
                  <div className="text-base font-semibold text-foreground mt-1">${latestData.ma?.toFixed(2) || '—'}</div>
                  {latestData.ma && (
                    <span className={cn("text-xs font-medium", latestData.price > latestData.ma ? "text-success" : "text-destructive")}>
                      {latestData.price > latestData.ma ? 'Above' : 'Below'}
                    </span>
                  )}
                </div>
                <div className="bg-secondary/20 rounded-lg p-3 text-center">
                  <span className="text-[11px] font-medium text-amber-500 uppercase tracking-wide">EMA {emaWindow}</span>
                  <div className="text-base font-semibold text-foreground mt-1">${latestData.ema?.toFixed(2) || '—'}</div>
                  {latestData.ema && (
                    <span className={cn("text-xs font-medium", latestData.price > latestData.ema ? "text-success" : "text-destructive")}>
                      {latestData.price > latestData.ema ? 'Above' : 'Below'}
                    </span>
                  )}
                </div>
                <div className="bg-secondary/20 rounded-lg p-3 text-center">
                  <span className="text-[11px] font-medium text-pink-500 uppercase tracking-wide">BB Width</span>
                  <div className="text-base font-semibold text-foreground mt-1">
                    {latestData.bbUpper && latestData.bbLower ? `$${(latestData.bbUpper - latestData.bbLower).toFixed(2)}` : '—'}
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {latestData.bbUpper && latestData.bbLower ? `${((latestData.bbUpper - latestData.bbLower) / latestData.price * 100).toFixed(1)}%` : ''}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Stock Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="glass-card p-4">
            <p className="text-sm text-muted-foreground mb-1">Day Change</p>
            <p className={cn(
              "text-lg font-semibold",
              isPositive ? "text-success" : "text-destructive"
            )}>
              {isPositive ? "+" : ""}{stockData.changePercent.toFixed(2)}%
            </p>
          </div>
          <div className="glass-card p-4">
            <p className="text-sm text-muted-foreground mb-1">52-Week High</p>
            <p className="text-lg font-semibold text-success">
              {stockDetails?.week52High ? `$${stockDetails.week52High.toFixed(2)}` : "—"}
            </p>
          </div>
          <div className="glass-card p-4">
            <p className="text-sm text-muted-foreground mb-1">52-Week Low</p>
            <p className="text-lg font-semibold text-destructive">
              {stockDetails?.week52Low ? `$${stockDetails.week52Low.toFixed(2)}` : "—"}
            </p>
          </div>
        </div>

        {/* 52-Week Range Visual */}
        {stockDetails && stockData.price !== "—" && (
          <div className="glass-card p-6 mb-6">
            <h3 className="text-lg font-semibold text-foreground mb-4">52-Week Range</h3>
            <div className="relative">
              <div className="flex justify-between text-sm text-muted-foreground mb-2">
                <span>${stockDetails.week52Low.toFixed(2)}</span>
                <span>${stockDetails.week52High.toFixed(2)}</span>
              </div>
              <div className="h-2 bg-secondary rounded-full relative">
                {(() => {
                  const price = parseFloat(stockData.price);
                  const range = stockDetails.week52High - stockDetails.week52Low;
                  const position = range > 0 ? ((price - stockDetails.week52Low) / range) * 100 : 50;
                  return (
                    <div 
                      className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-primary rounded-full border-2 border-background shadow-lg"
                      style={{ left: `calc(${Math.min(Math.max(position, 0), 100)}% - 8px)` }}
                    />
                  );
                })()}
              </div>
              <p className="text-center text-sm text-muted-foreground mt-2">
                Current: <span className="text-foreground font-medium">${stockData.price}</span>
              </p>
            </div>
          </div>
        )}

        {/* 12-Month Forecast */}
        {(isLoadingForecast || forecast) && (
          <div className="glass-card p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-foreground">12-Month Performance Forecast</h3>
              {forecast?.indicators.numAnalysts ? (
                <span className="text-xs text-muted-foreground">
                  Based on {forecast.indicators.numAnalysts} analysts + 5Y price history
                </span>
              ) : null}
            </div>
            {isLoadingForecast && !forecast ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-primary mr-2" />
                <span className="text-muted-foreground">Building forecast...</span>
              </div>
            ) : forecast ? (
              <ForecastChart forecast={forecast} />
            ) : null}
          </div>
        )}

        {/* Our Recommendation */}
        <div className="glass-card p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-foreground">Our Recommendation</h3>
          </div>
          {isLoadingAnalysis ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-primary mr-2" />
              <span className="text-muted-foreground">Analyzing {stockData.symbol}...</span>
            </div>
          ) : stockAnalysis ? (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <div className={cn(
                  "inline-flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-lg",
                  isBuyRecommendation(stockAnalysis.recommendation) && "bg-success/20 text-success",
                  stockAnalysis.recommendation === "HOLD" && "bg-warning/20 text-warning",
                  isSellRecommendation(stockAnalysis.recommendation) && "bg-destructive/20 text-destructive"
                )}>
                  {isBuyRecommendation(stockAnalysis.recommendation) && <TrendingUp className="w-5 h-5" />}
                  {isSellRecommendation(stockAnalysis.recommendation) && <TrendingDown className="w-5 h-5" />}
                  {stockAnalysis.recommendation}
                </div>
                <div className="flex gap-2">
                  <span className={cn(
                    "text-xs px-2 py-1 rounded-full",
                    stockAnalysis.confidence === "HIGH" && "bg-success/10 text-success",
                    stockAnalysis.confidence === "MEDIUM" && "bg-warning/10 text-warning",
                    stockAnalysis.confidence === "LOW" && "bg-muted text-muted-foreground"
                  )}>
                    {stockAnalysis.confidence} confidence
                  </span>
                  <span className={cn(
                    "text-xs px-2 py-1 rounded-full",
                    stockAnalysis.riskLevel === "LOW" && "bg-success/10 text-success",
                    stockAnalysis.riskLevel === "MEDIUM" && "bg-warning/10 text-warning",
                    stockAnalysis.riskLevel === "HIGH" && "bg-destructive/10 text-destructive"
                  )}>
                    {stockAnalysis.riskLevel} risk
                  </span>
                </div>
              </div>
              <p className="text-muted-foreground">{stockAnalysis.reasoning}</p>

              {stockAnalysis.thesis && (
                <div>
                  <h4 className="text-sm font-semibold text-foreground mb-1 uppercase tracking-wider">Investment Thesis</h4>
                  <p className="text-muted-foreground text-sm leading-relaxed">{stockAnalysis.thesis}</p>
                </div>
              )}

              {stockAnalysis.businessOverview && (
                <div>
                  <h4 className="text-sm font-semibold text-foreground mb-1 uppercase tracking-wider">Business Overview</h4>
                  <p className="text-muted-foreground text-sm leading-relaxed">{stockAnalysis.businessOverview}</p>
                </div>
              )}

              {stockAnalysis.fundamentals && (
                <div>
                  <h4 className="text-sm font-semibold text-foreground mb-1 uppercase tracking-wider">Fundamentals</h4>
                  <p className="text-muted-foreground text-sm leading-relaxed">{stockAnalysis.fundamentals}</p>
                </div>
              )}

              {stockAnalysis.technicals && (
                <div>
                  <h4 className="text-sm font-semibold text-foreground mb-1 uppercase tracking-wider">Technical View</h4>
                  <p className="text-muted-foreground text-sm leading-relaxed">{stockAnalysis.technicals}</p>
                </div>
              )}

              {(stockAnalysis.bullCase?.length || stockAnalysis.bearCase?.length) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {stockAnalysis.bullCase && stockAnalysis.bullCase.length > 0 && (
                    <div className="rounded-lg border border-success/20 bg-success/5 p-4">
                      <h4 className="text-sm font-semibold text-success mb-2 uppercase tracking-wider">Bull Case</h4>
                      <ul className="space-y-1.5">
                        {stockAnalysis.bullCase.map((item, i) => (
                          <li key={i} className="text-sm text-muted-foreground flex gap-2">
                            <span className="text-success mt-0.5">+</span>
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {stockAnalysis.bearCase && stockAnalysis.bearCase.length > 0 && (
                    <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4">
                      <h4 className="text-sm font-semibold text-destructive mb-2 uppercase tracking-wider">Bear Case</h4>
                      <ul className="space-y-1.5">
                        {stockAnalysis.bearCase.map((item, i) => (
                          <li key={i} className="text-sm text-muted-foreground flex gap-2">
                            <span className="text-destructive mt-0.5">−</span>
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {stockAnalysis.catalysts && stockAnalysis.catalysts.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-foreground mb-2 uppercase tracking-wider">Catalysts to Watch</h4>
                  <ul className="space-y-1.5">
                    {stockAnalysis.catalysts.map((item, i) => (
                      <li key={i} className="text-sm text-muted-foreground flex gap-2">
                        <span className="text-primary mt-0.5">•</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {stockAnalysis.priceTarget > 0 && (
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground">Price Target:</span>
                  <span className={cn(
                    "font-semibold",
                    stockAnalysis.priceTarget > parseFloat(stockData.price) ? "text-success" : "text-destructive"
                  )}>
                    ${stockAnalysis.priceTarget.toFixed(2)}
                  </span>
                  {stockData.price !== "—" && (
                    <span className="text-xs text-muted-foreground">
                      ({((stockAnalysis.priceTarget - parseFloat(stockData.price)) / parseFloat(stockData.price) * 100).toFixed(1)}% from current)
                    </span>
                  )}
                </div>
              )}

              {(stockAnalysis.bullTarget || stockAnalysis.bearTarget) && (
                <div className="grid grid-cols-3 gap-2 text-center">
                  {stockAnalysis.bearTarget ? (
                    <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3">
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Bear</div>
                      <div className="font-semibold text-destructive">${stockAnalysis.bearTarget.toFixed(2)}</div>
                    </div>
                  ) : <div />}
                  <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Base</div>
                    <div className="font-semibold text-primary">${stockAnalysis.priceTarget.toFixed(2)}</div>
                  </div>
                  {stockAnalysis.bullTarget ? (
                    <div className="rounded-lg border border-success/20 bg-success/5 p-3">
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Bull</div>
                      <div className="font-semibold text-success">${stockAnalysis.bullTarget.toFixed(2)}</div>
                    </div>
                  ) : <div />}
                </div>
              )}

              {stockAnalysis.priceTargetRationale && (
                <div>
                  <h4 className="text-sm font-semibold text-foreground mb-1 uppercase tracking-wider">Price Target Rationale</h4>
                  <p className="text-muted-foreground text-sm leading-relaxed">{stockAnalysis.priceTargetRationale}</p>
                </div>
              )}

              <p className="text-xs text-muted-foreground italic">
                Analysis based on our research-driven investing methodology. For informational purposes only. Not financial advice.
              </p>
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-4">Analysis unavailable</p>
          )}
        </div>

        {/* Actions */}
        <div className="glass-card p-6">
          <h3 className="text-lg font-semibold text-foreground mb-4">Quick Actions</h3>
          <div className="flex flex-wrap gap-3">
            <Button onClick={() => navigate("/chat")}>
              Ask AI about {stockData.symbol}
            </Button>
            <Button variant="outline" onClick={() => navigate("/markets")}>
              <ExternalLink className="w-4 h-4 mr-2" />
              Browse More Stocks
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Stock;
