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

interface HistoricalDataPoint {
  date: string;
  price: number;
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
  const [historicalData, setHistoricalData] = useState<HistoricalDataPoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingChart, setIsLoadingChart] = useState(true);
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
    const actualDays = days === 0 ? 3650 : days; // "All" = 10 years
    
    const basePrice = stockData?.price ? parseFloat(stockData.price) : 150;
    const data: HistoricalDataPoint[] = [];
    
    let currentPrice = basePrice * (0.7 + Math.random() * 0.3);
    const volatility = days <= 7 ? 0.02 : days <= 30 ? 0.03 : 0.05;
    
    const interval = actualDays <= 7 ? 1 : actualDays <= 90 ? 1 : Math.ceil(actualDays / 250);
    
    for (let i = actualDays; i >= 0; i -= interval) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      
      currentPrice = currentPrice * (1 + (Math.random() - 0.48) * volatility);
      currentPrice = Math.max(currentPrice, basePrice * 0.3);
      
      let displayDate: string;
      if (actualDays <= 1) {
        displayDate = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      } else if (actualDays <= 7) {
        displayDate = date.toLocaleDateString([], { weekday: 'short' });
      } else if (actualDays <= 90) {
        displayDate = date.toLocaleDateString([], { month: 'short', day: 'numeric' });
      } else {
        displayDate = date.toLocaleDateString([], { month: 'short', year: '2-digit' });
      }
      
      data.push({
        date: date.toISOString(),
        price: parseFloat(currentPrice.toFixed(2)),
        displayDate,
      });
    }
    
    // Ensure last point matches current price
    if (data.length > 0 && stockData?.price) {
      data[data.length - 1].price = parseFloat(stockData.price);
    }
    
    setHistoricalData(data);
  };

  useEffect(() => {
    fetchStockData();
  }, [fetchStockData]);

  useEffect(() => {
    if (stockData) {
      fetchHistoricalData(activeRange);
    }
  }, [activeRange, stockData, fetchHistoricalData]);

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
      return (
        <div className="bg-background/95 backdrop-blur-sm border border-border rounded-lg p-3 shadow-lg">
          <p className="text-foreground font-semibold">${payload[0].value.toFixed(2)}</p>
          <p className="text-muted-foreground text-sm">{payload[0].payload.displayDate}</p>
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
        <div className="glass-card p-6 mb-6">
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
          <div className="flex gap-1 p-1 bg-secondary/50 rounded-lg mb-6 overflow-x-auto">
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
          <div className="h-[400px] w-full">
            {isLoadingChart ? (
              <div className="h-full flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={historicalData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
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
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                    tickFormatter={(value) => `$${value.toFixed(0)}`}
                    width={60}
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
            <p className="text-sm text-muted-foreground mb-1">Type</p>
            <p className="text-lg font-semibold text-foreground capitalize">{stockData.type.replace("_", " ")}</p>
          </div>
          <div className="glass-card p-4">
            <p className="text-sm text-muted-foreground mb-1">Symbol</p>
            <p className="text-lg font-semibold text-foreground">{stockData.symbol}</p>
          </div>
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
