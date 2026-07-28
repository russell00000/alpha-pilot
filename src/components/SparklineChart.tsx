import { useId } from "react";

interface SparklineChartProps {
  data: number[];
  positive: boolean;
  /** When true, the line draws itself in over 0.8s with a spring curve. */
  animate?: boolean;
}

const normalizeSeries = (series: number[]) => {
  const min = Math.min(...series);
  const max = Math.max(...series);

  if (max - min < 0.0001) {
    return series.map((_, i) => ({ x: i, y: 50 }));
  }

  const padding = (max - min) * 0.12;
  const lo = min - padding;
  const hi = max + padding;

  return series.map((v, i) => ({ x: i, y: ((v - lo) / (hi - lo)) * 100 }));
};

// Catmull-Rom to Bezier for a smooth line through every data point
const buildSmoothPath = (pts: { x: number; y: number }[]): string => {
  if (pts.length === 0) return "";
  if (pts.length === 1) return `M ${pts[0].x},${pts[0].y}`;
  let d = `M ${pts[0].x.toFixed(2)},${pts[0].y.toFixed(2)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${cp1x.toFixed(2)},${cp1y.toFixed(2)} ${cp2x.toFixed(2)},${cp2y.toFixed(2)} ${p2.x.toFixed(2)},${p2.y.toFixed(2)}`;
  }
  return d;
};

const SparklineChart = ({ data, positive, animate = false }: SparklineChartProps) => {
  const uid = useId().replace(/:/g, "");
  if (!data || data.length === 0) return null;

  const width = 480;
  const height = 120;
  const normalized = normalizeSeries(data);
  const pts = normalized.map((p, i) => ({
    x: normalized.length === 1 ? width / 2 : (i / (normalized.length - 1)) * width,
    y: height - (p.y / 100) * height,
  }));

  const strokeColor = positive ? "hsl(var(--success))" : "hsl(var(--destructive))";
  const linePath = buildSmoothPath(pts);
  const areaPath = `${linePath} L ${pts[pts.length - 1].x.toFixed(2)},${height} L ${pts[0].x.toFixed(2)},${height} Z`;
  const lastPt = pts[pts.length - 1];

  // Horizontal reference gridlines for extra depth
  const gridYs = [0.2, 0.4, 0.6, 0.8].map((f) => height * f);
  // Baseline (starting value) as dashed guide
  const baselineY = pts[0].y;

  const gradId = `spark-grad-${uid}`;
  const glowId = `spark-glow-${uid}`;
  const clipId = `spark-clip-${uid}`;

  // Rough path length estimate for the stroke-dash animation. Chords are a
  // safe upper bound for the smoothed curve.
  const pathLen = pts.reduce((acc, p, i) => {
    if (i === 0) return 0;
    const dx = p.x - pts[i - 1].x;
    const dy = p.y - pts[i - 1].y;
    return acc + Math.sqrt(dx * dx + dy * dy);
  }, 0) || width;
  const drawStyle = animate
    ? ({ ["--dash-len" as any]: pathLen } as React.CSSProperties)
    : undefined;
  const lineClass = animate ? "animate-draw-line" : "";
  const fillClass = animate ? "animate-fill-in" : "";

  // Compute min/max points for extra detail markers
  let minIdx = 0;
  let maxIdx = 0;
  for (let i = 1; i < data.length; i++) {
    if (data[i] < data[minIdx]) minIdx = i;
    if (data[i] > data[maxIdx]) maxIdx = i;
  }

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="h-10 w-full overflow-visible"
      preserveAspectRatio="none"
      shapeRendering="geometricPrecision"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradId} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={strokeColor} stopOpacity="0.35" />
          <stop offset="60%" stopColor={strokeColor} stopOpacity="0.08" />
          <stop offset="100%" stopColor={strokeColor} stopOpacity="0" />
        </linearGradient>
        <filter id={glowId} x="-20%" y="-40%" width="140%" height="180%">
          <feGaussianBlur stdDeviation="1.6" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* subtle grid */}
      {gridYs.map((y, i) => (
        <line
          key={i}
          x1="0"
          x2={width}
          y1={y}
          y2={y}
          stroke="hsl(var(--muted-foreground))"
          strokeOpacity="0.07"
          strokeWidth="0.5"
          vectorEffect="non-scaling-stroke"
        />
      ))}

      {/* baseline (open) reference */}
      <line
        x1="0"
        x2={width}
        y1={baselineY}
        y2={baselineY}
        stroke={strokeColor}
        strokeOpacity="0.28"
        strokeDasharray="3 4"
        strokeWidth="0.7"
        vectorEffect="non-scaling-stroke"
      />

      {/* area fill */}
      <path d={areaPath} fill={`url(#${gradId})`} className={fillClass} />

      {/* soft glow underlay */}
      <path
        d={linePath}
        fill="none"
        stroke={strokeColor}
        strokeOpacity="0.35"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
        filter={`url(#${glowId})`}
        className={lineClass}
        style={drawStyle}
      />

      {/* crisp main line */}
      <path
        d={linePath}
        fill="none"
        stroke={strokeColor}
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
        className={lineClass}
        style={drawStyle}
      />

      {/* per-point micro ticks for granular detail */}
      {pts.length <= 260 &&
        pts.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r="0.7"
            fill={strokeColor}
            fillOpacity="0.55"
          />
        ))}

      {/* min/max markers */}
      {pts.length > 3 && (
        <>
          <circle
            cx={pts[maxIdx].x}
            cy={pts[maxIdx].y}
            r="1.6"
            fill="hsl(var(--background))"
            stroke={strokeColor}
            strokeWidth="0.9"
            vectorEffect="non-scaling-stroke"
          />
          <circle
            cx={pts[minIdx].x}
            cy={pts[minIdx].y}
            r="1.6"
            fill="hsl(var(--background))"
            stroke={strokeColor}
            strokeOpacity="0.6"
            strokeWidth="0.9"
            vectorEffect="non-scaling-stroke"
          />
        </>
      )}

      {/* end-point dot with pulse ring */}
      <circle cx={lastPt.x} cy={lastPt.y} r="2.6" fill={strokeColor} />
      <circle
        cx={lastPt.x}
        cy={lastPt.y}
        r="5"
        fill="none"
        stroke={strokeColor}
        strokeOpacity="0.45"
        strokeWidth="0.9"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
};

export default SparklineChart;
