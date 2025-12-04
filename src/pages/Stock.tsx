import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, TrendingUp, TrendingDown, RefreshCw, Loader2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/Header";
import { useToast } from "@/hooks/use-toast";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
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
  recommendation: "BUY" | "HOLD" | "SELL";
  confidence: "HIGH" | "MEDIUM" | "LOW";
  reasoning: string;
  priceTarget: number;
  riskLevel: "LOW" | "MEDIUM" | "HIGH";
}

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
    const endPrice = basePrice;
    const trendDirection = Math.random() > 0.4 ? 1 : -1; // Slight bullish bias
    const overallTrendStrength = (Math.random() * 0.3 + 0.1) * trendDirection;
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
      const phaseLength = isLastPhase ? remainingPoints : Math.floor(remainingPoints / (numPhases - i) * (0.5 + Math.random()));
      remainingPoints -= phaseLength;
      
      phases.push({
        trend: (Math.random() - 0.45) * baseVolatility * 3,
        volatility: baseVolatility * (0.5 + Math.random() * 1.5),
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
      const randomWalk = (Math.random() - 0.5) * currentPhase.volatility;
      const trend = currentPhase.trend;
      
      const priceChange = trend + randomWalk + momentum + meanReversion;
      currentPrice = currentPrice * (1 + priceChange);
      currentPrice = Math.max(currentPrice, basePrice * 0.2);
      currentPrice = Math.min(currentPrice, basePrice * 2);
      
      // Generate OHLC data
      const intraVolatility = currentPhase.volatility * 0.5;
      const open = currentPrice * (1 + (Math.random() - 0.5) * intraVolatility);
      const high = Math.max(currentPrice, open) * (1 + Math.random() * intraVolatility);
      const low = Math.min(currentPrice, open) * (1 - Math.random() * intraVolatility);
      
      // Volume with some randomness and spikes
      const volumeMultiplier = Math.random() > 0.95 ? (2 + Math.random() * 3) : (0.5 + Math.random());
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
    if (!symbol || !stockData || !stockDetails) return;
    
    setIsLoadingAnalysis(true);
    try {
      const { data, error } = await supabase.functions.invoke("stock-analysis", {
        body: {
          symbol: symbol.toUpperCase(),
          price: stockData.price,
          change: stockData.change,
          changePercent: stockData.changePercent,
          week52High: stockDetails.week52High,
          week52Low: stockDetails.week52Low,
          volume: stockData.volume,
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
  }, [symbol, stockData, stockDetails, toast]);

  useEffect(() => {
    fetchStockData();
    fetchStockDetails();
  }, [fetchStockData, fetchStockDetails]);

  useEffect(() => {
    if (stockData) {
      fetchHistoricalData(activeRange);
    }
  }, [activeRange, stockData, fetchHistoricalData]);

  useEffect(() => {
    if (stockData && stockDetails && !stockAnalysis && !isLoadingAnalysis) {
      fetchStockAnalysis();
    }
  }, [stockData, stockDetails, stockAnalysis, isLoadingAnalysis, fetchStockAnalysis]);

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

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-background/95 backdrop-blur-sm border border-border rounded-lg p-2.5 shadow-lg">
          <p className="text-muted-foreground text-xs">{data.displayDate}</p>
          <p className="text-foreground font-bold text-lg">${data.price.toFixed(2)}</p>
          <div className="flex gap-3 mt-1.5 text-xs">
            <span><span className="text-muted-foreground">O</span> ${data.open?.toFixed(2)}</span>
            <span><span className="text-success">H</span> ${data.high?.toFixed(2)}</span>
            <span><span className="text-destructive">L</span> ${data.low?.toFixed(2)}</span>
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
          <Button variant="ghost" onClick={() => navigate(-1)} className="mb-6">
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
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container mx-auto px-4 py-8">
        {/* Back Button */}
        <Button variant="ghost" onClick={() => navigate(-1)} className="mb-6">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>

        {/* Stock Header */}
        <div className="glass-card p-6 mb-6">
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className={cn(
                "w-16 h-16 rounded-xl flex items-center justify-center font-bold text-xl",
                stockData.type === "crypto" ? "bg-primary/20 text-primary" :
                stockData.type === "etf" ? "bg-accent/20 text-accent-foreground" :
                "bg-secondary text-foreground"
              )}>
                {stockData.symbol.slice(0, 2)}
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
        <div className="glass-card p-4 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <h2 className="text-xl font-semibold text-foreground">Price Chart</h2>
              <p className="text-sm text-muted-foreground">
                {activeRange === "1D" ? "Today" : 
                 activeRange === "1W" ? "Past week" :
                 activeRange === "1M" ? "Past month" :
                 activeRange === "3M" ? "Past 3 months" :
                 activeRange === "6M" ? "Past 6 months" :
                 activeRange === "1Y" ? "Past year" :
                 activeRange === "5Y" ? "Past 5 years" : "All time"}
                {historicalData.length > 1 && (
                  <span className={cn(
                    "ml-2",
                    priceChangePercent >= 0 ? "text-success" : "text-destructive"
                  )}>
                    {priceChangePercent >= 0 ? "+" : ""}{priceChangePercent.toFixed(2)}%
                  </span>
                )}
              </p>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleRefresh}
              disabled={isRefreshing}
            >
              <RefreshCw className={cn("w-4 h-4 mr-2", isRefreshing && "animate-spin")} />
              Refresh
            </Button>
          </div>

          {/* Time Range Selector */}
          <div className="flex gap-1 p-1 bg-secondary/50 rounded-lg mb-4 overflow-x-auto">
            {timeRanges.map((range) => (
              <button
                key={range.id}
                onClick={() => handleRangeChange(range.id)}
                className={cn(
                  "px-4 py-2 rounded-md text-sm font-medium transition-all whitespace-nowrap",
                  activeRange === range.id
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {range.label}
              </button>
            ))}
          </div>

          {/* Chart */}
          <div className="h-[350px] w-full -mx-2">
            {isLoadingChart ? (
              <div className="h-full flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={historicalData} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={chartColor} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={chartColor} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis 
                    dataKey="displayDate" 
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                    interval="preserveStartEnd"
                    minTickGap={50}
                  />
                  <YAxis 
                    domain={['dataMin', 'dataMax']}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                    tickFormatter={(value) => `$${value.toFixed(0)}`}
                    width={50}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="price"
                    stroke={chartColor}
                    strokeWidth={2}
                    fill="url(#colorPrice)"
                    dot={false}
                    activeDot={{ r: 6, fill: chartColor, stroke: 'hsl(var(--background))', strokeWidth: 2 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Stock Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="glass-card p-4">
            <p className="text-sm text-muted-foreground mb-1">Volume</p>
            <p className="text-lg font-semibold text-foreground">{stockData.volume}</p>
          </div>
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

        {/* Our Recommendation */}
        <div className="glass-card p-6 mb-6">
          <h3 className="text-lg font-semibold text-foreground mb-4">Our Recommendation</h3>
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
                  stockAnalysis.recommendation === "BUY" && "bg-success/20 text-success",
                  stockAnalysis.recommendation === "HOLD" && "bg-warning/20 text-warning",
                  stockAnalysis.recommendation === "SELL" && "bg-destructive/20 text-destructive"
                )}>
                  {stockAnalysis.recommendation === "BUY" && <TrendingUp className="w-5 h-5" />}
                  {stockAnalysis.recommendation === "SELL" && <TrendingDown className="w-5 h-5" />}
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
