import { useId } from "react";

/**
 * Capital Composition — the homepage centerpiece. One architectural financial
 * visualization: a dimensional allocation ring, layered market curves inside a
 * risk envelope, and a hairline reference frame. Entirely vector so it stays
 * razor-sharp at any pixel density.
 */

const W = 720;
const H = 460;

const GOLD_LIGHT = "#F0DCB2";
const GOLD = "#E2C27A";
const GOLD_MID = "#C89B3C";
const GOLD_DEEP = "#A77626";

const curve = (vals: number[], x0: number, x1: number, yTop: number, yBot: number) => {
  const pts = vals.map((v, i) => ({
    x: x0 + (i / (vals.length - 1)) * (x1 - x0),
    y: yBot - (v / 100) * (yBot - yTop),
  }));
  let d = `M${pts[0].x.toFixed(2)},${pts[0].y.toFixed(2)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    d += ` C${(p1.x + (p2.x - p0.x) / 6).toFixed(2)},${(p1.y + (p2.y - p0.y) / 6).toFixed(2)} ${(p2.x - (p3.x - p1.x) / 6).toFixed(2)},${(p2.y - (p3.y - p1.y) / 6).toFixed(2)} ${p2.x.toFixed(2)},${p2.y.toFixed(2)}`;
  }
  return { d, pts };
};

const PRIMARY = [10, 20, 15, 34, 30, 48, 44, 66, 78, 92];
const BENCH = [8, 13, 18, 24, 27, 33, 38, 44, 50, 58];
const UPPER = [16, 27, 24, 43, 41, 59, 57, 78, 88, 100];
const LOWER = [5, 13, 9, 25, 21, 37, 33, 53, 66, 80];

/** allocation ring — arc lengths encode 62 / 24 / 9 / 5 */
const RING = [
  { pct: 62, color: GOLD, w: 7 },
  { pct: 24, color: GOLD_MID, w: 7 },
  { pct: 9, color: GOLD_DEEP, w: 7 },
  { pct: 5, color: "#8C8579", w: 7 },
];

const CapitalComposition = ({ className = "" }: { className?: string }) => {
  const uid = useId().replace(/[:]/g, "");
  const fill = `cc-fill-${uid}`;
  const stroke = `cc-stroke-${uid}`;
  const key = `cc-key-${uid}`;

  const x0 = 56;
  const x1 = W - 40;
  const yTop = 84;
  const yBot = H - 96;

  const main = curve(PRIMARY, x0, x1, yTop, yBot);
  const bench = curve(BENCH, x0, x1, yTop, yBot);
  const up = curve(UPPER, x0, x1, yTop, yBot);
  const lo = curve(LOWER, x0, x1, yTop, yBot);
  // envelope band: forward along the upper bound, back along the lower bound
  const band =
    `${up.d} ` +
    [...lo.pts].reverse().map((p) => `L${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" ") +
    " Z";
  const end = main.pts[main.pts.length - 1];

  // ring geometry
  const cx = 96;
  const cy = H - 74;
  const r = 34;
  const C = 2 * Math.PI * r;
  let acc = 0;

  const gridY = [0.25, 0.5, 0.75].map((f) => yTop + (yBot - yTop) * f);

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className={`block w-full ${className}`}
      shapeRendering="geometricPrecision"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={fill} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={GOLD_LIGHT} stopOpacity="0.1" />
          <stop offset="55%" stopColor={GOLD} stopOpacity="0.035" />
          <stop offset="100%" stopColor={GOLD} stopOpacity="0" />
        </linearGradient>
        <linearGradient id={stroke} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={GOLD_DEEP} />
          <stop offset="45%" stopColor={GOLD} />
          <stop offset="80%" stopColor={GOLD_LIGHT} />
          <stop offset="100%" stopColor={GOLD} />
        </linearGradient>
        <radialGradient id={key} cx="0.62" cy="0.16" r="0.62">
          <stop offset="0%" stopColor="#FFF4DC" stopOpacity="0.09" />
          <stop offset="100%" stopColor="#FFF4DC" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* single soft key light, upper right */}
      <ellipse cx={W * 0.64} cy={H * 0.16} rx={W * 0.34} ry={H * 0.34} fill={`url(#${key})`} />

      {/* hairline reference frame + grid */}
      <g stroke="#FFFFFF" strokeWidth="0.6" vectorEffect="non-scaling-stroke">
        {gridY.map((y) => (
          <line key={y} x1={x0} x2={x1} y1={y} y2={y} strokeOpacity="0.05" />
        ))}
        <line x1={x0} x2={x1} y1={yBot} y2={yBot} strokeOpacity="0.12" />
        <line x1={x0} x2={x0} y1={yTop - 18} y2={yBot} strokeOpacity="0.09" />
      </g>
      {/* axis ticks */}
      <g fill={GOLD} fillOpacity="0.4">
        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => (
          <rect key={i} x={x0 + (i / 9) * (x1 - x0) - 0.4} y={yBot + 4} width="0.8" height={i % 3 === 0 ? 7 : 4} />
        ))}
      </g>

      {/* risk envelope */}
      <path d={band} fill={GOLD} fillOpacity="0.035" />
      <path d={up.d} fill="none" stroke={GOLD} strokeOpacity="0.16" strokeWidth="0.8" strokeDasharray="4 5" vectorEffect="non-scaling-stroke" />
      <path d={lo.d} fill="none" stroke={GOLD} strokeOpacity="0.13" strokeWidth="0.8" strokeDasharray="4 5" vectorEffect="non-scaling-stroke" />

      {/* benchmark comparison */}
      <path d={bench.d} fill="none" stroke="#D8D2C6" strokeOpacity="0.16" strokeWidth="1" vectorEffect="non-scaling-stroke" />

      {/* primary trajectory */}
      <path d={`${main.d} L${end.x.toFixed(2)},${yBot} L${x0},${yBot} Z`} fill={`url(#${fill})`} className="animate-fill-in" />
      <path
        d={main.d}
        fill="none"
        stroke={`url(#${stroke})`}
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
        className="animate-draw-line"
        style={{ ["--dash-len" as string]: 1400 }}
      />
      <circle cx={end.x} cy={end.y} r="4.4" fill={GOLD_LIGHT} fillOpacity="0.16" />
      <circle cx={end.x} cy={end.y} r="2.3" fill={GOLD_LIGHT} />

      {/* dimensional allocation ring, lower left — the second focal layer */}
      <g>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#FFFFFF" strokeOpacity="0.05" strokeWidth="7" />
        {RING.map((seg, i) => {
          const len = (seg.pct / 100) * C;
          const dash = `${len - 3} ${C - len + 3}`;
          const offset = -(acc / 100) * C;
          acc += seg.pct;
          return (
            <circle
              key={i}
              cx={cx}
              cy={cy}
              r={r}
              fill="none"
              stroke={seg.color}
              strokeOpacity={i === 0 ? 0.95 : 0.55 - i * 0.08}
              strokeWidth={seg.w}
              strokeDasharray={dash}
              strokeDashoffset={offset}
              strokeLinecap="butt"
              transform={`rotate(-90 ${cx} ${cy})`}
            />
          );
        })}
        <circle cx={cx} cy={cy} r={r - 7} fill="none" stroke={GOLD} strokeOpacity="0.14" strokeWidth="0.6" vectorEffect="non-scaling-stroke" />
        <text
          x={cx}
          y={cy + 1}
          textAnchor="middle"
          fontFamily="'JetBrains Mono', monospace"
          fontSize="13"
          fill={GOLD_LIGHT}
          fillOpacity="0.92"
        >
          62
        </text>
        <text
          x={cx}
          y={cy + 13}
          textAnchor="middle"
          fontFamily="'JetBrains Mono', monospace"
          fontSize="7"
          letterSpacing="2"
          fill="#FFFFFF"
          fillOpacity="0.4"
        >
          EQUITY
        </text>
      </g>

      {/* capital-flow connectors from the ring into the curve */}
      <g stroke={GOLD} strokeOpacity="0.18" strokeWidth="0.7" vectorEffect="non-scaling-stroke" fill="none">
        <path d={`M${cx + r + 6} ${cy - 8} C${cx + 90} ${cy - 20} ${x1 - 210} ${yBot - 40} ${x1 - 150} ${yBot - 96}`} />
        <path d={`M${cx + r + 6} ${cy + 4} C${cx + 120} ${cy + 4} ${x1 - 260} ${yBot - 10} ${x1 - 90} ${yBot - 40}`} strokeOpacity="0.1" />
      </g>
    </svg>
  );
};

export default CapitalComposition;