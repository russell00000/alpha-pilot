import { useId } from "react";

interface SparklineChartProps {
  data: number[];
  positive: boolean;
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

const SparklineChart = ({ data, positive }: SparklineChartProps) => {
  const uid = useId().replace(/:/g, "");
  if (!data || data.length === 0) return null;

  const width = 240;
  const height = 60;
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
  const gridYs = [0.25, 0.5, 0.75].map((f) => height * f);
  // Baseline (starting value) as dashed guide
  const baselineY = pts[0].y;

  const gradId = `spark-grad-${uid}`;
  const glowId = `spark-glow-${uid}`;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="h-10 w-full overflow-visible"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradId} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={strokeColor} stopOpacity="0.35" />
          <stop offset="60%" stopColor={strokeColor} stopOpacity="0.08" />
          <stop offset="100%" stopColor={strokeColor} stopOpacity="0" />
        </linearGradient>
        <filter id={glowId} x="-20%" y="-40%" width="140%" height="180%">
          <feGaussianBlur stdDeviation="1.1" result="blur" />
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
          strokeOpacity="0.08"
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
        strokeOpacity="0.25"
        strokeDasharray="2 3"
        strokeWidth="0.6"
        vectorEffect="non-scaling-stroke"
      />

      {/* area fill */}
      <path d={areaPath} fill={`url(#${gradId})`} />

      {/* main line with soft glow */}
      <path
        d={linePath}
        fill="none"
        stroke={strokeColor}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
        filter={`url(#${glowId})`}
      />

      {/* end-point dot with pulse ring */}
      <circle cx={lastPt.x} cy={lastPt.y} r="2.5" fill={strokeColor} />
      <circle
        cx={lastPt.x}
        cy={lastPt.y}
        r="4.5"
        fill="none"
        stroke={strokeColor}
        strokeOpacity="0.4"
        strokeWidth="0.8"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
};

export default SparklineChart;
