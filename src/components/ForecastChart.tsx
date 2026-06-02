import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export interface ForecastIndicators {
  return1Y?: number | null;
  cagr3Y?: number | null;
  cagr5Y?: number | null;
  annualVol?: number | null;
  maxDrawdown?: number | null;
  sharpe?: number | null;
  rsi14?: number | null;
  trend?: string;
  forwardPE?: string;
  earningsGrowth?: string;
  revenueGrowth?: string;
  targetMean?: number | null;
  numAnalysts?: number | null;
  upgradesLast90d?: number | null;
  downgradesLast90d?: number | null;
  sector?: string;
}

export interface ForecastData {
  symbol: string;
  name: string;
  currentPrice: number;
  base: number;
  bull: number;
  bear: number;
  confidence: "High" | "Medium" | "Low" | string;
  indicators: ForecastIndicators;
}

const fmtPct = (v?: number | null, d = 1) =>
  v == null || !isFinite(v) ? "—" : `${v >= 0 ? "+" : ""}${v.toFixed(d)}%`;
const fmtNum = (v?: number | null, d = 2) =>
  v == null || !isFinite(v) ? "—" : v.toFixed(d);

function buildSeries(f: ForecastData) {
  // 13 monthly points (M0..M12) with linear interpolation between current and target.
  const points = [];
  for (let m = 0; m <= 12; m++) {
    const t = m / 12;
    points.push({
      month: m === 0 ? "Now" : `M${m}`,
      base: +(f.currentPrice + (f.base - f.currentPrice) * t).toFixed(2),
      bull: +(f.currentPrice + (f.bull - f.currentPrice) * t).toFixed(2),
      bear: +(f.currentPrice + (f.bear - f.currentPrice) * t).toFixed(2),
    });
  }
  return points;
}

const confidenceColor = (c: string) =>
  c === "High"
    ? "text-success border-success/30 bg-success/10"
    : c === "Medium"
      ? "text-foreground border-white/20 bg-white/[0.06]"
      : "text-muted-foreground border-white/10 bg-white/[0.03]";

