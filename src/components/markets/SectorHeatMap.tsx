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

/** Deep green → neutral → deep red. Restrained (non-neon) greens/reds. */
const tileBackground = (changePercent: number, hasPrice: boolean) => {
  if (!hasPrice) return "rgba(239,232,219,0.08)";
  const abs = Math.abs(changePercent);
  if (abs < 0.05) return "rgba(239,232,219,0.08)";
  const t = Math.min(abs / 2, 1); // 0 = lightest, 1 = darkest
  const mix = (light: number[], dark: number[]) =>
    `rgb(${light.map((v, i) => Math.round(v + (dark[i] - v) * t)).join(",")})`;
  return changePercent >= 0
    ? mix([34, 197, 94], [22, 163, 74]) // #22c55e → #16a34a
    : mix([220, 38, 38], [153, 27, 27]); // #dc2626 → #991b1b
};

const SectorHeatMap = ({ sectors, onSelect }: Props) => (
  <section className="mb-10">
    <p className="mb-3 font-mono text-[0.65rem] uppercase tracking-[0.28em] text-muted-foreground">
      Sector Performance <span className="text-primary">·</span> Today
    </p>
    <div className="flex flex-wrap gap-1.5">
      {sectors.map((sector) => {
        const positive = sector.changePercent >= 0;
        return (
          <button
            key={sector.symbol}
            type="button"
            onClick={() => onSelect?.(sector.symbol)}
            title={`${sector.name} · ${sector.hasPrice ? `${positive ? "+" : ""}${sector.changePercent.toFixed(2)}%` : "loading"}`}
            aria-label={`${sector.name} ${sector.hasPrice ? `${sector.changePercent.toFixed(2)} percent today` : "loading"}`}
            className="group relative flex min-w-[104px] flex-col justify-between overflow-hidden rounded-[0.75rem] border border-white/[0.08] p-3 text-left transition-all duration-300 hover:border-primary/60 hover:-translate-y-0.5"
            style={{
              flexGrow: sector.weight,
              flexBasis: `${Math.max(sector.weight * 2.2, 9)}%`,
              minHeight: sector.weight >= 10 ? 96 : 76,
              background: tileBackground(sector.changePercent, sector.hasPrice),
            }}
          >
            <span className="font-mono text-[0.65rem] uppercase tracking-[0.12em] text-foreground/80">
              {sector.symbol}
            </span>
            <span className="mt-1 font-display text-[1.1rem] font-medium leading-tight text-foreground">
              {sector.name}
            </span>
            <span
              className={cn(
                "mt-1 font-mono text-[0.78rem] font-medium tabular-nums",
                sector.hasPrice ? "text-foreground" : "text-muted-foreground",
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
