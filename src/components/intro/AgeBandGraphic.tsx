/**
 * Miniature institutional-grade portfolio visualizations shown inside each
 * age-band questionnaire card. One variant per band — each one previews the
 * strategy that band unlocks. Deliberately low-contrast: these read as data,
 * not decoration.
 */

export type VizVariant = "growth" | "donut" | "bars" | "area" | "stable" | "shield";

export type Slice = { label: string; pct: number };

const ACCENT = "#9ed4ff";
const MUTED = "rgba(190, 214, 240, 0.42)";
const FAINT = "rgba(170, 200, 230, 0.2)";

/* deterministic series per variant — no randomness, so the cards never jitter */
const SERIES: Record<VizVariant, number[]> = {
  growth: [8, 12, 10, 18, 24, 22, 33, 40, 52, 61, 74, 92],
  donut: [30, 34, 31, 38, 42, 40, 47, 52, 56, 60, 65, 70],
  bars: [40, 44, 41, 48, 50, 53, 55, 58, 60, 63, 66, 68],
  area: [46, 48, 47, 52, 50, 55, 54, 58, 57, 61, 60, 64],
  stable: [52, 54, 53, 55, 54, 56, 55, 57, 56, 58, 57, 59],
  shield: [55, 56, 55, 56, 57, 56, 57, 57, 58, 57, 58, 58],
};

const W = 92;
const H = 40;

const toPoints = (vals: number[]) => {
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const span = max - min || 1;
  return vals.map((v, i) => ({
    x: (i / (vals.length - 1)) * W,
    y: H - 3 - ((v - min) / span) * (H - 8),
  }));
};

const toPath = (vals: number[]) =>
  toPoints(vals)
    .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(" ");

const Sparkline = ({ variant, fill }: { variant: VizVariant; fill?: boolean }) => {
  const vals = SERIES[variant];
  const d = toPath(vals);
  const last = toPoints(vals)[vals.length - 1];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-full w-full overflow-visible" aria-hidden>
      {/* faint axis lines */}
      <line x1="0" y1={H - 2} x2={W} y2={H - 2} stroke={FAINT} strokeWidth="0.5" />
      <line x1="0" y1={H / 2} x2={W} y2={H / 2} stroke={FAINT} strokeWidth="0.4" strokeDasharray="2 3" />
      {fill && (
        <path d={`${d} L${W},${H - 2} L0,${H - 2} Z`} fill="url(#viz-fill)" opacity="0.85" />
      )}
      <defs>
        <linearGradient id="viz-fill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={ACCENT} stopOpacity="0.28" />
          <stop offset="100%" stopColor={ACCENT} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path
        d={d}
        fill="none"
        stroke={ACCENT}
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="viz-draw"
        style={{ ["--viz-len" as string]: 240 }}
      />
      <circle cx={last.x} cy={last.y} r="1.5" fill={ACCENT} className="viz-tick" />
    </svg>
  );
};

const Donut = ({ slices, thin = false }: { slices: Slice[]; thin?: boolean }) => {
  const r = 15;
  const c = 2 * Math.PI * r;
  let offset = 0;
  const colors = [ACCENT, "rgba(206, 224, 242, 0.62)", MUTED, FAINT];
  return (
    <svg viewBox="0 0 40 40" className="h-full w-full" aria-hidden>
      <g className="viz-ring">
        <circle cx="20" cy="20" r={r} fill="none" stroke="rgba(160,195,230,0.12)" strokeWidth={thin ? 3 : 4.5} />
        {slices.map((s, i) => {
          const len = (s.pct / 100) * c;
          const el = (
            <circle
              key={s.label}
              cx="20"
              cy="20"
              r={r}
              fill="none"
              stroke={colors[i % colors.length]}
              strokeWidth={thin ? 3 : 4.5}
              strokeLinecap="butt"
              strokeDasharray={`${len.toFixed(2)} ${(c - len).toFixed(2)}`}
              strokeDashoffset={(-offset).toFixed(2)}
              transform="rotate(-90 20 20)"
              opacity={i === 0 ? 0.95 : 0.7}
            />
          );
          offset += len;
          return el;
        })}
      </g>
    </svg>
  );
};

