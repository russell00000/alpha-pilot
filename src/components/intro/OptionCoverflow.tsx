import { useCallback, useEffect, useRef } from "react";

/**
 * "Slider Spectra" coverflow — 3D fan of portrait cards on a dark stage with a
 * coloured halo keyed to the centre card. Drag / swipe / arrow keys / click to
 * spin; autoplay pauses on hover, drag, hidden tab, and once a card is picked.
 */

const GEO = { gap: 164, rotate: 38, depth: 150, drop: 24, shrink: 0.14, fade: 0.26, dim: 0.2, visible: 3 };
const CARD_W = 260;
const CARD_H = 330;
const PERSP = 1680;
const AUTOPLAY_MS = 3200;
const EASE = 0.14;
const SENSITIVITY = 0.0072;

export type CoverflowItem = {
  key: string;
  label: string;
  glow: string;
  c1: string;
  c2: string;
  selected?: boolean;
  node: React.ReactNode;
};

type Props = {
  items: CoverflowItem[];
  /** resets position when this changes (e.g. the questionnaire step) */
  resetKey?: string | number;
  start?: number;
  autoplay?: boolean;
  onSelect: (key: string) => void;
};

const OptionCoverflow = ({ items, resetKey, start = 0, autoplay = true, onSelect }: Props) => {
  const sectionRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const liveRef = useRef<HTMLSpanElement>(null);

  const N = items.length;
  const metaRef = useRef({ N, glows: items.map((i) => i.glow), names: items.map((i) => i.label) });
  metaRef.current = { N, glows: items.map((i) => i.glow), names: items.map((i) => i.label) };

  const state = useRef({
    pos: start,
    target: start,
    scale: 1,
    dragging: false,
    moved: false,
    lastX: 0,
    startX: 0,
    vel: 0,
    hovering: false,
    lastActive: -1,
    autoplay,
  });
  state.current.autoplay = autoplay;

  const wrap = useCallback((o: number) => {
    const n = metaRef.current.N;
    o = ((o % n) + n) % n;
    return o > n / 2 ? o - n : o;
  }, []);

  const paint = useCallback(() => {
    const s = state.current;
    const { gap, rotate, depth, drop, shrink, fade, dim, visible } = GEO;
    const n = metaRef.current.N;
    for (let i = 0; i < n; i++) {
      const el = cardRefs.current[i];
      if (!el) continue;
      const o = wrap(i - s.pos);
      const ao = Math.abs(o);
      if (ao > visible + 0.5) {
        el.style.opacity = "0";
        el.style.pointerEvents = "none";
        continue;
      }
      const sc = Math.max(0.4, 1 - ao * shrink);
      el.style.transform =
        `translateX(${o * gap * s.scale}px) translateY(${ao * drop * s.scale}px) ` +
        `translateZ(${-ao * depth * s.scale}px) rotateY(${-o * rotate}deg) scale(${sc})`;
      el.style.opacity = String(Math.max(0, 1 - ao * fade));
      el.style.filter = `brightness(${Math.max(0.3, 1 - ao * dim)}) saturate(${1 + (1 - Math.min(1, ao)) * 0.25})`;
      el.style.zIndex = String(Math.round(100 - ao * 10));
      el.style.pointerEvents = "auto";
    }
    const active = ((Math.round(s.pos) % n) + n) % n;
    const glow = metaRef.current.glows[active];
    if (glow && sectionRef.current) sectionRef.current.style.setProperty("--halo", glow);
  }, [wrap]);

  const layout = useCallback(() => {
    const f = Math.max(0.56, Math.min(1, window.innerWidth / 1180));
    const el = sectionRef.current;
    if (!el) return;
    el.style.setProperty("--card-w", Math.round(CARD_W * f) + "px");
    el.style.setProperty("--card-h", Math.round(CARD_H * f) + "px");
    el.style.setProperty("--persp", Math.max(1050, PERSP * f) + "px");
    state.current.scale = f;
  }, []);

  /* ——— animation loop ——— */
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    const frame = () => {
      const s = state.current;
      if (!s.dragging) {
        if (reduce) s.pos = s.target;
        else {
          s.pos += (s.target - s.pos) * EASE;
          if (Math.abs(s.target - s.pos) < 0.001) s.pos = s.target;
        }
      }
      paint();
      const n = metaRef.current.N;
      const active = ((Math.round(s.pos) % n) + n) % n;
      if (active !== s.lastActive) {
        s.lastActive = active;
        if (liveRef.current) liveRef.current.textContent = `${metaRef.current.names[active]}, ${active + 1} of ${n}`;
      }
      raf = requestAnimationFrame(frame);
    };
    layout();
    raf = requestAnimationFrame(frame);
    const onResize = () => { layout(); paint(); };
    window.addEventListener("resize", onResize);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", onResize); };
  }, [layout, paint]);

  /* ——— autoplay ——— */
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let timer: ReturnType<typeof setInterval> | null = null;
    const active = () =>
      state.current.autoplay && !reduce && !state.current.hovering && !state.current.dragging && !document.hidden;
    const sync = () => {
      if (timer) clearInterval(timer);
      timer = null;
      if (active()) timer = setInterval(() => { state.current.target += 1; }, AUTOPLAY_MS);
    };
    syncRef.current = sync;
    sync();
    document.addEventListener("visibilitychange", sync);
    return () => { if (timer) clearInterval(timer); document.removeEventListener("visibilitychange", sync); };
  }, [autoplay, N]);

  const syncRef = useRef<() => void>(() => {});

  /* ——— reset when the step changes ——— */
  useEffect(() => {
    state.current.pos = start;
    state.current.target = start;
    state.current.lastActive = -1;
    paint();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey]);

  const go = useCallback((i: number) => {
    const cur = Math.round(state.current.target);
    state.current.target = cur + wrap(i - cur);
  }, [wrap]);

  const onPointerDown = (e: React.PointerEvent) => {
    const s = state.current;
    s.dragging = true;
    s.moved = false;
    s.lastX = s.startX = e.clientX;
    s.vel = 0;
    stageRef.current?.classList.add("-drag");
    try { stageRef.current?.setPointerCapture(e.pointerId); } catch { /* noop */ }
    syncRef.current();
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const s = state.current;
    if (!s.dragging) return;
    const dx = e.clientX - s.lastX;
    s.lastX = e.clientX;
    if (Math.abs(e.clientX - s.startX) > 5) s.moved = true;
    const d = -dx * SENSITIVITY;
    s.pos += d;
    s.vel = d;
    paint();
  };

  const release = () => {
    const s = state.current;
    if (!s.dragging) return;
    s.dragging = false;
    stageRef.current?.classList.remove("-drag");
    s.target = Math.round(s.pos + s.vel * 8);
    s.vel = 0;
    syncRef.current();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowRight") { state.current.target += 1; e.preventDefault(); }
    else if (e.key === "ArrowLeft") { state.current.target -= 1; e.preventDefault(); }
    else if (e.key === "Home") { go(0); e.preventDefault(); }
    else if (e.key === "End") { go(N - 1); e.preventDefault(); }
  };

  return (
    <div
      ref={sectionRef}
      className="relative w-full"
      aria-roledescription="carousel"
      aria-label="Answer options"
      onKeyDown={onKeyDown}
    >
      <span aria-hidden className="cf-halo" />
      <div
        ref={stageRef}
        className="cf-stage"
        role="group"
        aria-label="Drag, swipe or use arrow keys to browse options"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={release}
        onPointerCancel={release}
        onMouseEnter={() => { state.current.hovering = true; syncRef.current(); }}
        onMouseLeave={() => { state.current.hovering = false; syncRef.current(); }}
      >
        <div className="cf-deck">
          {items.map((it, i) => (
            <button
              key={it.key}
              type="button"
              ref={(el) => { cardRefs.current[i] = el; }}
              className="cf-card"
              data-selected={it.selected || undefined}
              aria-label={`${it.label} — option ${i + 1} of ${N}`}
              style={{
                ["--c1" as string]: it.c1,
                ["--c2" as string]: it.c2,
                ["--glow" as string]: it.glow,
              }}
              onClick={() => {
                if (state.current.moved) return;
                const centre = ((Math.round(state.current.pos) % N) + N) % N;
                if (centre === i) onSelect(it.key);
                else go(i);
              }}
            >
              <span className="cf-inner">{it.node}</span>
            </button>
          ))}
        </div>
      </div>
      <span ref={liveRef} className="sr-only" aria-live="polite" />
    </div>
  );
};

export default OptionCoverflow;
