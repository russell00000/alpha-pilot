import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePracticeTrading } from "@/hooks/usePracticeTrading";
import { useAuth } from "@/hooks/useAuth";
import SecuritySearch from "@/components/practice/SecuritySearch";
import HoldingsTable from "@/components/practice/HoldingsTable";
import TradeHistory from "@/components/practice/TradeHistory";
import TradeDialog from "@/components/practice/TradeDialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { DollarSign, TrendingUp, Briefcase, RotateCcw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface LiveQuote {
  price: number;
  changePercent: number;
  sparkline: number[];
}

const Practice = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { cashBalance, holdings, trades, loading, executeBuy, executeSell, resetAccount } = usePracticeTrading();

  const [tradeDialog, setTradeDialog] = useState<{
    open: boolean;
    mode: "buy" | "sell";
    symbol: string;
    name: string;
    maxShares?: number;
  }>({ open: false, mode: "buy", symbol: "", name: "" });

  const openBuy = (symbol: string, name: string) => {
    setTradeDialog({ open: true, mode: "buy", symbol, name });
  };

  const openSell = (symbol: string, name: string, maxShares: number) => {
    setTradeDialog({ open: true, mode: "sell", symbol, name, maxShares });
  };

  // Fetch live quotes (price + sparkline) for holdings
  const [liveQuotes, setLiveQuotes] = useState<Record<string, LiveQuote>>({});

  const fetchLivePrices = useCallback(async () => {
    if (holdings.length === 0) {
      setLiveQuotes({});
      return;
    }
    try {
      const symbols = holdings.map(h => h.symbol);
      const { data } = await supabase.functions.invoke("market-data", { body: { symbols } });
      const results = data?.data;
      if (Array.isArray(results)) {
        const q: Record<string, LiveQuote> = {};
        for (const item of results) {
          q[item.symbol] = {
            price: parseFloat(item.price),
            changePercent: Number(item.changePercent) || 0,
            sparkline: Array.isArray(item.sparkline) ? item.sparkline : [],
          };
        }
        setLiveQuotes(q);
      }
    } catch { /* ignore */ }
  }, [holdings]);

  useEffect(() => {
    fetchLivePrices();
    const interval = setInterval(fetchLivePrices, 60000); // refresh every minute
    return () => clearInterval(interval);
  }, [fetchLivePrices]);

  // Calculate portfolio value using live prices
  const initialInvestment = 10000;
  const holdingsValue = holdings.reduce((sum, h) => {
    const live = liveQuotes[h.symbol]?.price;
    return sum + h.quantity * (live ?? h.avg_cost_basis);
  }, 0);
  const totalValue = cashBalance + holdingsValue;
  const profitLoss = totalValue - initialInvestment;
  const profitLossPct = (profitLoss / initialInvestment) * 100;

  if (!authLoading && !user) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container px-4 md:px-6 py-16 text-center">
          <h1 className="text-3xl font-bold text-foreground mb-4">Practice Investing</h1>
          <p className="text-muted-foreground mb-6">Sign in to start practicing with your $10,000 virtual account.</p>
          <Button onClick={() => navigate("/auth")}>Sign In</Button>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container px-4 md:px-6 py-8">
        {/* Account Summary */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Practice Account</h1>
              <p className="text-muted-foreground text-sm mt-1">
                Simulated brokerage · No real money involved
              </p>
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <RotateCcw className="h-3.5 w-3.5" /> Reset Account
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Reset Practice Account?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will delete all holdings and trade history, and reset your balance to $10,000. This cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={resetAccount}>Reset Account</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-xl border border-border/60 bg-card p-5">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Briefcase className="h-4 w-4 text-primary" />
                  </div>
                  <span className="text-sm text-muted-foreground">Account Value</span>
                </div>
                {!loading && (
                  <span className={`text-xs font-semibold px-2 py-1 rounded-md ${profitLoss >= 0 ? "bg-green-500/10 text-green-500" : "bg-red-500/10 text-red-500"}`}>
                    {profitLoss >= 0 ? "+" : ""}${Math.abs(profitLoss).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ({profitLossPct >= 0 ? "+" : ""}{profitLossPct.toFixed(2)}%)
                  </span>
                )}
              </div>
              <p className="text-2xl font-bold text-foreground">
                {loading ? "—" : `$${totalValue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
              </p>
            </div>

            <div className="rounded-xl border border-border/60 bg-card p-5">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-9 h-9 rounded-lg bg-green-500/10 flex items-center justify-center">
                  <DollarSign className="h-4 w-4 text-green-500" />
                </div>
                <span className="text-sm text-muted-foreground">Cash Available</span>
              </div>
              <p className="text-2xl font-bold text-foreground">
                {loading ? "—" : `$${cashBalance.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
              </p>
            </div>

            <div
              className="rounded-xl border border-border/60 bg-card p-5 cursor-pointer hover:bg-muted/10 transition-colors"
              onClick={() => navigate("/practice/risk")}
            >
              <div className="flex items-center gap-3 mb-2">
                <div className="w-9 h-9 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <TrendingUp className="h-4 w-4 text-blue-500" />
                </div>
                <span className="text-sm text-muted-foreground">Volatility/Risk Analysis →</span>
              </div>
              <p className="text-2xl font-bold text-foreground">
                {loading ? "—" : `$${holdingsValue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
              </p>
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-foreground mb-3">Find Securities</h2>
          <SecuritySearch onBuy={openBuy} />
        </div>

        {/* Tabs */}
        <Tabs defaultValue="holdings" className="space-y-4">
          <TabsList>
            <TabsTrigger value="holdings">Holdings ({holdings.length})</TabsTrigger>
            <TabsTrigger value="history">Trade History ({trades.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="holdings">
            <HoldingsTable holdings={holdings} onSell={openSell} liveQuotes={liveQuotes} />
          </TabsContent>

          <TabsContent value="history">
            <TradeHistory trades={trades} />
          </TabsContent>
        </Tabs>

        {/* Disclaimer */}
        <div className="mt-8 rounded-xl border border-amber-500/20 bg-amber-500/5 p-6">
          <p className="text-xs text-muted-foreground">
            ⚠️ All transactions occur in a simulated environment. No real money is used, and no trades are executed in live markets.
            This tool is designed for educational and planning purposes only.
          </p>
        </div>

        {/* Trade Dialog */}
        <TradeDialog
          open={tradeDialog.open}
          onClose={() => setTradeDialog(prev => ({ ...prev, open: false }))}
          mode={tradeDialog.mode}
          symbol={tradeDialog.symbol}
          name={tradeDialog.name}
          maxShares={tradeDialog.maxShares}
          cashBalance={cashBalance}
          onExecute={tradeDialog.mode === "buy" ? executeBuy : executeSell}
        />
      </main>
    </div>
  );
};

export default Practice;
