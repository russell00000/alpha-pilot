import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ArrowRight } from "lucide-react";
import { useReducedMotion } from "@/hooks/useReducedMotion";

const WORDS = ["Welcome", "to", "Vantage", "Portfolio", "Solutions"];

/** Rising zig-zag: 6 points, net upward. Percentages of the stage. */
const POINTS: Array<[number, number]> = [
  [4, 82],
  [22, 54],
  [39, 66],
  [57, 34],
  [74, 46],
  [96, 14],
];

const DRAW_MS = 2500;

type Phase = "drawing" | "assembling" | "settled";

const LandingIntro = ({ onStart, onSkip }: { onStart: () => void; onSkip: () => void }) => {
  const reduced = useReducedMotion();
  const stageRef = useRef<HTMLDivElement>(null);
  const pathRef = useRef<SVGPolylineElement>(null);
  const wordRefs = useRef<Array<HTMLSpanElement | null>>([]);
  const [stage, setStage] = useState({ w: 0, h: 0 });
  const [phase, setPhase] = useState<Phase>(reduced ? "settled" : "drawing");
  const [visibleWords, setVisibleWords] = useState<number>(reduced ? WORDS.length : 0);
  const [tip, setTip] = useState({ x: 0, y: 0, angle: 0, show: !reduced });

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

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / DRAW_MS);
      const eased = easeInOut(t);
      const dist = eased * total;

      if (pathRef.current) pathRef.current.style.strokeDashoffset = String(total - dist);

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

      // reveal a word once the line clears its vertex
      const cleared = segments.filter((s) => dist >= s.cum - 4).length;
      setVisibleWords((v) => Math.max(v, Math.min(WORDS.length, cleared)));

      if (t < 1) raf = requestAnimationFrame(tick);
      else setTimeout(() => setPhase("assembling"), 260);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [reduced, total, segments, px, phase]);

  useEffect(() => {
    if (phase !== "assembling") return;
    const t = setTimeout(() => setPhase("settled"), 1000);
    return () => clearTimeout(t);
  }, [phase]);

  // FLIP offsets: while scattered, each word is pushed from its final
  // headline slot out to its zig-zag vertex, then glides home.
  const offsetFor = (i: number) => {
    if (phase !== "drawing" || !stageRef.current) return { x: 0, y: 0 };
    const el = wordRefs.current[i];
    if (!el) return { x: 0, y: 0 };
    const stageRect = stageRef.current.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    const cx = r.left - stageRect.left + r.width / 2;
    const cy = r.top - stageRect.top + r.height / 2;
    const target = px[i + 1] ?? px[px.length - 1];
    return { x: target[0] - cx, y: target[1] - 54 - cy };
  };

  const showTail = phase === "settled";

  return (
    <div ref={stageRef} className="relative min-h-[100svh] w-full overflow-hidden">
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

      {/* The market line */}
      <svg
        className="absolute inset-0 h-full w-full"
        width={stage.w}
        height={stage.h}
        aria-hidden
        style={{ opacity: phase === "settled" ? 0 : 1, transition: "opacity 0.9s cubic-bezier(.22,1,.36,1)" }}
      >
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
            filter: "drop-shadow(0 0 10px rgba(245,245,242,.45))",
          }}
        />
        {tip.show && (
          <g transform={`translate(${tip.x} ${tip.y}) rotate(${tip.angle})`}>
            <polygon
              points="10,0 -6,6 -6,-6"
              fill="#f5f5f2"
              style={{ filter: "drop-shadow(0 0 8px rgba(245,245,242,.6))" }}
            />
          </g>
        )}
      </svg>

      {/* Headline — words start at the vertices, then glide into one line */}
      <div className="relative z-10 flex min-h-[100svh] flex-col items-center justify-center px-6 text-center">
        <h1 className="font-display text-[2.4rem] leading-[1.05] sm:text-6xl md:text-7xl max-w-4xl">
          <span className="flex flex-wrap items-baseline justify-center gap-x-3 gap-y-1 md:gap-x-4">
            {WORDS.map((w, i) => {
              const off = offsetFor(i);
              const shown = i < visibleWords;
              return (
                <span
                  key={w}
                  ref={(el) => (wordRefs.current[i] = el)}
                  style={{
                    display: "inline-block",
                    opacity: shown ? 1 : 0,
                    transform:
                      phase === "drawing"
                        ? `translate(${off.x}px, ${off.y + (shown ? 0 : 18)}px)`
                        : "translate(0px, 0px)",
                    transition:
                      phase === "drawing"
                        ? "opacity .5s cubic-bezier(.22,1,.36,1), transform .5s cubic-bezier(.22,1,.36,1)"
                        : "transform .9s cubic-bezier(.22,1,.36,1), opacity .6s ease",
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
