import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ArrowRight } from "lucide-react";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import cityBg from "@/assets/finance-bg.jpg";

const WORDS = ["Welcome", "to", "Vantage", "Portfolio", "Solutions"];

/** Rising zig-zag: 6 points, net upward. Percentages of the stage. */
const POINTS: Array<[number, number]> = [
  [3, 86],
  [22, 62],
  [40, 72],
  [58, 42],
  [76, 52],
  [97, 12],
];

/** Faint background "market" lines the arrow travels over. */
const GHOST_LINES: Array<Array<[number, number]>> = [
  [
    [0, 92], [12, 80], [24, 86], [36, 70], [48, 76], [60, 58], [72, 64], [84, 44], [100, 34],
  ],
  [
    [0, 70], [14, 66], [28, 74], [42, 56], [56, 62], [70, 40], [82, 48], [100, 22],
  ],
  [
    [0, 50], [16, 46], [30, 54], [46, 38], [62, 44], [78, 26], [92, 32], [100, 24],
  ],
];

const DRAW_MS = 5200;

/** Deterministic candlestick field behind the line (x%, base y%, body, wick). */
const CANDLES = Array.from({ length: 34 }).map((_, i) => {
  const s = Math.sin(i * 12.9898) * 43758.5453;
  const r1 = s - Math.floor(s);
  const s2 = Math.sin(i * 78.233) * 12765.723;
  const r2 = s2 - Math.floor(s2);
  const drift = 82 - i * 1.55;
  return {
    x: 1 + i * 2.95,
    y: drift + (r1 - 0.5) * 12,
    body: 3 + r2 * 9,
    wick: 7 + r1 * 13,
    up: r2 > 0.42,
  };
});

type Phase = "drawing" | "assembling" | "settled";

