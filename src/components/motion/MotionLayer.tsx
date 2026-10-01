import { useEffect } from "react";
import { useReducedMotion } from "@/hooks/useReducedMotion";

const MAGNET_SELECTOR = ".pill-primary, .pill-secondary, [data-magnetic]";

/**
 * Site-wide interaction layer — magnetic buttons only.
 * Performance: never writes to <html> (that forces a full-document style
 * recalc), and only runs a rAF loop while the pointer is over a magnet.
 */
const MotionLayer = () => {
  const reduced = useReducedMotion();

  useEffect(() => {
    const fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    if (reduced || !fine) return;

    let raf = 0;
    let rawX = 0, rawY = 0;
    let magnetEl: HTMLElement | null = null;

    const clearMagnet = (el: HTMLElement | null) => {
      if (!el) return;
      el.style.removeProperty("--mgx");
      el.style.removeProperty("--mgy");
      el.classList.remove("magnet-live");
    };

    const frame = () => {
      raf = 0;
      if (!magnetEl) return;
      const r = magnetEl.getBoundingClientRect();
      const mx = Math.max(-1, Math.min(1, (rawX - (r.left + r.width / 2)) / (r.width / 2)));
      const my = Math.max(-1, Math.min(1, (rawY - (r.top + r.height / 2)) / (r.height / 2)));
      magnetEl.style.setProperty("--mgx", `${(mx * 3.5).toFixed(2)}px`);
      magnetEl.style.setProperty("--mgy", `${(my * 2.5).toFixed(2)}px`);
    };

    const onMove = (e: PointerEvent) => {
      rawX = e.clientX;
      rawY = e.clientY;
      const target = e.target as HTMLElement | null;
      const next = target?.closest?.(MAGNET_SELECTOR) as HTMLElement | null;
      if (next !== magnetEl) {
        clearMagnet(magnetEl);
        magnetEl = next;
        magnetEl?.classList.add("magnet-live");
      }
      if (magnetEl && !raf) raf = requestAnimationFrame(frame);
    };

    const onOut = (e: PointerEvent) => {
      if (e.relatedTarget) return;
      clearMagnet(magnetEl);
      magnetEl = null;
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerout", onOut);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerout", onOut);
      clearMagnet(magnetEl);
    };
  }, [reduced]);

  return null;
};

export default MotionLayer;
