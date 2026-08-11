import { ReactNode, useEffect, useRef } from "react";
import { useReducedMotion } from "@/hooks/useReducedMotion";

type Props = {
  children: ReactNode;
  className?: string;
  /** max rotation in degrees (±) */
  tilt?: number;
  /** max translation in px */
  shift?: number;
  /** ambient cycle duration in seconds */
  cycle?: number;
};

/**
 * Dimensional focal object: reacts to the pointer with a few degrees of
 * rotation plus a small translation, and breathes on a very slow ambient
 * cycle (one pass every 20–40s). GPU transforms only.
 */
const Dimensional = ({ children, className = "", tilt = 3, shift = 9, cycle = 28 }: Props) => {
  const hostRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (reduced) return;
    const host = hostRef.current;
    const inner = innerRef.current;
    if (!host || !inner) return;
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;

    let raf = 0;
    const target = { x: 0, y: 0 };
    const cur = { x: 0, y: 0 };

    const onMove = (e: PointerEvent) => {
      const r = host.getBoundingClientRect();
      target.x = Math.max(-1, Math.min(1, (e.clientX - (r.left + r.width / 2)) / (r.width * 0.9)));
      target.y = Math.max(-1, Math.min(1, (e.clientY - (r.top + r.height / 2)) / (r.height * 0.9)));
    };
    const onLeave = () => { target.x = 0; target.y = 0; };

    const frame = () => {
      cur.x += (target.x - cur.x) * 0.07;
      cur.y += (target.y - cur.y) * 0.07;
      inner.style.transform =
        `rotateY(${(cur.x * tilt).toFixed(3)}deg) rotateX(${(-cur.y * tilt).toFixed(3)}deg) ` +
        `translate3d(${(cur.x * shift).toFixed(2)}px, ${(cur.y * shift * 0.6).toFixed(2)}px, 0)`;
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerleave", onLeave);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerleave", onLeave);
    };
  }, [reduced, tilt, shift]);

  return (
    <div ref={hostRef} className={`dim-host ${className}`}>
      <div ref={innerRef} className="dim-inner">
        <div className="dim-ambient" style={{ animationDuration: `${cycle}s` }}>
          {children}
        </div>
      </div>
    </div>
  );
};

export default Dimensional;
