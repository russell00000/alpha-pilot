import { lazy, Suspense, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { ForecastData } from "@/components/ForecastChart";
import type { PracticeHolding } from "@/hooks/usePracticeTrading";
import { Loader2 } from "lucide-react";

const ForecastChart = lazy(() =>
  import("@/components/ForecastChart").then((m) => ({ default: m.ForecastChart })),
);

interface Props {
  holdings: PracticeHolding[];
}

export default function HoldingForecasts({ holdings }: Props) {
  const [forecasts, setForecasts] = useState<Record<string, ForecastData | null>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let cancelled = false;
    const symbols = holdings.map((h) => h.symbol);

    // Drop forecasts for removed holdings
    setForecasts((prev) => {
      const next: Record<string, ForecastData | null> = {};
      for (const s of symbols) if (s in prev) next[s] = prev[s];
      return next;
    });

    // Fetch any missing forecasts sequentially to avoid rate limits
    (async () => {
      for (const symbol of symbols) {
        if (cancelled) return;
        if (forecasts[symbol] !== undefined) continue; // already fetched (success or null)
        setLoading((l) => ({ ...l, [symbol]: true }));
        try {
          const { data, error } = await supabase.functions.invoke("stock-forecast", {
            body: { symbol },
          });
          if (cancelled) return;
          setForecasts((prev) => ({
            ...prev,
            [symbol]: !error && data?.forecast ? (data.forecast as ForecastData) : null,
          }));
        } catch {
          if (!cancelled) setForecasts((prev) => ({ ...prev, [symbol]: null }));
        } finally {
          if (!cancelled) setLoading((l) => ({ ...l, [symbol]: false }));
        }
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [holdings.map((h) => h.symbol).join(",")]);

  if (holdings.length === 0) return null;

  return (
    <div className="mt-8">
      <h2 className="text-lg font-semibold text-foreground mb-3">12-Month Forecasts</h2>
      <div className="grid gap-4 md:grid-cols-2">
        {holdings.map((h) => {
          const f = forecasts[h.symbol];
          const isLoading = loading[h.symbol] || f === undefined;
          return (
            <div key={h.symbol} className="rounded-xl border border-border/60 bg-card overflow-hidden">
              <div className="px-4 py-3 border-b border-border/40 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-foreground">{h.symbol}</p>
                  <p className="text-xs text-muted-foreground">{h.name}</p>
                </div>
              </div>
              <div className="p-3">
                {isLoading ? (
                  <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Building forecast...
                  </div>
                ) : f ? (
                  <Suspense fallback={<div className="py-8 text-center text-sm text-muted-foreground">Loading chart...</div>}>
                    <ForecastChart forecast={f} />
                  </Suspense>
                ) : (
                  <div className="py-8 text-center text-sm text-muted-foreground">
                    Forecast unavailable for {h.symbol}.
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}