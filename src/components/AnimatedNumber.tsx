import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "@/hooks/useReducedMotion";

interface AnimatedNumberProps {
  value: number;
  /** Duration in ms. Defaults to 600ms per motion spec. */
  duration?: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  /** When true, thousands are grouped with commas. */
  format?: boolean;
  className?: string;
}

// ease-out cubic — matches the spec's "ease-out curve" for price count-ups.
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

/**
 * Counts smoothly from the previous value to the target value using
 * requestAnimationFrame + ease-out. First mount counts from 0.
 * Respects prefers-reduced-motion by snapping to the target immediately.
 */
const AnimatedNumber = ({
  value,
  duration = 600,
  decimals = 2,
  prefix = "",
  suffix = "",
  format = true,
  className,
}: AnimatedNumberProps) => {
  const reduced = useReducedMotion();
  const [display, setDisplay] = useState<number>(reduced ? value : 0);
  const fromRef = useRef<number>(reduced ? value : 0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (reduced || !Number.isFinite(value)) {
      setDisplay(value);
      fromRef.current = value;
      return;
    }
    const from = fromRef.current;
    const to = value;
    if (from === to) return;
    const start = performance.now();

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = easeOutCubic(t);
      const current = from + (to - from) * eased;
      setDisplay(current);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        fromRef.current = to;
        rafRef.current = null;
      }
    };

    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [value, duration, reduced]);

  const formatted = format
    ? display.toLocaleString(undefined, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })
    : display.toFixed(decimals);

  return (
    <span className={className}>
      {prefix}
      {formatted}
      {suffix}
    </span>
  );
};

export default AnimatedNumber;