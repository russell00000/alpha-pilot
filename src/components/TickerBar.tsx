type Tick = { symbol: string; price: string; change: number };

const TICKS: Tick[] = [
  { symbol: "GOOGL", price: "343.80", change: -3.84 },
  { symbol: "ADBE", price: "263.71", change: -3.39 },
  { symbol: "AVGO", price: "296.42", change: -3.28 },
  { symbol: "AMZN", price: "272.27", change: -2.09 },
  { symbol: "NVDA", price: "184.06", change: 2.1 },
  { symbol: "MSFT", price: "489.12", change: 1.24 },
  { symbol: "AAPL", price: "231.44", change: 0.86 },
  { symbol: "META", price: "612.90", change: 2.0 },
];

const Row = () => (
  <div className="flex shrink-0 items-center">
    {TICKS.map((t, i) => {
      const up = t.change >= 0;
      return (
        <span key={`${t.symbol}-${i}`} className="flex items-center whitespace-nowrap font-mono text-[0.72rem]">
          <span className="text-foreground/75">{t.symbol}</span>
          <span className="ml-2 text-foreground/55">${t.price}</span>
          <span className={up ? "ml-2 text-gold" : "ml-2 text-destructive"}>
            {up ? "▲" : "▼"}
            {Math.abs(t.change).toFixed(2)}%
          </span>
          <span className="mx-4 text-foreground/20">·</span>
        </span>
      );
    })}
  </div>
);

/** Continuously scrolling market tape shown under the navigation. */
const TickerBar = () => (
  <div className="ticker-mask border-y border-border/60 bg-background/40 py-2 backdrop-blur-md">
    <div className="ticker-marquee">
      <Row />
      <Row />
    </div>
  </div>
);

export default TickerBar;
