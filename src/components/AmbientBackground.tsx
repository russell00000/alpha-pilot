import { useEffect, useMemo, useRef, useState } from "react";
import { useReducedMotion } from "@/hooks/useReducedMotion";

/**
 * Global ambient environment — six independent layers that together read as one
 * physical space:
 *   1. near-black graphite base
 *   2. graphite noise/grain (~2.5%)
 *   3. faint financial grid + contour geometry (~4%)
 *   4. one large champagne key light, drifting over ~21s and repositioned by
 *      the active section (--scene-x / --scene-y / --scene-warm)
 *   5. secondary darker atmospheric gradient
 *   6. floating dust motes + data-network canvas
 * Layers translate at different rates from the pointer (4–12px) for parallax,
 * and a very low-opacity champagne cursor light trails the pointer on desktop.
 */

type Mote = {
  bx: number; by: number;
  ax: number; ay: number;
  px: number; py: number;
  r: number;
  gold: boolean;
};

const GOLD = "#E2C27A";
const GRAPHITE = "#B7B1A5";
const CYCLE_MS = 26000;

const grainDataUri =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='240' height='240'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.6 0'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>\")";

const SCENES: Record<string, { x: string; y: string; warm: string }> = {
  hero: { x: "64%", y: "16%", warm: "1" },
  portfolio: { x: "74%", y: "62%", warm: "0.95" },
  analytics: { x: "36%", y: "46%", warm: "0.55" },
  insights: { x: "50%", y: "28%", warm: "1.18" },
  neutral: { x: "56%", y: "30%", warm: "0.8" },
};

const AmbientBackground = () => {
  const reduced = useReducedMotion();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);
  const [dims, setDims] = useState({ w: 0, h: 0, dpr: 1 });

  /* viewport */
  useEffect(() => {
    const onResize = () =>
      setDims({
        w: window.innerWidth,
        h: window.innerHeight,
        dpr: Math.min(window.devicePixelRatio || 1, 2),
      });
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  /* section-driven lighting — the environment relights as you scroll */
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const root = document.documentElement;
    const apply = (name: string) => {
      const s = SCENES[name] ?? SCENES.neutral;
      root.style.setProperty("--scene-x", s.x);
      root.style.setProperty("--scene-y", s.y);
      root.style.setProperty("--scene-warm", s.warm);
    };
    let best = { ratio: 0, name: "" };
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const name = (e.target as HTMLElement).dataset.scene || "neutral";
          if (e.isIntersecting && e.intersectionRatio >= best.ratio) best = { ratio: e.intersectionRatio, name };
        }
        if (best.name) apply(best.name);
        best = { ratio: 0, name: "" };
      },
      { threshold: [0.15, 0.35, 0.6, 0.85] }
    );
    const scan = () => document.querySelectorAll("[data-scene]").forEach((el) => io.observe(el));
    scan();
    const t = window.setTimeout(scan, 900);
    return () => { io.disconnect(); window.clearTimeout(t); };
  }, []);

  const nodes = useMemo<Mote[]>(() => {
    if (!dims.w || !dims.h) return [];
    const isMobile = dims.w < 768;
    const baseCount = Math.round((dims.w * dims.h) / 24000);
    const count = Math.max(18, Math.min(120, Math.round(baseCount * (isMobile ? 0.55 : 1))));
    const arr: Mote[] = [];
    for (let i = 0; i < count; i++) {
      arr.push({
        bx: Math.random() * dims.w,
        by: Math.random() * dims.h,
        ax: 18 + Math.random() * 44,
        ay: 18 + Math.random() * 44,
        px: Math.random() * Math.PI * 2,
        py: Math.random() * Math.PI * 2,
        r: 0.7 + Math.random() * 2.2,
        gold: Math.random() < 0.6,
      });
    }
    return arr;
  }, [dims.w, dims.h]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !dims.w || !dims.h) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = dims.w * dims.dpr;
    canvas.height = dims.h * dims.dpr;
    canvas.style.width = `${dims.w}px`;
    canvas.style.height = `${dims.h}px`;
    ctx.setTransform(dims.dpr, 0, 0, dims.dpr, 0, 0);

    const linkDist = dims.w < 768 ? 120 : 165;
    const linkDistSq = linkDist * linkDist;
    const pts = nodes.map((n) => ({ x: n.bx, y: n.by }));

    const draw = (t: number) => {
      const theta = ((t % CYCLE_MS) / CYCLE_MS) * Math.PI * 2;
      ctx.clearRect(0, 0, dims.w, dims.h);

      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i];
        pts[i].x = n.bx + Math.cos(theta + n.px) * n.ax;
        pts[i].y = n.by + Math.sin(theta + n.py) * n.ay;
      }

      ctx.lineWidth = 0.5;
      for (let i = 0; i < pts.length; i++) {
        for (let j = i + 1; j < pts.length; j++) {
          const dx = pts[i].x - pts[j].x;
          const dy = pts[i].y - pts[j].y;
          const d2 = dx * dx + dy * dy;
          if (d2 > linkDistSq) continue;
          ctx.strokeStyle = nodes[i].gold && nodes[j].gold ? GOLD : GRAPHITE;
          ctx.globalAlpha = (1 - d2 / linkDistSq) * 0.045;
          ctx.beginPath();
          ctx.moveTo(pts[i].x, pts[i].y);
          ctx.lineTo(pts[j].x, pts[j].y);
          ctx.stroke();
        }
      }

      for (let i = 0; i < pts.length; i++) {
        ctx.globalAlpha = nodes[i].gold ? 0.075 : 0.055;
        ctx.fillStyle = nodes[i].gold ? GOLD : GRAPHITE;
        ctx.beginPath();
        ctx.arc(pts[i].x, pts[i].y, nodes[i].r, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.globalAlpha = 1;
      if (!reduced) rafRef.current = requestAnimationFrame(draw);
    };

    if (reduced) draw(0);
    else rafRef.current = requestAnimationFrame(draw);

    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [nodes, dims, reduced]);

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden" style={{ backgroundColor: "#0B0B0E" }}>
      {/* 1 · graphite base gradient */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(120% 100% at 50% -20%, #14141a 0%, #0d0d11 46%, #08080a 100%)",
        }}
      />

      {/* 3 · faint financial grid + contour geometry */}
      <div className="env-layer env-grid" />
      <svg className="env-layer env-contour" viewBox="0 0 1200 800" preserveAspectRatio="none">
        {[0, 1, 2, 3, 4].map((i) => (
          <path
            key={i}
            d={`M-40 ${300 + i * 78} C 220 ${240 + i * 70} 430 ${420 + i * 74} 660 ${300 + i * 66} S 1020 ${180 + i * 72} 1260 ${250 + i * 70}`}
            fill="none"
            stroke="#EFE6D2"
            strokeWidth="1"
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </svg>

      {/* 4 · champagne key light */}
      <div className="env-layer env-key" />

      {/* 6 · dust motes + data network */}
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" style={{ transform: "translateZ(0)" }} />

      {/* 5 · secondary atmospheric veil */}
      <div className="env-layer env-veil" />

      {/* 2 · grain */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: grainDataUri,
          backgroundSize: "240px 240px",
          opacity: 0.025,
          mixBlendMode: "soft-light",
        }}
      />

      {/* cursor light — desktop only, extremely low opacity */}
      <div className="cursor-light" />
    </div>
  );
};

export default AmbientBackground;
