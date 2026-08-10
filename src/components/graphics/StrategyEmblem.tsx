import { useId } from "react";

/**
 * Strategy emblems — abstract, metallic, purpose-built marks for the six
 * investor profiles. Pure vector: orbital growth geometry, an interlocking
 * lattice, a segmented spectrum, a layered envelope, a stability ring and a
 * vault. No icon-library glyphs, no cartoon shapes.
 */

export type EmblemKind = "orbital" | "lattice" | "spectrum" | "envelope" | "stability" | "vault";

const GOLD_LIGHT = "#F0DCB2";
const GOLD = "#E2C27A";
const GOLD_MID = "#C89B3C";
const GOLD_DEEP = "#A77626";

const S = 72; // square viewBox — every emblem shares identical optical weight

const StrategyEmblem = ({ kind, className = "" }: { kind: EmblemKind; className?: string }) => {
  const uid = useId().replace(/[:]/g, "");
  const metal = `em-metal-${uid}`;
  const sheen = `em-sheen-${uid}`;
  const glass = `em-glass-${uid}`;

  const hair = { stroke: "#FFFFFF", strokeOpacity: 0.09, strokeWidth: 0.6 } as const;

  return (
    <svg
      viewBox={`0 0 ${S} ${S}`}
      className={`block ${className}`}
      shapeRendering="geometricPrecision"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={metal} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={GOLD_LIGHT} />
          <stop offset="38%" stopColor={GOLD} />
          <stop offset="68%" stopColor={GOLD_MID} />
          <stop offset="100%" stopColor={GOLD_LIGHT} />
        </linearGradient>
        <linearGradient id={sheen} x1="0" y1="1" x2="1" y2="0">
          <stop offset="0%" stopColor={GOLD_DEEP} stopOpacity="0.5" />
          <stop offset="50%" stopColor={GOLD_LIGHT} stopOpacity="0.95" />
          <stop offset="100%" stopColor={GOLD_MID} stopOpacity="0.55" />
        </linearGradient>
        <radialGradient id={glass} cx="0.42" cy="0.3" r="0.7">
          <stop offset="0%" stopColor="#FFF6E2" stopOpacity="0.13" />
          <stop offset="100%" stopColor="#FFF6E2" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* shared plinth: hairline containing circle + soft key light */}
      <circle cx={S / 2} cy={S / 2} r={31} fill={`url(#${glass})`} />
      <circle cx={S / 2} cy={S / 2} r={31} fill="none" {...hair} vectorEffect="non-scaling-stroke" />
      <circle
        cx={S / 2}
        cy={S / 2}
        r={31}
        fill="none"
        stroke={`url(#${sheen})`}
        strokeOpacity="0.28"
        strokeWidth="0.8"
        strokeDasharray="34 120"
        vectorEffect="non-scaling-stroke"
      />

      {kind === "orbital" && (
        <g>
          {/* two tilted orbits + a rising vector: compounding runway */}
          <ellipse
            cx={36}
            cy={36}
            rx={23}
            ry={9}
            fill="none"
            stroke={`url(#${metal})`}
            strokeOpacity="0.55"
            strokeWidth="1"
            transform="rotate(-24 36 36)"
            vectorEffect="non-scaling-stroke"
          />
          <ellipse
            cx={36}
            cy={36}
            rx={23}
            ry={9}
            fill="none"
            stroke={`url(#${metal})`}
            strokeOpacity="0.28"
            strokeWidth="0.9"
            transform="rotate(28 36 36)"
            vectorEffect="non-scaling-stroke"
          />
          <path
            d="M17 49 C27 47 30 38 36 31 C41 25 47 22 55 19"
            fill="none"
            stroke={`url(#${sheen})`}
            strokeWidth="1.7"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
          <circle cx={55} cy={19} r="2.4" fill={GOLD_LIGHT} />
          <circle cx={55} cy={19} r="5" fill="none" stroke={GOLD} strokeOpacity="0.3" strokeWidth="0.7" vectorEffect="non-scaling-stroke" />
        </g>
      )}

      {kind === "lattice" && (
        <g>
          {/* interlocking squares — balance through structure */}
          <rect
            x={19}
            y={19}
            width={24}
            height={24}
            fill="none"
            stroke={`url(#${metal})`}
            strokeOpacity="0.72"
            strokeWidth="1.1"
            transform="rotate(-12 36 36)"
            vectorEffect="non-scaling-stroke"
          />
          <rect
            x={29}
            y={29}
            width={24}
            height={24}
            fill="none"
            stroke={`url(#${sheen})`}
            strokeOpacity="0.55"
            strokeWidth="1.1"
            transform="rotate(14 36 36)"
            vectorEffect="non-scaling-stroke"
          />
          <line x1={22} y1={50} x2={50} y2={22} stroke={GOLD} strokeOpacity="0.32" strokeWidth="0.7" vectorEffect="non-scaling-stroke" />
          <circle cx={36} cy={36} r="2.1" fill={GOLD_LIGHT} />
        </g>
      )}

      {kind === "spectrum" && (
        <g>
          {/* segmented sector spectrum — diversification */}
          {[0, 1, 2, 3, 4, 5].map((i) => {
            const h = 8 + [10, 20, 14, 26, 18, 12][i];
            const x = 15 + i * 7.4;
            return (
              <rect
                key={i}
                x={x}
                y={50 - h}
                width={3.4}
                height={h}
                rx={1.7}
                fill={i === 3 ? `url(#${sheen})` : `url(#${metal})`}
                fillOpacity={i === 3 ? 1 : 0.4 + i * 0.045}
              />
            );
          })}
          <line x1={13} y1={51.6} x2={59} y2={51.6} stroke={GOLD} strokeOpacity="0.34" strokeWidth="0.7" vectorEffect="non-scaling-stroke" />
        </g>
      )}

      {kind === "envelope" && (
        <g>
          {/* risk envelope — a base path inside a narrowing band */}
          <path
            d="M15 44 C24 40 28 33 36 30 C44 27 50 25 57 22 L57 30 C50 32 44 34 36 37 C28 40 24 45 15 49 Z"
            fill={`url(#${metal})`}
            fillOpacity="0.13"
          />
          <path
            d="M15 46 C24 42 28 35 36 32 C44 29 50 27 57 25"
            fill="none"
            stroke={`url(#${sheen})`}
            strokeWidth="1.6"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
          <path
            d="M15 51 C24 48 28 43 36 40 C44 37 50 34 57 31"
            fill="none"
            stroke={GOLD}
            strokeOpacity="0.3"
            strokeWidth="0.8"
            strokeDasharray="3 3"
            vectorEffect="non-scaling-stroke"
          />
          <circle cx={57} cy={25} r="2.1" fill={GOLD_LIGHT} />
        </g>
      )}

      {kind === "stability" && (
        <g>
          {/* concentric stability rings with one weighted arc */}
          <circle cx={36} cy={36} r={19} fill="none" stroke={GOLD} strokeOpacity="0.2" strokeWidth="0.8" vectorEffect="non-scaling-stroke" />
          <circle cx={36} cy={36} r={13} fill="none" stroke={GOLD} strokeOpacity="0.16" strokeWidth="0.8" vectorEffect="non-scaling-stroke" />
          <path
            d="M36 17 A19 19 0 0 1 53 45"
            fill="none"
            stroke={`url(#${sheen})`}
            strokeWidth="2"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
          <line x1={20} y1={36} x2={52} y2={36} stroke={GOLD_LIGHT} strokeOpacity="0.5" strokeWidth="0.9" vectorEffect="non-scaling-stroke" />
          <circle cx={36} cy={36} r="2.2" fill={GOLD_LIGHT} />
        </g>
      )}

      {kind === "vault" && (
        <g>
          {/* vault geometry — protection, machined */}
          <path
            d="M36 15 L54 24 L54 42 L36 55 L18 42 L18 24 Z"
            fill={`url(#${metal})`}
            fillOpacity="0.1"
            stroke={`url(#${metal})`}
            strokeOpacity="0.62"
            strokeWidth="1.1"
            vectorEffect="non-scaling-stroke"
          />
          <circle cx={36} cy={35} r={9} fill="none" stroke={`url(#${sheen})`} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
          <line x1={36} y1={22} x2={36} y2={26} stroke={GOLD_LIGHT} strokeOpacity="0.6" strokeWidth="1" vectorEffect="non-scaling-stroke" />
          <line x1={36} y1={44} x2={36} y2={48} stroke={GOLD_LIGHT} strokeOpacity="0.45" strokeWidth="1" vectorEffect="non-scaling-stroke" />
          <line x1={23} y1={35} x2={27} y2={35} stroke={GOLD_LIGHT} strokeOpacity="0.45" strokeWidth="1" vectorEffect="non-scaling-stroke" />
          <line x1={45} y1={35} x2={49} y2={35} stroke={GOLD_LIGHT} strokeOpacity="0.45" strokeWidth="1" vectorEffect="non-scaling-stroke" />
          <circle cx={36} cy={35} r="2" fill={GOLD_LIGHT} />
        </g>
      )}
    </svg>
  );
};

export default StrategyEmblem;