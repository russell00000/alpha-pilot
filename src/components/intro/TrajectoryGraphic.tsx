import { useId } from "react";

/**
 * Portfolio trajectory — one identical inline-SVG visualization across every age
 * tile. Only the curve shape changes to communicate relative risk/growth. All
 * geometry is vector, so it stays razor sharp on high-DPI displays.
 *
 * Layers: reference grid → secondary comparison curve → area fill → primary
 * metallic gold trajectory → endpoint marker.
 */

export type VizVariant = "growth" | "donut" | "bars" | "area" | "stable" | "shield";
export type Slice = { label: string; pct: number };

const W = 200;
const H = 88;
const PAD_X = W * 0.05; // curve spans ~90% of the width
const TOP = 8;
const BOTTOM = H - 9;

const GOLD = "#D9B970";
const GOLD_BRIGHT = "#F2DFAE";

/** 7 intentional anchor points per variant, 0 (low) → 100 (high) */
const CURVES: Record<VizVariant, number[]> = {
  growth: [8, 22, 16, 44, 38, 72, 96],
  donut: [12, 26, 34, 48, 58, 76, 92],
  bars: [20, 30, 27, 42, 50, 60, 72],
  area: [26, 34, 38, 44, 50, 56, 64],
  stable: [34, 38, 37, 42, 44, 48, 52],
  shield: [40, 42, 41, 43, 44, 45, 48],
};

/** the quieter benchmark curve sitting behind the primary line */
const SHADOW_CURVES: Record<VizVariant, number[]> = {
  growth: [6, 14, 20, 28, 34, 46, 60],
  donut: [8, 16, 22, 30, 38, 48, 60],
  bars: [14, 20, 24, 30, 36, 42, 50],
  area: [20, 25, 29, 33, 37, 42, 47],
  stable: [28, 30, 32, 34, 36, 38, 40],
  shield: [34, 35, 36, 36, 37, 38, 39],
};

const toPoints = (vals: number[]) =>
  vals.map((v, i) => ({
    x: PAD_X + (i / (vals.length - 1)) * (W - PAD_X * 2),
    y: BOTTOM - (v / 100) * (BOTTOM - TOP),
  }));

/** Catmull-Rom → cubic Bézier: smooth, controlled, never jagged */
const toPath = (pts: { x: number; y: number }[]) => {
  let d = `M${pts[0].x.toFixed(2)},${pts[0].y.toFixed(2)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C${c1x.toFixed(2)},${c1y.toFixed(2)} ${c2x.toFixed(2)},${c2y.toFixed(2)} ${p2.x.toFixed(2)},${p2.y.toFixed(2)}`;
  }
  return d;
};

const GRID_Y = [0.26, 0.5, 0.74].map((f) => TOP + (BOTTOM - TOP) * f);
const GRID_X = [0.32, 0.64].map((f) => PAD_X + (W - PAD_X * 2) * f);

const TrajectoryGraphic = ({ variant }: { variant: VizVariant }) => {
  const uid = useId().replace(/[:]/g, "");
  const pts = toPoints(CURVES[variant]);
  const line = toPath(pts);
  const ghost = toPath(toPoints(SHADOW_CURVES[variant]));
  const area = `${line} L${pts[pts.length - 1].x.toFixed(2)},${BOTTOM} L${pts[0].x.toFixed(2)},${BOTTOM} Z`;
  const end = pts[pts.length - 1];

  const fillId = `tj-fill-${uid}`;
  const strokeId = `tj-stroke-${uid}`;
  const lightId = `tj-light-${uid}`;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="block h-full w-full"
      preserveAspectRatio="none"
      shapeRendering="geometricPrecision"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={fillId} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={GOLD_BRIGHT} stopOpacity="0.2" />
          <stop offset="55%" stopColor={GOLD} stopOpacity="0.07" />
          <stop offset="100%" stopColor={GOLD} stopOpacity="0" />
        </linearGradient>
        <linearGradient id={strokeId} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0%" stopColor="#B9974F" />
          <stop offset="42%" stopColor={GOLD} />
          <stop offset="72%" stopColor={GOLD_BRIGHT} />
          <stop offset="100%" stopColor={GOLD} />
        </linearGradient>
        <radialGradient id={lightId} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0%" stopColor="#F3E2B4" stopOpacity="0.16" />
          <stop offset="100%" stopColor="#F3E2B4" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* contained warm reflection catching the upper-right of the glass */}
      <ellipse cx={W * 0.78} cy={H * 0.16} rx={W * 0.34} ry={H * 0.46} fill={`url(#${lightId})`} />

      {/* reference grid — hairlines only, no axis, no labels */}
      <g stroke="#FFFFFF" strokeWidth="0.5" vectorEffect="non-scaling-stroke">
        {GRID_Y.map((y) => (
          <line key={y} x1={PAD_X} x2={W - PAD_X} y1={y} y2={y} strokeOpacity="0.06" />
        ))}
        {GRID_X.map((x) => (
          <line key={x} x1={x} x2={x} y1={TOP} y2={BOTTOM} strokeOpacity="0.035" />
        ))}
      </g>

      {/* secondary comparison curve */}
      <path
        d={ghost}
        fill="none"
        stroke="#E4D6BC"
        strokeOpacity="0.13"
        strokeWidth="0.9"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />

      {/* champagne area fill beneath the trajectory */}
      <path d={area} fill={`url(#${fillId})`} />

      {/* primary metallic trajectory */}
      <path
        d={line}
        fill="none"
        stroke={`url(#${strokeId})`}
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />

      {/* endpoint marker — bright champagne core, tight halo */}
      <circle cx={end.x} cy={end.y} r="3.1" fill={GOLD_BRIGHT} fillOpacity="0.14" />
      <circle cx={end.x} cy={end.y} r="1.7" fill={GOLD_BRIGHT} />
      <circle
        cx={end.x}
        cy={end.y}
        r="1.7"
        fill="none"
        stroke="#FFF6E0"
        strokeOpacity="0.5"
        strokeWidth="0.6"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
};

export default TrajectoryGraphic;