const Bars = ({ slices }: { slices: Slice[] }) => {
  const max = Math.max(...slices.map((s) => s.pct));
  return (
    <svg viewBox="0 0 92 40" className="h-full w-full" aria-hidden>
      <line x1="0" y1="37.5" x2="92" y2="37.5" stroke={FAINT} strokeWidth="0.5" />
      {slices.map((s, i) => {
        const bw = 10;
        const gap = 6;
        const x = 4 + i * (bw + gap);
        const h = 4 + (s.pct / max) * 28;
        return (
          <rect
            key={s.label}
            x={x}
            y={37 - h}
            width={bw}
            height={h}
            rx="1"
            fill={i === 0 ? ACCENT : "rgba(200, 220, 240, 0.4)"}
            opacity={i === 0 ? 0.85 : 0.55}
          />
        );
      })}
    </svg>
  );
};

const Shield = () => (
  <svg viewBox="0 0 40 40" className="h-full w-full" aria-hidden>
    <g className="viz-ring">
      <circle cx="20" cy="20" r="15" fill="none" stroke="rgba(160,195,230,0.14)" strokeWidth="3" />
      <circle
        cx="20"
        cy="20"
        r="15"
        fill="none"
        stroke={ACCENT}
        strokeWidth="3"
        strokeDasharray="56.5 37.7"
        transform="rotate(-90 20 20)"
        opacity="0.85"
      />
    </g>
    <path
      d="M20 11.5l6 2.2v5.1c0 3.6-2.4 6.6-6 7.7-3.6-1.1-6-4.1-6-7.7v-5.1l6-2.2z"
      fill="none"
      stroke={ACCENT}
      strokeWidth="1"
      opacity="0.7"
    />
  </svg>
);

const AgeBandGraphic = ({ variant, slices }: { variant: VizVariant; slices: Slice[] }) => {
  const body = (() => {
    switch (variant) {
      case "growth":
        return (
          <div className="relative h-[42px] w-[92px]">
            <Sparkline variant="growth" fill />
            <svg viewBox="0 0 10 10" className="absolute -right-1 -top-1 h-2.5 w-2.5" aria-hidden>
              <path d="M2 8L8 2M8 2H4.4M8 2v3.6" stroke={ACCENT} strokeWidth="1.2" fill="none" strokeLinecap="round" />
            </svg>
          </div>
        );
      case "donut":
        return (
          <div className="flex h-[42px] items-center gap-2">
            <div className="h-[42px] w-[42px]">
              <Donut slices={slices} />
            </div>
            <div className="h-[26px] w-[42px] opacity-80">
              <Sparkline variant="donut" />
            </div>
          </div>
        );
      case "bars":
        return (
          <div className="h-[42px] w-[92px]">
            <Bars slices={slices} />
          </div>
        );
      case "area":
        return (
          <div className="h-[42px] w-[92px]">
            <Sparkline variant="area" fill />
          </div>
        );
      case "stable":
        return (
          <div className="flex h-[42px] items-center gap-2">
            <div className="h-[34px] w-[56px]">
              <Sparkline variant="stable" />
            </div>
            <div className="h-[34px] w-[34px]">
              <Donut slices={slices} thin />
            </div>
          </div>
        );
      case "shield":
        return (
          <div className="flex h-[42px] items-center gap-2">
            <div className="h-[38px] w-[38px]">
              <Shield />
            </div>
            <div className="h-[30px] w-[46px] opacity-75">
              <Sparkline variant="shield" />
            </div>
          </div>
        );
    }
  })();

  return (
    <div className="pointer-events-none relative z-[2]">
      <span aria-hidden className="viz-bloom" />
      <div className="relative">
        {body}
        <span
          aria-hidden
          className="viz-shimmer pointer-events-none absolute inset-y-0 left-0 w-1/2 mix-blend-screen"
          style={{
            background:
              "linear-gradient(90deg, transparent 0%, rgba(214,241,255,0.18) 50%, transparent 100%)",
          }}
        />
      </div>
    </div>
  );
};

export default AgeBandGraphic;