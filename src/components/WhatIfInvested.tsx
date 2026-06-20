import { useEffect, useMemo, useState } from "react";
import { Loader2, History, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

interface Fund {
  symbol: string;
  name: string;
  allocation: number;
}

interface WhatIfInvestedProps {
  funds: Fund[];
  investmentAmount: number;
}

type Horizon = "6M" | "1Y" | "3Y" | "5Y";
const HORIZONS: { key: Horizon; label: string; days: number }[] = [
  { key: "6M", label: "6 Months", days: 182 },
  { key: "1Y", label: "1 Year", days: 365 },
  { key: "3Y", label: "3 Years", days: 365 * 3 },
  { key: "5Y", label: "5 Years", days: 365 * 5 },
];

interface HistoryPoint {
  date: string; // ISO
  price: number;
}

interface SymbolState {
  loading: boolean;
  error?: string;
  current?: number;
  history?: HistoryPoint[];
}

function pickPriceAt(history: HistoryPoint[], targetDays: number): number | null {
  if (!history || history.length === 0) return null;
  const targetTime = Date.now() - targetDays * 24 * 60 * 60 * 1000;
  let best: HistoryPoint | null = null;
  let bestDelta = Infinity;
  for (const p of history) {
    const t = new Date(p.date).getTime();
    const delta = Math.abs(t - targetTime);
    if (delta < bestDelta) {
      bestDelta = delta;
      best = p;
    }
  }
  return best?.price ?? null;
}

const formatMoney = (n: number) =>
  `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function WhatIfInvested({ funds, investmentAmount }: WhatIfInvestedProps) {
  const tradable = useMemo(() => funds.filter((f) => f.symbol !== "CASH"), [funds]);
  const cashAllocation = useMemo(
    () => funds.filter((f) => f.symbol === "CASH").reduce((s, f) => s + f.allocation, 0),
    [funds]
  );
  const [horizon, setHorizon] = useState<Horizon>("1Y");
  const [data, setData] = useState<Record<string, SymbolState>>({});

  useEffect(() => {
    let cancelled = false;
    const loadAll = async () => {
      setData((prev) => {
        const next = { ...prev };
        tradable.forEach((f) => {
          if (!next[f.symbol]) next[f.symbol] = { loading: true };
        });
        return next;
      });

      await Promise.all(
        tradable.map(async (f) => {
          try {
            const { data: resp, error } = await supabase.functions.invoke("market-data", {
              body: { historical: true, symbol: f.symbol, range: "5Y" },
            });
            if (cancelled) return;
            if (error) throw error;
            const points: HistoryPoint[] = (resp?.data || []).map((p: any) => ({
              date: p.date,
              price: p.price,
            }));
            const current = points.length > 0 ? points[points.length - 1].price : undefined;
            setData((prev) => ({
              ...prev,
              [f.symbol]: { loading: false, history: points, current },
            }));
          } catch (err: any) {
            if (cancelled) return;
            setData((prev) => ({
              ...prev,
              [f.symbol]: { loading: false, error: err?.message || "Failed to load" },
            }));
          }
        })
      );
    };
    loadAll();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tradable.map((f) => f.symbol).join(",")]);

  if (tradable.length === 0) return null;

  // Aggregate across all holdings for the selected horizon.
  const horizonMeta = HORIZONS.find((h) => h.key === horizon)!;
  const stillLoading = tradable.some((f) => !data[f.symbol] || data[f.symbol].loading);

  let totalNowValue = 0;
  let totalAllocated = 0;
  let priced = 0;
  let unpriced: string[] = [];
  let earliestAvailableDays = Infinity;

  for (const fund of tradable) {
    const allocated = (investmentAmount * fund.allocation) / 100;
    totalAllocated += allocated;
    const state = data[fund.symbol];
    if (!state || state.loading || !state.history || !state.current) {
      unpriced.push(fund.symbol);
      continue;
    }
    const oldest = state.history[0];
    if (oldest) {
      const daysAvail = Math.floor(
        (Date.now() - new Date(oldest.date).getTime()) / (1000 * 60 * 60 * 24)
      );
      if (daysAvail < earliestAvailableDays) earliestAvailableDays = daysAvail;
    }
    const past = pickPriceAt(state.history, horizonMeta.days);
    if (!past || past <= 0) {
      unpriced.push(fund.symbol);
      continue;
    }
    const shares = allocated / past;
    totalNowValue += shares * state.current;
    priced++;
  }

  // Add the cash portion at face value (no growth)
  const cashAmount = (investmentAmount * cashAllocation) / 100;
  totalNowValue += cashAmount;
  totalAllocated += cashAmount;

  const hasResult = priced > 0 && !stillLoading;
  const horizonUnavailable =
    !stillLoading && isFinite(earliestAvailableDays) && earliestAvailableDays + 30 < horizonMeta.days;

  return (
    <div className="glass-card overflow-hidden">
      <div className="p-4 border-b border-border/50 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
            <History className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-foreground">What If You'd Invested Earlier?</h3>
            <p className="text-sm text-muted-foreground">
              Hypothetical value of your full portfolio if {formatMoney(investmentAmount)} had been invested across these allocations earlier.
            </p>
          </div>
        </div>

        {/* Horizon toggle */}
        <div className="flex rounded-lg border border-border/50 bg-muted/30 p-0.5">
          {HORIZONS.map((h) => {
            const active = h.key === horizon;
            return (
              <button
                key={h.key}
                type="button"
                onClick={() => setHorizon(h.key)}
                className={cn(
                  "px-3 py-1.5 text-xs font-medium rounded-md transition-colors",
                  active
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {h.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="p-6">
        {stillLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading historical prices for your holdings…
          </div>
        ) : !hasResult ? (
          <p className="text-sm text-muted-foreground">
            Historical prices were unavailable for this portfolio. Please try again later.
          </p>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            <div className="rounded-xl bg-muted/20 border border-border/30 p-4">
              <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
                Invested {horizonMeta.label.toLowerCase()} ago
              </p>
              <p className="text-2xl font-bold text-foreground">{formatMoney(investmentAmount)}</p>
            </div>
            <div className="rounded-xl bg-muted/20 border border-border/30 p-4">
              <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
                Worth today
              </p>
              <p className="text-2xl font-bold text-foreground">{formatMoney(totalNowValue)}</p>
            </div>
          </div>
        )}

        {(horizonUnavailable || unpriced.length > 0) && hasResult && (
          <p className="text-xs text-muted-foreground mt-4">
            {horizonUnavailable
              ? `Some holdings don't have a full ${horizonMeta.label.toLowerCase()} of price history, so their earliest available price was used.`
              : `Excluded from the calculation due to missing price history: ${unpriced.join(", ")}.`}
          </p>
        )}
      </div>

      <p className="text-xs text-muted-foreground p-3 border-t border-border/40 bg-muted/10">
        Hypothetical, price-only calculation using your current target allocation. Cash sleeve held at face value. Excludes dividends, fees, and rebalancing. Past performance is not indicative of future results.
      </p>
    </div>
  );
}