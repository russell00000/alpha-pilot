import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { motion } from "framer-motion";
import GlobeScene from "@/components/three/GlobeScene";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { useEffect, useState } from "react";

const spring = { type: "spring" as const, stiffness: 60, damping: 20 };

const rise = (delay: number) => ({
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { ...spring, delay },
});

/** Landing hero: WebGL particle globe behind editorial type. */
const LandingHero = () => {
  const reduced = useReducedMotion();
  const [wide, setWide] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const on = () => setWide(mq.matches);
    on();
    mq.addEventListener?.("change", on);
    return () => mq.removeEventListener?.("change", on);
  }, []);

  const anim = reduced
    ? { initial: { opacity: 1, y: 0 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0 } }
    : null;

  return (
    <section data-scene="hero" className="relative isolate overflow-hidden">
      {/* environment */}
      <div className="pointer-events-none absolute inset-0 hero-vignette" />
      <div className="pointer-events-none absolute inset-0 hero-grid opacity-70" />
      {wide ? (
        <GlobeScene className="pointer-events-none absolute inset-0 opacity-[0.72]" />
      ) : (
        <div className="pointer-events-none absolute inset-0 hero-fallback" />
      )}
      {/* legibility scrim behind the type */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: "radial-gradient(ellipse 46% 38% at 50% 50%, rgba(8,7,8,0.82) 0%, rgba(8,7,8,0.35) 55%, transparent 78%)" }}
      />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-background" />

      <div className="container relative px-4 md:px-6">
        <div className="mx-auto flex min-h-[78svh] max-w-3xl flex-col items-center justify-center py-24 text-center md:py-32">
          <motion.p
            {...(anim ?? rise(0))}
            className="font-mono text-[0.65rem] uppercase text-gold"
            style={{ letterSpacing: "0.2em" }}
          >
            — Vantage Portfolio Solutions · Est. 2024
          </motion.p>
          <motion.span {...(anim ?? rise(0))} className="mt-5 block h-px w-[2.5rem] bg-gold" />

          <motion.h1
            {...(anim ?? rise(0.15))}
            className="mt-8 font-display font-medium leading-[1.06] text-foreground"
            style={{ fontSize: "clamp(3rem, 6vw, 5.5rem)" }}
          >
            Institutional-grade intelligence for
            <br />
            <em className="italic text-gold">modern portfolios.</em>
          </motion.h1>

          <motion.p
            {...(anim ?? rise(0.3))}
            className="mt-7 max-w-[44ch] text-[0.95rem] leading-relaxed text-foreground/60"
          >
            AI-powered market analysis, real-time signals, and portfolio optimization — built for the
            way you actually invest.
          </motion.p>

          <motion.div {...(anim ?? rise(0.45))} className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <Link to="/portfolio">
              <button className="pill-primary tap-scale">
                Get Started
                <span className="pill-badge">
                  <ArrowRight className="h-3.5 w-3.5" />
                </span>
              </button>
            </Link>
            <Link to="/auth">
              <button className="pill-secondary tap-scale">Sign In</button>
            </Link>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default LandingHero;
