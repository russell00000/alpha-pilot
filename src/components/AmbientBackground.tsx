import { useEffect, useMemo, useRef, useState } from "react";
import { useReducedMotion } from "@/hooks/useReducedMotion";

/**
 * Global ambient background:
 *  - Base #0A0A0F flat fill
 *  - 1.5% grain via inline SVG turbulence data URI
 *  - Slow animated data network (gold #C9A84C 60% / teal #4FC3F7 40%)
 *    on a canvas at 3–5% opacity, ~14s cycle, GPU friendly.
 * Fixed, pointer-events none, z-index 0. All UI sits above via z >= 1 (default stacking).
 * Respects prefers-reduced-motion and drops density by 40% on mobile.
 */

type Node = {
  x: number;
  y: number;
  bx: number; // base
  by: number;
  ax: number; // amp
  ay: number;
  px: number; // phase
  py: number;
  color: "gold" | "teal";
  r: number;
};

const GOLD = "#C9A84C";
const TEAL = "#4FC3F7";
const CYCLE_MS = 14000; // 12–16s

const grainDataUri =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='240' height='240'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.6 0'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>\")";

const AmbientBackground = () => {
  const reduced = useReducedMotion();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);
  const [dims, setDims] = useState({ w: 0, h: 0, dpr: 1 });

  useEffect(() => {
    const onResize = () => {
      setDims({
        w: window.innerWidth,
        h: window.innerHeight,
        dpr: Math.min(window.devicePixelRatio || 1, 2),
      });
    };
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const nodes = useMemo<Node[]>(() => {
    if (!dims.w || !dims.h) return [];
    const isMobile = dims.w < 768;
    // Base density: ~1 node per 22k px^2, mobile -40%
    const baseCount = Math.round((dims.w * dims.h) / 22000);
    const count = Math.max(20, Math.min(140, Math.round(baseCount * (isMobile ? 0.6 : 1))));
    const arr: Node[] = [];
    for (let i = 0; i < count; i++) {
      const color: "gold" | "teal" = Math.random() < 0.6 ? "gold" : "teal";
      arr.push({
        x: 0,
        y: 0,
        bx: Math.random() * dims.w,
        by: Math.random() * dims.h,
        ax: 20 + Math.random() * 40,
        ay: 20 + Math.random() * 40,
        px: Math.random() * Math.PI * 2,
        py: Math.random() * Math.PI * 2,
        color,
        r: 1 + Math.random() * 3, // 2–4px range
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
    ctx.scale(dims.dpr, dims.dpr);

    const linkDist = dims.w < 768 ? 130 : 170;
    const linkDistSq = linkDist * linkDist;

    const draw = (t: number) => {
      const phase = (t % CYCLE_MS) / CYCLE_MS; // 0..1
      const theta = phase * Math.PI * 2;

      ctx.clearRect(0, 0, dims.w, dims.h);

      // update positions
      for (const n of nodes) {
        n.x = n.bx + Math.cos(theta + n.px) * n.ax;
        n.y = n.by + Math.sin(theta + n.py) * n.ay;
      }

      // lines
      ctx.lineWidth = 0.5;
      for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i];
        for (let j = i + 1; j < nodes.length; j++) {
          const b = nodes[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const d2 = dx * dx + dy * dy;
          if (d2 > linkDistSq) continue;
          const alpha = (1 - d2 / linkDistSq) * 0.022; // <=2.2%
          const stroke = a.color === "gold" && b.color === "gold" ? GOLD : b.color === "teal" ? TEAL : GOLD;
          ctx.strokeStyle = stroke;
          ctx.globalAlpha = alpha;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }

      // nodes
      for (const n of nodes) {
        ctx.globalAlpha = n.color === "gold" ? 0.025 : 0.022;
        ctx.fillStyle = n.color === "gold" ? GOLD : TEAL;
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.globalAlpha = 1;

      if (!reduced) {
        rafRef.current = requestAnimationFrame(draw);
      }
    };

    if (reduced) {
      // Draw a single static frame.
      draw(0);
    } else {
      rafRef.current = requestAnimationFrame(draw);
    }

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [nodes, dims, reduced]);

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-0"
      style={{ backgroundColor: "#0A0A0F" }}
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
        style={{ transform: "translateZ(0)", willChange: "transform" }}
      />
      {/* Grain overlay — 1.5% */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: grainDataUri,
          backgroundSize: "240px 240px",
          opacity: 0.015,
          mixBlendMode: "overlay",
        }}
      />
    </div>
  );
};

export default AmbientBackground;