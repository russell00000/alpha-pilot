import {
  Area,
  ComposedChart,
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
  driftAnnPct?: number | null;
  modelBandPct?: number | null;
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
  history?: Array<{ date: number; price: number }>;
  projection?: Array<{ t: number; date: number; base: number; bull: number; bear: number }>;
}

const fmtPct = (v?: number | null, d = 1) =>
  v == null || !isFinite(v) ? "—" : `${v >= 0 ? "+" : ""}${v.toFixed(d)}%`;
const fmtNum = (v?: number | null, d = 2) =>
  v == null || !isFinite(v) ? "—" : v.toFixed(d);

interface ChartPoint {
  date: number;            // unix seconds
  history?: number;        // historical close
  base?: number;           // projected base path
  bull?: number;           // upper band
  bear?: number;           // lower band
  bandLo?: number;         // bear value used for stacked area lo
  bandRange?: number;      // bull - bear, for stacked area on top of bandLo
}

function buildChartSeries(f: ForecastData): ChartPoint[] {
  const out: ChartPoint[] = [];
  // Historical segment
  if (f.history?.length) {
    for (const h of f.history) {
      out.push({ date: h.date, history: h.price });
    }
  }
  // Bridge point: last historical = first projection, so the lines visually connect.
  const proj = f.projection ?? [];
  if (proj.length) {
    const first = proj[0];
    // Replace/append the connector point: assign current price to base/bull/bear too.
    const lastHist = out[out.length - 1];
    if (lastHist) {
      lastHist.base = first.base;
      lastHist.bull = first.bull;
      lastHist.bear = first.bear;
      lastHist.bandLo = first.bear;
      lastHist.bandRange = first.bull - first.bear;
    }
    for (let i = 1; i < proj.length; i++) {
      const p = proj[i];
      out.push({
        date: p.date,
        base: p.base,
        bull: p.bull,
        bear: p.bear,
        bandLo: p.bear,
        bandRange: p.bull - p.bear,
      });
    }
  }
  return out;
}

const fmtDate = (sec: number) =>
  new Date(sec * 1000).toLocaleDateString("en-US", { month: "short", year: "2-digit" });