export function ForecastChart({ forecast }: { forecast: ForecastData }) {
  const data = buildSeries(forecast);
  const ind = forecast.indicators;
  const upsideBase = ((forecast.base - forecast.currentPrice) / forecast.currentPrice) * 100;
  const upsideBull = ((forecast.bull - forecast.currentPrice) / forecast.currentPrice) * 100;
  const upsideBear = ((forecast.bear - forecast.currentPrice) / forecast.currentPrice) * 100;

  return (
    <div className="mt-3 rounded-xl border border-white/[0.08] bg-black/30 backdrop-blur-sm p-3 space-y-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-bold text-foreground tracking-wide">
            {forecast.symbol}{" "}
            <span className="text-muted-foreground font-normal">· 12-Mo Forecast</span>
          </p>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            Now ${forecast.currentPrice.toFixed(2)}
            {ind.sector ? ` · ${ind.sector}` : ""}
          </p>
        </div>
        <span
          className={`text-[9px] uppercase tracking-[0.15em] font-bold px-2 py-1 rounded-md border ${confidenceColor(
            forecast.confidence,
          )}`}
        >
          {forecast.confidence} confidence
        </span>
      </div>

      {/* Target pills */}
      <div className="grid grid-cols-3 gap-1.5">
        <div className="rounded-lg border border-success/20 bg-success/5 px-2 py-1.5">
          <p className="text-[9px] uppercase tracking-wider text-success/80 font-bold">Bull</p>
          <p className="text-sm font-bold text-foreground font-mono">${forecast.bull.toFixed(2)}</p>
          <p className="text-[10px] text-success">{fmtPct(upsideBull)}</p>
        </div>
        <div className="rounded-lg border border-white/20 bg-white/[0.06] px-2 py-1.5">
          <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-bold">Base</p>
          <p className="text-sm font-bold text-foreground font-mono">${forecast.base.toFixed(2)}</p>
          <p className={`text-[10px] ${upsideBase >= 0 ? "text-success" : "text-destructive"}`}>
            {fmtPct(upsideBase)}
          </p>
        </div>
        <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-2 py-1.5">
          <p className="text-[9px] uppercase tracking-wider text-destructive/80 font-bold">Bear</p>
          <p className="text-sm font-bold text-foreground font-mono">${forecast.bear.toFixed(2)}</p>
          <p className="text-[10px] text-destructive">{fmtPct(upsideBear)}</p>
        </div>
      </div>

      {/* Chart */}
      <div className="h-40 -mx-1">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id={`band-${forecast.symbol}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(var(--success))" stopOpacity={0.18} />
                <stop offset="100%" stopColor="hsl(var(--destructive))" stopOpacity={0.18} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.15} />
            <XAxis
              dataKey="month"
              tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }}
              axisLine={false}
              tickLine={false}
              interval={1}
            />
            <YAxis
              tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }}
              axisLine={false}
              tickLine={false}
              domain={["auto", "auto"]}
              width={42}
              tickFormatter={(v) => `$${Number(v).toFixed(0)}`}
            />
            <Tooltip
              contentStyle={{
                background: "hsl(var(--background))",
                border: "1px solid hsl(var(--border))",
                borderRadius: 8,
                fontSize: 11,
              }}
              formatter={(value: number, name: string) => [`$${value.toFixed(2)}`, name]}
            />
            {/* Confidence band: bull (upper) - bear (lower) area */}
            <Area
              type="monotone"
              dataKey="bull"
              stroke="hsl(var(--success))"
              strokeWidth={1}
              strokeDasharray="3 3"
              fill={`url(#band-${forecast.symbol})`}
              fillOpacity={1}
              name="Bull"
            />
            <Area
              type="monotone"
              dataKey="bear"
              stroke="hsl(var(--destructive))"
              strokeWidth={1}
              strokeDasharray="3 3"
              fill="hsl(var(--background))"
              fillOpacity={1}
              name="Bear"
            />
            <Line
              type="monotone"
              dataKey="base"
              stroke="hsl(var(--foreground))"
              strokeWidth={2}
              dot={false}
              name="Base"
            />
            <ReferenceLine
              y={forecast.currentPrice}
              stroke="hsl(var(--muted-foreground))"
              strokeDasharray="2 4"
              strokeOpacity={0.5}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Key indicators */}
      <div className="grid grid-cols-4 gap-1.5 text-[10px]">
        <Indicator label="1Y" value={fmtPct(ind.return1Y)} tone={signedTone(ind.return1Y)} />
        <Indicator label="3Y CAGR" value={fmtPct(ind.cagr3Y)} tone={signedTone(ind.cagr3Y)} />
        <Indicator label="Vol" value={fmtPct(ind.annualVol)} />
        <Indicator label="Max DD" value={fmtPct(ind.maxDrawdown)} tone="text-destructive" />
        <Indicator label="Sharpe" value={fmtNum(ind.sharpe, 2)} tone={signedTone(ind.sharpe)} />
        <Indicator label="RSI" value={fmtNum(ind.rsi14, 0)} tone={rsiTone(ind.rsi14)} />
        <Indicator label="Fwd P/E" value={ind.forwardPE ?? "—"} />
        <Indicator label="EPS Gr" value={ind.earningsGrowth ?? "—"} />
      </div>

      {/* Trend + analyst signals */}
      <div className="flex flex-wrap gap-1.5 text-[9px] uppercase tracking-wider">
        {ind.trend && (
          <span className="px-2 py-1 rounded-md bg-white/[0.04] border border-white/[0.08] text-muted-foreground">
            {ind.trend}
          </span>
        )}
        {ind.numAnalysts ? (
          <span className="px-2 py-1 rounded-md bg-white/[0.04] border border-white/[0.08] text-muted-foreground">
            {ind.numAnalysts} analysts
          </span>
        ) : null}
        {(ind.upgradesLast90d ?? 0) > 0 && (
          <span className="px-2 py-1 rounded-md bg-success/10 border border-success/20 text-success">
            ▲ {ind.upgradesLast90d} upgrades 90d
          </span>
        )}
        {(ind.downgradesLast90d ?? 0) > 0 && (
          <span className="px-2 py-1 rounded-md bg-destructive/10 border border-destructive/20 text-destructive">
            ▼ {ind.downgradesLast90d} downgrades 90d
          </span>
        )}
      </div>
    </div>
  );
}

function Indicator({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-md bg-white/[0.03] border border-white/[0.06] px-1.5 py-1">
      <p className="text-muted-foreground/70 font-semibold uppercase tracking-wider text-[8px]">
        {label}
      </p>
      <p className={`font-mono font-bold ${tone ?? "text-foreground"}`}>{value}</p>
    </div>
  );
}

function signedTone(v?: number | null) {
  if (v == null || !isFinite(v)) return undefined;
  return v >= 0 ? "text-success" : "text-destructive";
}
function rsiTone(v?: number | null) {
  if (v == null) return undefined;
  if (v >= 70) return "text-destructive";
  if (v <= 30) return "text-success";
  return undefined;
}