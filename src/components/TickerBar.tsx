import { memo, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

const STOCKS = ["AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "TSLA", "META"];
const CRYPTO = ["AVAX", "LINK", "DOGE"];
const ORDER = [...STOCKS, ...CRYPTO];
const POLL_MS = 15000;

interface Quote {
  symbol: string;
  c: number;
  dp: number;
}

const format = (value: number) =>
  value >= 1000 ? value.toLocaleString("en-US", { maximumFractionDigits: 2 }) : value < 1 ? value.toFixed(4) : value.toFixed(2);

/** Static markup — rendered once, mutated afterwards via direct DOM writes. */
const Row = () => (
  <div className="flex shrink-0 items-center">
    {ORDER.map((symbol) => (
      <span key={symbol} className="flex items-center whitespace-nowrap font-mono text-[0.72rem]">
        <span className="text-foreground/75">{symbol}</span>
        <span className="ticker-price ml-2 text-foreground/55" data-price={symbol}>
          —
        </span>
        <span className="ml-2 text-foreground/40" data-change={symbol}>
          ·
        </span>
        <span className="mx-4 text-foreground/20">·</span>
      </span>
    ))}
  </div>
);

/**
 * Continuously scrolling market tape. The component mounts once and never
 * re-renders: prices live in a ref and are written straight into the DOM so the
 * CSS marquee keeps running uninterrupted on the compositor thread.
 */
const TickerBar = memo(
  () => {
    const rootRef = useRef<HTMLDivElement>(null);
    const priceRef = useRef<Record<string, number>>({});

    useEffect(() => {
      let alive = true;
      const timers: number[] = [];

      const paint = (quotes: Quote[]) => {
        const root = rootRef.current;
        if (!root) return;
        quotes.forEach((q) => {
          if (!q || typeof q.c !== "number") return;
          const prev = priceRef.current[q.symbol];
          priceRef.current[q.symbol] = q.c;
          const text = `$${format(q.c)}`;
          const dir = prev === undefined || prev === q.c ? null : q.c > prev ? "flash-up" : "flash-down";

          root.querySelectorAll<HTMLElement>(`[data-price="${q.symbol}"]`).forEach((el) => {
            el.textContent = text;
            if (!dir) return;
            el.classList.remove("flash-up", "flash-down");
            el.classList.add(dir);
            timers.push(window.setTimeout(() => el.classList.remove(dir), 500));
          });

          if (typeof q.dp === "number") {
            const up = q.dp >= 0;
            root.querySelectorAll<HTMLElement>(`[data-change="${q.symbol}"]`).forEach((el) => {
              el.textContent = `${up ? "▲" : "▼"}${Math.abs(q.dp).toFixed(2)}%`;
              el.classList.remove("text-foreground/40", "text-success", "text-destructive");
              el.classList.add(up ? "text-success" : "text-destructive");
            });
          }
        });
      };

      const fetchAction = async (action: string, symbols: string[]): Promise<Quote[]> => {
        try {
          const { data } = await supabase.functions.invoke("finnhub", { body: { action, symbols } });
          return Array.isArray(data?.data) ? (data.data as Quote[]) : [];
        } catch {
          return [];
        }
      };

      const tick = async () => {
        const [stocks, crypto] = await Promise.all([fetchAction("quotes", STOCKS), fetchAction("crypto", CRYPTO)]);
        if (!alive) return;
        paint([...stocks, ...crypto]);
      };

      tick();
      const id = window.setInterval(tick, POLL_MS);
      return () => {
        alive = false;
        window.clearInterval(id);
        timers.forEach(window.clearTimeout);
      };
    }, []);

    return (
      <div ref={rootRef} className="ticker-mask overflow-hidden border-y border-border/60 bg-background/40 py-2 backdrop-blur-md">
        <div className="ticker-track">
          <Row />
          <Row />
        </div>
      </div>
    );
  },
  () => true,
);

TickerBar.displayName = "TickerBar";

export default TickerBar;
