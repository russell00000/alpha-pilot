import { useEffect } from "react";
import { useReducedMotion } from "@/hooks/useReducedMotion";

const TILT_SELECTOR = ".luxe-glass, .glass-card, .deep-card, [data-tilt]";
const MAGNET_SELECTOR = ".pill-primary, .pill-secondary, [data-magnetic]";

/**
 * Site-wide interaction layer. No DOM of its own — it publishes pointer state
 * as CSS custom properties on <html> and drives:
 *   • global pointer parallax (--ptr-x / --ptr-y, normalised -1..1)
 *   • the cursor light position (--cur-x / --cur-y in px)
 *   • physical smoked-glass card tilt + specular sweep
 *   • magnetic buttons (max 4px)
 * All work happens inside a single requestAnimationFrame loop, and
 * `will-change` is applied only while an element is actively animating.
 */
const MotionLayer = () => {
  const reduced = useReducedMotion();

  useEffect(() => {
    const fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    const root = document.documentElement;
    if (reduced || !fine) {
      root.style.setProperty("--ptr-x", "0");
      root.style.setProperty("--ptr-y", "0");
      root.dataset.pointerMotion = "off";
      return;
    }
    root.dataset.pointerMotion = "on";

    let raf = 0;
    let px = 0.5, py = 0.5;                 // latest pointer, viewport 0..1
    let cx = 0, cy = 0;                     // eased pointer, px
    let rawX = window.innerWidth / 2, rawY = window.innerHeight / 2;
    let sx = 0, sy = 0;                     // eased normalised parallax

    let tiltEl: HTMLElement | null = null;
    let tiltRect: DOMRect | null = null;
    let magnetEl: HTMLElement | null = null;

    const clearTilt = (el: HTMLElement | null) => {
      if (!el) return;
      el.classList.remove("tilt-live");
      el.style.removeProperty("--trx");
      el.style.removeProperty("--try");
      el.style.removeProperty("--gx");
      el.style.removeProperty("--gy");
      window.setTimeout(() => { if (el !== tiltEl) el.style.willChange = ""; }, 600);
    };

    const clearMagnet = (el: HTMLElement | null) => {
      if (!el) return;
      el.style.removeProperty("--mgx");
      el.style.removeProperty("--mgy");
      el.classList.remove("magnet-live");
    };

    const onMove = (e: PointerEvent) => {
      rawX = e.clientX;
      rawY = e.clientY;
      px = e.clientX / Math.max(1, window.innerWidth);
      py = e.clientY / Math.max(1, window.innerHeight);

      const target = e.target as HTMLElement | null;
      const nextTilt = target?.closest?.(TILT_SELECTOR) as HTMLElement | null;
      if (nextTilt !== tiltEl) {
        clearTilt(tiltEl);
        tiltEl = nextTilt;
        if (tiltEl) {
          tiltEl.style.willChange = "transform";
          tiltEl.classList.add("tilt-live");
        }
      }
      tiltRect = tiltEl ? tiltEl.getBoundingClientRect() : null;

      const nextMagnet = target?.closest?.(MAGNET_SELECTOR) as HTMLElement | null;
      if (nextMagnet !== magnetEl) {
        clearMagnet(magnetEl);
        magnetEl = nextMagnet;
        magnetEl?.classList.add("magnet-live");
      }
    };

    const frame = () => {
      // global parallax + cursor light, eased
      sx += ((px - 0.5) * 2 - sx) * 0.06;
      sy += ((py - 0.5) * 2 - sy) * 0.06;
      cx += (rawX - cx) * 0.12;
      cy += (rawY - cy) * 0.12;
      root.style.setProperty("--ptr-x", sx.toFixed(4));
      root.style.setProperty("--ptr-y", sy.toFixed(4));
      root.style.setProperty("--cur-x", `${cx.toFixed(1)}px`);
      root.style.setProperty("--cur-y", `${cy.toFixed(1)}px`);

      if (tiltEl && tiltRect) {
        const lx = Math.max(0, Math.min(1, (rawX - tiltRect.left) / Math.max(1, tiltRect.width)));
        const ly = Math.max(0, Math.min(1, (rawY - tiltRect.top) / Math.max(1, tiltRect.height)));
        tiltEl.style.setProperty("--try", `${((lx - 0.5) * 5).toFixed(2)}deg`);
        tiltEl.style.setProperty("--trx", `${(-(ly - 0.5) * 5).toFixed(2)}deg`);
        tiltEl.style.setProperty("--gx", `${(lx * 100).toFixed(1)}%`);
        tiltEl.style.setProperty("--gy", `${(ly * 100).toFixed(1)}%`);
      }

      if (magnetEl) {
        const r = magnetEl.getBoundingClientRect();
        const mx = Math.max(-1, Math.min(1, (rawX - (r.left + r.width / 2)) / (r.width / 2)));
        const my = Math.max(-1, Math.min(1, (rawY - (r.top + r.height / 2)) / (r.height / 2)));
        magnetEl.style.setProperty("--mgx", `${(mx * 3.5).toFixed(2)}px`);
        magnetEl.style.setProperty("--mgy", `${(my * 2.5).toFixed(2)}px`);
      }

      raf = requestAnimationFrame(frame);
    };

    raf = requestAnimationFrame(frame);
    window.addEventListener("pointermove", onMove, { passive: true });
    const onOut = (e: PointerEvent) => {
      if (e.relatedTarget) return;
      clearTilt(tiltEl); tiltEl = null;
      clearMagnet(magnetEl); magnetEl = null;
    };
    window.addEventListener("pointerout", onOut);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerout", onOut);
      clearTilt(tiltEl);
      clearMagnet(magnetEl);
    };
  }, [reduced]);

  return null;
};

export default MotionLayer;
