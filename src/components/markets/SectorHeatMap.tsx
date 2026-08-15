import { cn } from "@/lib/utils";

export interface HeatMapSector {
  symbol: string;
  name: string;
  /** Approximate S&P 500 market-cap weight, used for tile size. */
  weight: number;
  changePercent: number;
  hasPrice: boolean;
}

interface Props {
  sectors: HeatMapSector[];
  onSelect?: (symbol: string) => void;
}

/** Deep green → neutral → deep red, scaled so ±2% saturates the tile. */
const tileBackground = (changePercent: number, hasPrice: boolean) => {
  if (!hasPrice) return "hsl(var(--muted) / 0.25)";
  const intensity = Math.min(Math.abs(changePercent) / 2, 1);
  const alpha = 0.1 + intensity * 0.55;
  const token = changePercent >= 0 ? "--success" : "--destructive";
  return `hsl(var(${token}) / ${alpha.toFixed(3)})`;
};

const SectorHeatMap = ({ sectors, onSelect }: Props) => (
  <section className="mb-6">
    <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.28em] text-muted-foreground">
      Sector Performance · Today
    </p>
    <div className="flex flex-wrap gap-1.5 rounded-2xl border border-border/20 bg-background/50 p-2 backdrop-blur-md">
      {sectors.map((sector) => {
        const positive = sector.changePercent >= 0;
        return (
          <button
            key={sector.symbol}
            type="button"
            onClick={() => onSelect?.(sector.symbol)}
            title={`${sector.name} · ${sector.hasPrice ? `${positive ? "+" : ""}${sector.changePercent.toFixed(2)}%` : "loading"}`}
            aria-label={`${sector.name} ${sector.hasPrice ? `${sector.changePercent.toFixed(2)} percent today` : "loading"}`}
            className="group relative flex min-w-[104px] flex-col justify-between overflow-hidden rounded-lg border border-border/20 p-3 text-left transition-all duration-300 hover:border-primary/50 hover:-translate-y-0.5"
            style={{
              flexGrow: sector.weight,
              flexBasis: `${Math.max(sector.weight * 2.2, 9)}%`,
              minHeight: sector.weight >= 10 ? 96 : 76,
              background: tileBackground(sector.changePercent, sector.hasPrice),
            }}
          >
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-foreground/70">{sector.symbol}</span>
            <span className="mt-1 text-[0.78rem] font-medium leading-tight text-foreground">{sector.name}</span>
            <span
              className={cn(
                "mt-1 font-mono text-xs font-semibold tabular-nums",
                !sector.hasPrice ? "text-muted-foreground" : positive ? "text-success" : "text-destructive",
              )}
            >
              {sector.hasPrice ? `${positive ? "+" : ""}${sector.changePercent.toFixed(2)}%` : "—"}
            </span>

            {/* Hover tooltip */}
            <span className="pointer-events-none absolute left-1/2 top-1 z-10 -translate-x-1/2 whitespace-nowrap rounded-md border border-border/40 bg-background/95 px-2 py-1 font-mono text-[10px] text-foreground opacity-0 shadow-lg backdrop-blur transition-opacity duration-200 group-hover:opacity-100">
              {sector.name} · {sector.hasPrice ? `${positive ? "+" : ""}${sector.changePercent.toFixed(2)}%` : "loading"}
            </span>
          </button>
        );
      })}
    </div>
  </section>
);

export default SectorHeatMap;
