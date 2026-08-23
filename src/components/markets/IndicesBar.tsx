import { useEffect, useState } from "react";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";
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

/** Clean horizontal bar of headline index quotes — no card, no radius. */
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
    <div className="mb-10 w-full border-b border-foreground/[0.08] pb-6">
      <div className="grid grid-cols-2 md:grid-cols-4">
        {rows.map((index, i) => {
          const positive = index.dp >= 0;
          const hasData = index.c > 0;
          return (
            <div
              key={index.key}
              className={cn(
                "flex flex-col gap-1.5 px-5 first:pl-0",
                i > 0 && "md:border-l md:border-foreground/[0.08]",
              )}
            >
              <span className="font-mono text-[0.62rem] uppercase tracking-[0.16em] text-foreground/40">
                {index.label}
                {index.proxy && <span className="ml-2 text-foreground/30">via {index.proxy}</span>}
                {delayed && hasData && <span className="ml-2 text-foreground/30">delayed</span>}
              </span>
              <div className="flex items-baseline gap-3">
                <span className="font-display text-[2.4rem] font-medium leading-none tracking-tight text-foreground tabular-nums">
                  {hasData ? index.c.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "—"}
                </span>
                <span
                  className={cn(
                    "flex items-center gap-0.5 font-mono text-[0.72rem] font-medium tabular-nums",
                    positive ? "text-primary" : "text-destructive",
                  )}
                >
                  {hasData ? (
                    <>
                      {positive ? (
                        <ArrowUpRight className="h-3 w-3" strokeWidth={2.2} />
                      ) : (
                        <ArrowDownRight className="h-3 w-3" strokeWidth={2.2} />
                      )}
                      {`${positive ? "+" : ""}${index.dp.toFixed(2)}%`}
                    </>
                  ) : (
                    "·"
                  )}
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