const fmtFullDate = (sec: number) =>
  new Date(sec * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

const confidenceColor = (c: string) =>
  c === "High"
    ? "text-success border-success/30 bg-success/10"
    : c === "Medium"
      ? "text-foreground border-white/20 bg-white/[0.06]"
      : "text-muted-foreground border-white/10 bg-white/[0.03]";

export function ForecastChart({ forecast }: { forecast: ForecastData }) {
  const data = buildChartSeries(forecast);
  const ind = forecast.indicators;
  const upsideBase = ((forecast.base - forecast.currentPrice) / forecast.currentPrice) * 100;
  const upsideBull = ((forecast.bull - forecast.currentPrice) / forecast.currentPrice) * 100;
  const upsideBear = ((forecast.bear - forecast.currentPrice) / forecast.currentPrice) * 100;
  // Find "now" divider: last point with history defined.
  const nowIdx = data.findIndex((d, i) => d.history != null && (data[i + 1]?.history == null));
  const nowDate = nowIdx >= 0 ? data[nowIdx].date : Date.now() / 1000;
  // Compute y-axis domain padded a touch.
  const allVals: number[] = [];
  for (const d of data) {
    if (d.history != null) allVals.push(d.history);
    if (d.bull != null) allVals.push(d.bull);
    if (d.bear != null) allVals.push(d.bear);
  }
  const yMin = Math.min(...allVals);
  const yMax = Math.max(...allVals);
  const yPad = (yMax - yMin) * 0.08;
  const symGrad = forecast.symbol.replace(/[^A-Za-z0-9]/g, "");

  return (
    <div className="mt-3 rounded-xl border border-white/[0.08] bg-black/30 backdrop-blur-sm p-4 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-bold text-foreground tracking-wide">
            {forecast.symbol}{" "}
            <span className="text-muted-foreground font-normal">· 12-Mo Forecast</span>
          </p>
          <p className="text-[10px] text-muted-foreground mt-0.5 font-mono">
            Spot ${forecast.currentPrice.toFixed(2)}
            {ind.driftAnnPct != null ? ` · Model drift ${fmtPct(ind.driftAnnPct)}` : ""}
            {ind.annualVol != null ? ` · σ ${ind.annualVol.toFixed(1)}%` : ""}
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
      <div className="h-64 -mx-1">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id={`hist-${symGrad}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(var(--foreground))" stopOpacity={0.35} />
                <stop offset="100%" stopColor="hsl(var(--foreground))" stopOpacity={0} />
              </linearGradient>
              <linearGradient id={`band-${symGrad}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(var(--success))" stopOpacity={0.22} />
                <stop offset="50%" stopColor="hsl(var(--primary))" stopOpacity={0.12} />
                <stop offset="100%" stopColor="hsl(var(--destructive))" stopOpacity={0.22} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.12} vertical={false} />
            <XAxis
              dataKey="date"
              type="number"
              scale="time"
              domain={["dataMin", "dataMax"]}
              tickFormatter={fmtDate}
              tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
              axisLine={false}
              tickLine={false}
              minTickGap={48}
            />
            <YAxis
              tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
              axisLine={false}
              tickLine={false}
              domain={[yMin - yPad, yMax + yPad]}
              width={48}
              tickFormatter={(v) => `$${Number(v).toFixed(yMax > 200 ? 0 : 1)}`}
              orientation="right"
            />
            <Tooltip
              contentStyle={{
                background: "hsl(var(--background))",
                border: "1px solid hsl(var(--border))",
                borderRadius: 8,
                fontSize: 11,
                padding: "8px 10px",
              }}
              labelFormatter={(v) => fmtFullDate(Number(v))}
              formatter={(value: number | string, name: string) => {
                if (value == null) return ["—", name];
                const label =
                  name === "history" ? "Actual" :
                  name === "base" ? "Projected (base)" :
                  name === "bull" ? "Bull band" :
                  name === "bear" ? "Bear band" :
                  name === "bandRange" ? null : name;
                if (!label) return ["", ""];
                return [`$${Number(value).toFixed(2)}`, label];
              }}
            />
            {/* Confidence band rendered as stacked area: invisible bandLo + visible bandRange */}
            <Area
              type="monotone"
              dataKey="bandLo"
              stackId="band"
              stroke="transparent"
              fill="transparent"
              isAnimationActive={false}
              activeDot={false}
            />
            <Area
              type="monotone"
              dataKey="bandRange"
              stackId="band"
              stroke="transparent"
              fill={`url(#band-${symGrad})`}
              fillOpacity={1}
              isAnimationActive={false}
              activeDot={false}
            />
            {/* Historical price (solid) with area gradient underneath */}
            <Area
              type="monotone"
              dataKey="history"
              stroke="hsl(var(--foreground))"
              strokeWidth={2}
              fill={`url(#hist-${symGrad})`}
              fillOpacity={1}
              dot={false}
              activeDot={{ r: 3 }}
              isAnimationActive={false}
              name="history"
            />
            {/* Projection lines (dashed) */}
            <Line
              type="monotone"
              dataKey="bull"
              stroke="hsl(var(--success))"
              strokeWidth={1.5}
              strokeDasharray="4 4"
              dot={false}
              isAnimationActive={false}
              name="bull"
            />
            <Line
              type="monotone"
              dataKey="bear"
              stroke="hsl(var(--destructive))"
              strokeWidth={1.5}
              strokeDasharray="4 4"
              dot={false}
              isAnimationActive={false}
              name="bear"
            />
            <Line
              type="monotone"
              dataKey="base"
              stroke="hsl(var(--primary))"
              strokeWidth={2.5}
              strokeDasharray="6 3"
              dot={false}
              isAnimationActive={false}
              name="base"
            />
            {/* "Now" divider */}
            <ReferenceLine
              x={nowDate}
              stroke="hsl(var(--muted-foreground))"
              strokeDasharray="3 3"
              strokeOpacity={0.6}
              label={{
                value: "Now",
                position: "top",
                fill: "hsl(var(--muted-foreground))",
                fontSize: 10,
              }}
            />
            <ReferenceLine
              y={forecast.currentPrice}
              stroke="hsl(var(--muted-foreground))"
              strokeDasharray="2 4"
              strokeOpacity={0.35}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-muted-foreground -mt-1">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-[2px] bg-foreground" /> Actual
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-[2px] bg-primary" style={{ borderTop: "2px dashed hsl(var(--primary))" }} /> Projected base
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-2 rounded-sm bg-gradient-to-b from-success/40 via-primary/20 to-destructive/40" />
          80% confidence band
        </span>
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