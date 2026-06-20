import { useEffect, useMemo, useState } from "react";
import { Loader2, ArrowUpRight, ArrowDownRight, History } from "lucide-react";
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
  // Find the data point closest to targetTime that is not after it
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
  const [selected, setSelected] = useState<Record<string, Horizon>>(() => {
    const init: Record<string, Horizon> = {};
    tradable.forEach((f) => (init[f.symbol] = "1Y"));
    return init;
  });
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

  return (
    <div className="glass-card overflow-hidden">
      <div className="p-4 border-b border-border/50 flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
          <History className="w-4 h-4 text-primary" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-foreground">What If You'd Invested Earlier?</h3>
          <p className="text-sm text-muted-foreground">
            See what each holding's allocation would be worth today, based on prices from 6 months to 5 years ago.
          </p>
        </div>
      </div>

      <div className="divide-y divide-border/40">
        {tradable.map((fund) => {
          const allocated = (investmentAmount * fund.allocation) / 100;
          const state = data[fund.symbol];
          const horizon = selected[fund.symbol] || "1Y";
          const horizonMeta = HORIZONS.find((h) => h.key === horizon)!;

          let nowValue: number | null = null;
          let returnPct: number | null = null;
          let pastPrice: number | null = null;
          if (state?.history && state.current) {
            pastPrice = pickPriceAt(state.history, horizonMeta.days);
            if (pastPrice && pastPrice > 0) {
              const shares = allocated / pastPrice;
              nowValue = shares * state.current;
              returnPct = ((state.current - pastPrice) / pastPrice) * 100;
            }
          }
          const gain = nowValue !== null ? nowValue - allocated : null;
          const oldestPoint = state?.history?.[0];
          const oldestDays = oldestPoint
            ? Math.floor((Date.now() - new Date(oldestPoint.date).getTime()) / (1000 * 60 * 60 * 24))
            : 0;

          return (
            <div key={fund.symbol} className="p-4 space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-muted-foreground">{fund.symbol}</span>
                    <span className="font-semibold text-foreground truncate">{fund.name}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Allocation today: {formatMoney(allocated)} ({fund.allocation.toFixed(1)}%)
                  </p>
                </div>

                {/* Horizon toggle */}
                <div className="flex rounded-lg border border-border/50 bg-muted/30 p-0.5">
                  {HORIZONS.map((h) => {
                    const active = h.key === horizon;
                    const disabled =
                      !!state?.history && oldestDays > 0 && h.days > oldestDays + 30;
                    return (
                      <button
                        key={h.key}
                        type="button"
                        disabled={disabled}
                        onClick={() =>
                          setSelected((prev) => ({ ...prev, [fund.symbol]: h.key }))
                        }
                        className={cn(
                          "px-3 py-1 text-xs font-medium rounded-md transition-colors",
                          active
                            ? "bg-primary text-primary-foreground shadow-sm"
                            : "text-muted-foreground hover:text-foreground",
                          disabled && "opacity-40 cursor-not-allowed hover:text-muted-foreground"
                        )}
                        title={disabled ? "Not enough price history" : undefined}
                      >
                        {h.key}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Result row */}
              <div className="rounded-lg bg-muted/20 border border-border/30 p-3">
                {state?.loading || !state ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Loading price history…
                  </div>
                ) : state.error ? (
                  <p className="text-sm text-muted-foreground">
                    Price history unavailable for this holding.
                  </p>
                ) : nowValue === null || returnPct === null || gain === null ? (
                  <p className="text-sm text-muted-foreground">
                    Not enough history for {horizonMeta.label.toLowerCase()} of data.
                  </p>
                ) : (
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="text-sm text-foreground">
                      <span className="text-muted-foreground">
                        Investing {formatMoney(allocated)} {horizonMeta.label.toLowerCase()} ago would be worth
                      </span>{" "}
                      <span className="font-semibold">{formatMoney(nowValue)}</span> today.
                    </div>
                    <div className="flex items-center gap-1.5">
                      {returnPct >= 0 ? (
                        <ArrowUpRight className="w-4 h-4 text-emerald-500" />
                      ) : (
                        <ArrowDownRight className="w-4 h-4 text-red-500" />
                      )}
                      <span
                        className={cn(
                          "font-semibold text-sm",
                          returnPct >= 0 ? "text-emerald-500" : "text-red-500"
                        )}
                      >
                        {gain >= 0 ? "+" : "-"}
                        {formatMoney(Math.abs(gain))} ({returnPct >= 0 ? "+" : ""}
                        {returnPct.toFixed(2)}%)
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-xs text-muted-foreground p-3 border-t border-border/40 bg-muted/10">
        Hypothetical, price-only calculation using your current target allocation. Excludes dividends, fees, and rebalancing. Past performance is not indicative of future results.
      </p>
    </div>
  );
}