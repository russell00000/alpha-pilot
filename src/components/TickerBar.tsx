import { cn } from "@/lib/utils";
import { useFinnhubQuotes, type FinnhubQuote } from "@/hooks/useFinnhubQuotes";

const STOCKS = ["AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "TSLA", "META"];
const CRYPTO = ["AVAX", "LINK", "DOGE"];
const ORDER = [...STOCKS, ...CRYPTO];

const format = (value: number) =>
  value >= 1000 ? value.toLocaleString("en-US", { maximumFractionDigits: 2 }) : value < 1 ? value.toFixed(4) : value.toFixed(2);

const Row = ({ quotes }: { quotes: Record<string, FinnhubQuote> }) => (
  <div className="flex shrink-0 items-center">
    {ORDER.map((symbol) => {
      const q = quotes[symbol];
      const up = (q?.dp ?? 0) >= 0;
      const tickUp = q?.tick === "up";
      const tickDown = q?.tick === "down";
      return (
        <span key={symbol} className="flex items-center whitespace-nowrap font-mono text-[0.72rem]">
          <span className="text-foreground/75">{symbol}</span>
          <span
            className={cn(
              "ml-2 transition-colors duration-500",
              tickUp ? "text-success" : tickDown ? "text-destructive" : "text-foreground/55",
            )}
          >
            {q ? `$${format(q.c)}` : "—"}
          </span>
          <span className={cn("ml-2", up ? "text-success" : "text-destructive")}>
            {q ? (
              <>
                {up ? "▲" : "▼"}
                {Math.abs(q.dp).toFixed(2)}%
              </>
            ) : (
              "·"
            )}
          </span>
          {q?.delayed && <span className="ml-1.5 text-[0.6rem] uppercase tracking-widest text-muted-foreground">delayed</span>}
          <span className="mx-4 text-foreground/20">·</span>
        </span>
      );
    })}
  </div>
);

/** Continuously scrolling market tape with live prices under the navigation. */
const TickerBar = () => {
  const { quotes } = useFinnhubQuotes({ symbols: STOCKS, cryptoSymbols: CRYPTO, intervalMs: 5000 });

  return (
    <div className="ticker-mask border-y border-border/60 bg-background/40 py-2 backdrop-blur-md">
      <div className="ticker-marquee">
        <Row quotes={quotes} />
        <Row quotes={quotes} />
      </div>
    </div>
  );
};

export default TickerBar;
