import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

interface IndexQuote {
  key: string;
  label: string;
  proxy: string;
  c: number;
  d: number;
  dp: number;
}

/** Full-width glass strip of headline index chips. */
const IndicesBar = () => {
  const [indices, setIndices] = useState<IndexQuote[]>([]);
  const [delayed, setDelayed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const { data, error } = await supabase.functions.invoke("finnhub", { body: { action: "indices" } });
        if (error) throw error;
        if (!cancelled && Array.isArray(data?.data) && data.data.length > 0) {
          setIndices(data.data as IndexQuote[]);
          setDelayed(false);
        } else if (!cancelled) {
          setDelayed(true);
        }
      } catch {
        if (!cancelled) setDelayed(true);
      }
    };

    load();
    const id = setInterval(load, 30000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const placeholders = [
    { key: "SPX", label: "S&P 500" },
    { key: "NDX", label: "NASDAQ" },
    { key: "DJI", label: "DOW JONES" },
    { key: "VIX", label: "VIX" },
  ];

  const rows = indices.length > 0 ? indices : placeholders.map((p) => ({ ...p, proxy: "", c: 0, d: 0, dp: 0 }));

  return (
    <div className="mb-6 w-full rounded-2xl border border-border/20 border-b-2 border-b-primary/40 bg-background/50 backdrop-blur-md">
      <div className="grid grid-cols-2 divide-border/20 md:grid-cols-4 md:divide-x">
        {rows.map((index) => {
          const positive = index.dp >= 0;
          const hasData = index.c > 0;
          return (
            <div key={index.key} className="flex flex-col gap-1 px-5 py-4">
              <span className="font-mono text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
                {index.label}
                {index.proxy && <span className="ml-2 text-foreground/35">via {index.proxy}</span>}
                {delayed && hasData && <span className="ml-2 text-primary/70">delayed</span>}
              </span>
              <div className="flex items-baseline gap-3">
                <span className="font-display text-[1.7rem] font-semibold leading-none tracking-tight text-foreground tabular-nums">
                  {hasData ? index.c.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "—"}
                </span>
                <span
                  className={cn(
                    "font-mono text-xs font-semibold tabular-nums",
                    positive ? "text-success" : "text-destructive",
                  )}
                >
                  {hasData ? `${positive ? "+" : ""}${index.dp.toFixed(2)}%` : "·"}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default IndicesBar;
