import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";

export interface PracticeHolding {
  id: string;
  symbol: string;
  name: string;
  quantity: number;
  avg_cost_basis: number;
  currentPrice?: number;
  totalValue?: number;
  gainLoss?: number;
  gainLossPercent?: number;
}

export interface PracticeTrade {
  id: string;
  symbol: string;
  name: string;
  trade_type: string;
  quantity: number;
  price_per_share: number;
  total_amount: number;
  created_at: string;
}

export function usePracticeTrading() {
  const { user } = useAuth();
  const [cashBalance, setCashBalance] = useState<number>(10000);
  const [holdings, setHoldings] = useState<PracticeHolding[]>([]);
  const [trades, setTrades] = useState<PracticeTrade[]>([]);
  const [loading, setLoading] = useState(true);
  const [portfolioId, setPortfolioId] = useState<string | null>(null);

  const initPortfolio = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    // Get or create portfolio
    let { data: portfolio } = await supabase
      .from("practice_portfolios")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!portfolio) {
      const { data: newPortfolio, error } = await supabase
        .from("practice_portfolios")
        .insert({ user_id: user.id, cash_balance: 10000 })
        .select()
        .single();
      if (error) {
        toast.error("Failed to create practice account");
        setLoading(false);
        return;
      }
      portfolio = newPortfolio;
    }

    setPortfolioId(portfolio.id);
    setCashBalance(Number(portfolio.cash_balance));

    // Load holdings
    const { data: holdingsData } = await supabase
      .from("practice_holdings")
      .select("*")
      .eq("user_id", user.id);
    setHoldings((holdingsData || []).map(h => ({
      ...h,
      quantity: Number(h.quantity),
      avg_cost_basis: Number(h.avg_cost_basis),
    })));

    // Load trades
    const { data: tradesData } = await supabase
      .from("practice_trades")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);
    setTrades((tradesData || []).map(t => ({
      ...t,
      quantity: Number(t.quantity),
      price_per_share: Number(t.price_per_share),
      total_amount: Number(t.total_amount),
    })));

    setLoading(false);
  }, [user]);

  useEffect(() => {
    initPortfolio();
  }, [initPortfolio]);

  const executeBuy = async (symbol: string, name: string, quantity: number, pricePerShare: number) => {
    if (!user) throw new Error("Not authenticated");
    const totalCost = quantity * pricePerShare;
    if (totalCost > cashBalance) throw new Error("Insufficient funds");

    const newCash = cashBalance - totalCost;

    // Update cash balance
    await supabase
      .from("practice_portfolios")
      .update({ cash_balance: newCash })
      .eq("user_id", user.id);

    // Upsert holding
    const existing = holdings.find(h => h.symbol === symbol);
    if (existing) {
      const newQty = existing.quantity + quantity;
      const newAvgCost = ((existing.avg_cost_basis * existing.quantity) + totalCost) / newQty;
      await supabase
        .from("practice_holdings")
        .update({ quantity: newQty, avg_cost_basis: newAvgCost })
        .eq("user_id", user.id)
        .eq("symbol", symbol);
    } else {
      await supabase
        .from("practice_holdings")
        .insert({
          user_id: user.id,
          symbol,
          name,
          quantity,
          avg_cost_basis: pricePerShare,
        });
    }

    // Record trade
    await supabase.from("practice_trades").insert({
      user_id: user.id,
      symbol,
      name,
      trade_type: "buy",
      quantity,
      price_per_share: pricePerShare,
      total_amount: totalCost,
    });

    await initPortfolio();
    toast.success(`Bought ${quantity} shares of ${symbol}`);
  };

  const executeSell = async (symbol: string, name: string, quantity: number, pricePerShare: number) => {
    if (!user) throw new Error("Not authenticated");
    const existing = holdings.find(h => h.symbol === symbol);
    if (!existing || existing.quantity < quantity) throw new Error("Insufficient shares");

    const totalProceeds = quantity * pricePerShare;
    const newCash = cashBalance + totalProceeds;

    // Update cash
    await supabase
      .from("practice_portfolios")
      .update({ cash_balance: newCash })
      .eq("user_id", user.id);

    // Update or remove holding
    const newQty = existing.quantity - quantity;
    if (newQty <= 0) {
      await supabase
        .from("practice_holdings")
        .delete()
        .eq("user_id", user.id)
        .eq("symbol", symbol);
    } else {
      await supabase
        .from("practice_holdings")
        .update({ quantity: newQty })
        .eq("user_id", user.id)
        .eq("symbol", symbol);
    }

    // Record trade
    await supabase.from("practice_trades").insert({
      user_id: user.id,
      symbol,
      name,
      trade_type: "sell",
      quantity,
      price_per_share: pricePerShare,
      total_amount: totalProceeds,
    });

    await initPortfolio();
    toast.success(`Sold ${quantity} shares of ${symbol}`);
  };

  const resetAccount = async () => {
    if (!user) return;

    await supabase.from("practice_holdings").delete().eq("user_id", user.id);
    await supabase.from("practice_trades").delete().eq("user_id", user.id).gte("created_at", "1970-01-01");
    await supabase.from("practice_portfolios").update({ cash_balance: 10000 }).eq("user_id", user.id);

    await initPortfolio();
    toast.success("Practice account reset to $10,000");
  };

  return {
    cashBalance,
    holdings,
    trades,
    loading,
    portfolioId,
    executeBuy,
    executeSell,
    resetAccount,
    refresh: initPortfolio,
  };
}