const LandingIntro = ({ onStart, onSkip }: { onStart: () => void; onSkip: () => void }) => {
  const reduced = useReducedMotion();
  const stageRef = useRef<HTMLDivElement>(null);
  const pathRef = useRef<SVGPolylineElement>(null);
  const glowRef = useRef<SVGPolylineElement>(null);
  const camRef = useRef<HTMLDivElement>(null);
  const wordRefs = useRef<Array<HTMLSpanElement | null>>([]);
  const [stage, setStage] = useState({ w: 0, h: 0 });
  const [phase, setPhase] = useState<Phase>(reduced ? "settled" : "drawing");
  const [visibleWords, setVisibleWords] = useState<number>(reduced ? WORDS.length : 0);
  /** Words that already had their moment on the line and have faded away. */
  const [fadedWords, setFadedWords] = useState<number>(0);
  const [tip, setTip] = useState({ x: 0, y: 0, angle: 0, show: !reduced });
  const fadeTimers = useRef<number[]>([]);

  useEffect(
    () => () => {
      fadeTimers.current.forEach((t) => clearTimeout(t));
    },
    []
  );

  useLayoutEffect(() => {
    const measure = () => {
      const el = stageRef.current;
      if (el) setStage({ w: el.clientWidth, h: el.clientHeight });
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  const px = useMemo(
    () => POINTS.map(([x, y]) => [(x / 100) * stage.w, (y / 100) * stage.h] as [number, number]),
    [stage.w, stage.h]
  );

  // Cumulative segment lengths → used for word timing and the arrowhead.
  const segments = useMemo(() => {
    const segs: Array<{ len: number; cum: number; angle: number }> = [];
    let cum = 0;
    for (let i = 1; i < px.length; i++) {
      const dx = px[i][0] - px[i - 1][0];
      const dy = px[i][1] - px[i - 1][1];
      const len = Math.hypot(dx, dy);
      cum += len;
      segs.push({ len, cum, angle: (Math.atan2(dy, dx) * 180) / Math.PI });
    }
    return segs;
  }, [px]);

  const total = segments.length ? segments[segments.length - 1].cum : 0;

  // Draw the line, pop words at each vertex, ride the arrowhead on the tip.
  useEffect(() => {
    if (reduced || !total || phase !== "drawing") return;
    let raf = 0;
    const start = performance.now();
    const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
    // smoothed camera state — lags the arrow so corners feel like a turn
    const cam = { x: 0, y: 0, r: 0, s: 1.16 };

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / DRAW_MS);
      const eased = easeInOut(t);
      const dist = eased * total;

      const off = String(total - dist);
      if (pathRef.current) pathRef.current.style.strokeDashoffset = off;
      if (glowRef.current) glowRef.current.style.strokeDashoffset = off;

      // position + rotation of the tip
      let idx = segments.findIndex((s) => dist <= s.cum);
      if (idx < 0) idx = segments.length - 1;
      const seg = segments[idx];
      const segStart = seg.cum - seg.len;
      const local = seg.len ? (dist - segStart) / seg.len : 1;
      const a = px[idx];
      const b = px[idx + 1];
      setTip({
        x: a[0] + (b[0] - a[0]) * local,
        y: a[1] + (b[1] - a[1]) * local,
        angle: seg.angle,
        show: t < 1,
      });

      // ---- camera: pan toward the arrow tip and bank into each corner ----
      const tipX = a[0] + (b[0] - a[0]) * local;
      const tipY = a[1] + (b[1] - a[1]) * local;
      const targetX = (stage.w / 2 - tipX) * 0.34;
      const targetY = (stage.h / 2 - tipY) * 0.26;
      const targetR = -seg.angle * 0.16;
      const targetS = 1.14 + Math.min(0.12, Math.abs(seg.angle) / 520) + (1 - Math.abs(0.5 - t) * 2) * 0.03;
      const k = 0.045; // critically damped-ish follow
      cam.x += (targetX - cam.x) * k;
      cam.y += (targetY - cam.y) * k;
      cam.r += (targetR - cam.r) * k;
      cam.s += (targetS - cam.s) * k;
      if (camRef.current) {
        camRef.current.style.transform = `translate3d(${cam.x.toFixed(2)}px, ${cam.y.toFixed(
          2
        )}px, 0) rotate(${cam.r.toFixed(3)}deg) scale(${cam.s.toFixed(4)})`;
      }

      // reveal a word once the line clears its vertex
      const cleared = segments.filter((s) => dist >= s.cum - 4).length;
      setVisibleWords((v) => {
        const next = Math.max(v, Math.min(WORDS.length, cleared));
        // each newly revealed word softly dissolves shortly after it lands
        for (let i = v; i < next; i++) {
          fadeTimers.current.push(
            window.setTimeout(() => setFadedWords((f) => Math.max(f, i + 1)), 1150)
          );
        }
        return next;
      });

      if (t < 1) raf = requestAnimationFrame(tick);
      else setTimeout(() => setPhase("assembling"), 260);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [reduced, total, segments, px, phase, stage.w, stage.h]);

  useEffect(() => {
    if (phase !== "assembling") return;
    const t = setTimeout(() => setPhase("settled"), 1500);
    return () => clearTimeout(t);
  }, [phase]);

  /** Each scattered word gets its OWN horizontal band, so overlap is
   *  mathematically impossible no matter how wide the word is. The x position
   *  tracks the zig-zag vertex it belongs to (clamped inside the stage). */
  const offsetFor = (i: number) => {
    if (phase !== "drawing" || !stageRef.current || !stage.w) return { x: 0, y: 0 };
    const el = wordRefs.current[i];
    if (!el) return { x: 0, y: 0 };
    const stageRect = stageRef.current.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    const cx = r.left - stageRect.left + r.width / 2;
    const cy = r.top - stageRect.top + r.height / 2;

    // dedicated row per word (top → bottom), generous band height
    const rows = WORDS.length;
    const topPad = Math.max(84, stage.h * 0.13);
    const botPad = Math.max(96, stage.h * 0.16);
    const band = (stage.h - topPad - botPad) / (rows - 1);
    const ty = topPad + band * i;

    // ride near the matching vertex horizontally, clamped to the viewport
    const vertex = px[Math.min(i + 1, px.length - 1)]?.[0] ?? stage.w / 2;
    const half = r.width / 2 + 20;
    const tx = Math.min(stage.w - half, Math.max(half, vertex));

    return { x: tx - cx, y: ty - cy };
  };

  const showTail = phase === "settled";

  return (
    <div ref={stageRef} className="relative min-h-[100svh] w-full overflow-hidden">
      {/* City skyline — drifts in only once the words come together */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          opacity: phase === "drawing" ? 0 : phase === "assembling" ? 0.35 : 0.75,
          transition: "opacity 2.8s cubic-bezier(.22,1,.36,1)",
        }}
      >
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage: `url(${cityBg})`,
            filter: "grayscale(1) brightness(0.85) contrast(1.1)",
            maskImage: "linear-gradient(to top, rgba(0,0,0,0) 0%, #000 18%, #000 82%, rgba(0,0,0,0) 100%)",
            WebkitMaskImage: "linear-gradient(to top, rgba(0,0,0,0) 0%, #000 18%, #000 82%, rgba(0,0,0,0) 100%)",
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-background/55 via-background/25 to-background/95" />
      </div>

      {/* Eyebrow + skip */}
      <div className="absolute inset-x-0 top-0 z-20 flex items-center justify-between px-5 py-5 md:px-8">
        <span className="flex-1" />
        <span className="text-[10px] uppercase tracking-[0.34em] text-foreground/50 font-medium">
          Vantage Portfolio Solutions
        </span>
        <span className="flex-1 text-right">
          <button
            onClick={onSkip}
            className="text-xs text-foreground/45 hover:text-foreground transition-colors duration-300"
          >
            Skip intro
          </button>
        </span>
      </div>

      {/* Camera rig — pans and banks as the arrow turns each corner */}
      <div
        ref={camRef}
        aria-hidden
        className="pointer-events-none absolute -inset-[20%] will-change-transform"
        style={{
          transformOrigin: "50% 50%",
          opacity: phase === "settled" ? 0 : 1,
          transition: "opacity 1s cubic-bezier(.22,1,.36,1)",
        }}
      >
        <svg
          className="h-full w-full"
          viewBox={`${-0.2 * stage.w} ${-0.2 * stage.h} ${1.4 * stage.w} ${1.4 * stage.h}`}
          aria-hidden
        >
          <defs>
            <linearGradient id="vpsArea" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f5f5f2" stopOpacity="0.16" />
              <stop offset="100%" stopColor="#f5f5f2" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="vpsFade" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#f5f5f2" stopOpacity="0.05" />
              <stop offset="45%" stopColor="#f5f5f2" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#f5f5f2" stopOpacity="0.06" />
            </linearGradient>
          </defs>

          {/* fine + coarse grid */}
          <g opacity={0.5}>
            {Array.from({ length: 29 }).map((_, i) => {
              const y = -0.2 * stage.h + (i / 28) * 1.4 * stage.h;
              const major = i % 4 === 0;
              return (
                <line
                  key={`h${i}`}
                  x1={-0.2 * stage.w}
                  x2={1.2 * stage.w}
                  y1={y}
                  y2={y}
                  stroke="#f5f5f2"
                  strokeWidth={major ? 0.6 : 0.4}
                  opacity={major ? 0.11 : 0.05}
                />
              );
            })}
            {Array.from({ length: 33 }).map((_, i) => {
              const x = -0.2 * stage.w + (i / 32) * 1.4 * stage.w;
              const major = i % 4 === 0;
              return (
                <line
                  key={`v${i}`}
                  x1={x}
                  x2={x}
                  y1={-0.2 * stage.h}
                  y2={1.2 * stage.h}
                  stroke="#f5f5f2"
                  strokeWidth={major ? 0.6 : 0.4}
                  opacity={major ? 0.09 : 0.04}
                />
              );
            })}
          </g>

          {/* candlestick field */}
          <g opacity={0.2}>
            {CANDLES.map((c, i) => {
              const x = (c.x / 100) * stage.w;
              const y = (c.y / 100) * stage.h;
              const w = Math.max(3, stage.w * 0.008);
              const bh = (c.body / 100) * stage.h * 0.5;
              const wh = (c.wick / 100) * stage.h * 0.5;
              return (
                <g key={`c${i}`}>
                  <line x1={x} x2={x} y1={y - wh} y2={y + wh} stroke="#f5f5f2" strokeWidth={0.7} opacity={0.5} />
                  <rect
                    x={x - w / 2}
                    y={y - bh / 2}
                    width={w}
                    height={bh}
                    fill={c.up ? "#f5f5f2" : "none"}
                    fillOpacity={c.up ? 0.35 : 0}
                    stroke="#f5f5f2"
                    strokeOpacity={0.5}
                    strokeWidth={0.7}
                  />
                </g>
              );
            })}
          </g>

          {/* ghost market lines, dashed for depth */}
          {GHOST_LINES.map((pts, i) => (
            <polyline
              key={`g${i}`}
              points={pts.map(([x, y]) => `${(x / 100) * stage.w},${(y / 100) * stage.h}`).join(" ")}
              fill="none"
              stroke="url(#vpsFade)"
              strokeWidth={1 + i * 0.25}
              strokeDasharray={i === 1 ? "6 7" : undefined}
              strokeLinejoin="round"
              strokeLinecap="round"
              opacity={0.7 - i * 0.16}
            />
          ))}

          {/* soft area under the hero line */}
          <polygon
            points={`${px.map(([x, y]) => `${x},${y}`).join(" ")} ${px[px.length - 1]?.[0] ?? 0},${1.2 * stage.h} ${
              px[0]?.[0] ?? 0
            },${1.2 * stage.h}`}
            fill="url(#vpsArea)"
            style={{
              opacity: phase === "drawing" ? 0.75 : 0.4,
              transition: "opacity 1.2s ease",
            }}
          />

          {/* vertices */}
          {px.map(([x, y], i) => (
            <circle key={`p${i}`} cx={x} cy={y} r={2.2} fill="#f5f5f2" opacity={0.35} />
          ))}

          {/* the hero line: wide glow underlay + crisp stroke */}
          <polyline
            points={px.map(([x, y]) => `${x},${y}`).join(" ")}
            fill="none"
            stroke="#f5f5f2"
            strokeWidth="9"
            strokeOpacity={0.09}
            strokeLinejoin="round"
            strokeLinecap="round"
            style={{ strokeDasharray: total || 1, strokeDashoffset: reduced ? 0 : total || 1 }}
            ref={glowRef}
          />
          <polyline
            ref={pathRef}
            points={px.map(([x, y]) => `${x},${y}`).join(" ")}
            fill="none"
            stroke="#f5f5f2"
            strokeWidth="2.5"
            strokeLinejoin="round"
            strokeLinecap="round"
            style={{
              strokeDasharray: total || 1,
              strokeDashoffset: reduced ? 0 : total || 1,
              filter: "drop-shadow(0 0 12px rgba(245,245,242,.5))",
            }}
          />

          {tip.show && (
            <g>
              {/* crosshair rails at the tip */}
              <line
                x1={-0.2 * stage.w}
                x2={1.2 * stage.w}
                y1={tip.y}
                y2={tip.y}
                stroke="#f5f5f2"
                strokeWidth={0.6}
                strokeDasharray="3 8"
                opacity={0.16}
              />
              <line
                x1={tip.x}
                x2={tip.x}
                y1={-0.2 * stage.h}
                y2={1.2 * stage.h}
                stroke="#f5f5f2"
                strokeWidth={0.6}
                strokeDasharray="3 8"
                opacity={0.12}
              />
              <circle cx={tip.x} cy={tip.y} r={16} fill="#f5f5f2" opacity={0.06} />
              <g transform={`translate(${tip.x} ${tip.y}) rotate(${tip.angle})`}>
                <polygon
                  points="12,0 -7,7 -7,-7"
                  fill="#f5f5f2"
                  style={{ filter: "drop-shadow(0 0 10px rgba(245,245,242,.7))" }}
                />
              </g>
            </g>
          )}
        </svg>
      </div>

      {/* vignette to keep the moving graphics from touching the edges */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(120% 90% at 50% 45%, rgba(0,0,0,0) 42%, rgba(10,10,15,0.72) 78%, rgba(10,10,15,0.96) 100%)",
        }}
      />

      {/* Headline — words start at the vertices, then glide into one line */}
      <div className="relative z-10 flex min-h-[100svh] flex-col items-center justify-center px-6 text-center">
        <h1 className="font-display text-[2.4rem] leading-[1.05] sm:text-6xl md:text-7xl max-w-4xl">
          <span className="flex flex-wrap items-baseline justify-center gap-x-3 gap-y-1 md:gap-x-4">
            {WORDS.map((w, i) => {
              const off = offsetFor(i);
              const shown = i < visibleWords;
              const faded = i < fadedWords;
              const opacity = phase === "drawing" ? (shown && !faded ? 1 : 0) : 1;
              return (
                <span
                  key={w}
                  ref={(el) => (wordRefs.current[i] = el)}
                  style={{
                    display: "inline-block",
                    opacity,
                    transform:
                      phase === "drawing"
                        ? `translate(${off.x}px, ${off.y + (shown ? 0 : 18)}px)`
                        : "translate(0px, 0px)",
                    transition:
                      phase === "drawing"
                        ? "opacity 1.1s cubic-bezier(.22,1,.36,1), transform .7s cubic-bezier(.22,1,.36,1)"
                        : `transform 1.2s cubic-bezier(.22,1,.36,1), opacity 1.1s ease ${i * 0.07}s`,
                  }}
                >
                  {w}
                </span>
              );
            })}
          </span>
        </h1>

        <div
          className="mt-7 flex flex-col items-center gap-7"
          style={{
            opacity: showTail ? 1 : 0,
            transform: showTail ? "translateY(0)" : "translateY(24px)",
            transition: "opacity .8s cubic-bezier(.22,1,.36,1) .1s, transform .8s cubic-bezier(.22,1,.36,1) .1s",
          }}
        >
          <p className="max-w-lg text-sm md:text-base text-foreground/55 leading-relaxed">
            Institutional-grade market intelligence, AI research, and portfolio analytics — built for the way you
            actually invest.
          </p>
          <button onClick={onStart} className="pill-primary tap-scale text-sm" disabled={!showTail}>
            Get Started
            <span className="pill-badge">
              <ArrowRight className="h-3.5 w-3.5" />
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default LandingIntro;
