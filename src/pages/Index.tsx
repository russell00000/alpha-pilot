import { useRef, useState, useCallback } from "react";
import Header from "@/components/Header";
import QuickActions from "@/components/QuickActions";
import MarketOverview from "@/components/MarketOverview";
import AIChat from "@/components/AIChat";
import TrendingNews from "@/components/TrendingNews";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import CapitalComposition from "@/components/graphics/CapitalComposition";
import cityBg from "@/assets/finance-bg.jpg";

const Index = () => {
  // Chat panel width as % of the row (lg+ only). Min 28, Max 60.
  const [chatPct, setChatPct] = useState(40);
  const rowRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);

  const onDragStart = useCallback((e: React.PointerEvent) => {
    draggingRef.current = true;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, []);

  const onDragMove = useCallback((e: React.PointerEvent) => {
    if (!draggingRef.current || !rowRef.current) return;
    const rect = rowRef.current.getBoundingClientRect();
    const rightFromEdge = rect.right - e.clientX;
    const pct = (rightFromEdge / rect.width) * 100;
    setChatPct(Math.min(60, Math.max(28, pct)));
  }, []);

  const onDragEnd = useCallback((e: React.PointerEvent) => {
    draggingRef.current = false;
    try { (e.target as HTMLElement).releasePointerCapture(e.pointerId); } catch {}
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
  }, []);

  return (
    <div className="min-h-screen bg-background relative">
      {/* City skyline background — a whisper of Manhattan behind the charcoal */}
      <div
        className="fixed inset-0 pointer-events-none bg-no-repeat"
        style={{
          backgroundImage: `url(${cityBg})`,
          backgroundSize: '110vw clamp(820px, calc(100svh + 140px), 1900px)',
          backgroundPosition: 'center -140px',
          filter: 'grayscale(1) brightness(0.5) contrast(1.12) sepia(0.18)',
          opacity: 0.11,
          imageRendering: 'crisp-edges',
          WebkitMaskImage: 'linear-gradient(to bottom, hsl(0 0% 0% / 0.9) 0%, hsl(0 0% 0% / 0.9) 78%, hsl(0 0% 0% / 0.5) 92%, hsl(0 0% 0% / 0) 100%)',
          maskImage: 'linear-gradient(to bottom, hsl(0 0% 0% / 0.9) 0%, hsl(0 0% 0% / 0.9) 78%, hsl(0 0% 0% / 0.5) 92%, hsl(0 0% 0% / 0) 100%)',
        }}
      />
      {/* Overlay: fades the skyline softly into the background */}
      <div className="fixed inset-0 pointer-events-none bg-gradient-to-b from-background/50 via-background/70 to-background/95" />

      <Header />
      
      <main className="relative">
        {/* ——— Hero: asymmetric editorial composition, one visual centerpiece ——— */}
        <section className="container px-4 md:px-6 pt-10 pb-14 md:pt-16 md:pb-20">
          <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)] lg:gap-14">
            {/* left: type */}
            <div className="max-w-xl">
              <span className="eyebrow inline-flex items-center gap-2.5 animate-fade-in">
                <span className="h-1 w-1 rounded-full bg-gold" />
                AI · Investing Copilot
              </span>
              <h1 className="mt-6 font-display text-[2.6rem] leading-[1.02] sm:text-5xl md:text-[4.1rem] md:leading-[0.98]">
                <span className="reveal-clip">
                  <span className="reveal-line block" style={{ ["--stagger" as string]: 0 }}>
                    Welcome to
                  </span>
                </span>
                <span className="reveal-clip">
                  <span className="reveal-line block font-editorial italic metal-text text-[1.06em]" style={{ ["--stagger" as string]: 1 }}>
                    Vantage
                  </span>
                </span>
                <span className="reveal-clip">
                  <span className="reveal-line block" style={{ ["--stagger" as string]: 2 }}>
                    Portfolio Solutions
                  </span>
                </span>
              </h1>
              <div className="rule-gold mt-7 w-40 animate-fade-in" style={{ ["--stagger" as string]: 3 }} />
              <p
                className="mt-6 max-w-md text-[15px] font-normal leading-relaxed text-foreground/65 animate-rise-in md:text-base"
                style={{ ["--stagger" as string]: 3 }}
              >
                Your capital, elevated. Real-time intelligence and AI-driven insight,
                composed for the modern portfolio.
              </p>
              <div className="mt-9 flex flex-wrap items-center gap-3 animate-rise-in" style={{ ["--stagger" as string]: 4 }}>
                <Link to="/portfolio">
                  <button className="pill-primary tap-scale text-sm">
                    Get Started
                    <span className="pill-badge">
                      <ArrowRight className="w-3.5 h-3.5" />
                    </span>
                  </button>
                </Link>
                <Link to="/markets">
                  <button className="pill-secondary tap-scale text-sm">All Markets</button>
                </Link>
              </div>
            </div>

            {/* right: the centerpiece visualization */}
            <div className="relative animate-fade-in" style={{ ["--stagger" as string]: 2 }}>
              <div className="relative overflow-hidden rounded-[22px] luxe-glass px-5 pb-4 pt-5 md:px-7 md:pb-6 md:pt-6">
                <div className="flex items-start justify-between gap-6">
                  <div>
                    <p className="eyebrow">Model Allocation · Composite</p>
                    <p className="mt-2 font-display text-base text-foreground/90">Capital Trajectory</p>
                  </div>
                  <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-foreground/45">
                    10Y · Indexed
                  </p>
                </div>
                <CapitalComposition className="mt-1" />
                <div className="mt-1 grid grid-cols-3 gap-4 border-t border-border/60 pt-4">
                  {[
                    { k: "Equity", v: "62%" },
                    { k: "Fixed income", v: "24%" },
                    { k: "Alts & cash", v: "14%" },
                  ].map((s) => (
                    <div key={s.k}>
                      <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-foreground/45">{s.k}</p>
                      <p className="mt-1 font-mono text-sm text-gold-light">{s.v}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-14 md:mt-20">
            <QuickActions />
          </div>
        </section>

        {/* Market Overview + AI Chat (resizable split on lg+) */}
        <section ref={rowRef} className="container px-4 md:px-6 flex flex-col lg:flex-row gap-6 mb-20 md:mb-28">
          <div
            className="animate-fade-in rounded-[22px] luxe-glass p-6 w-full lg:w-auto lg:flex-1 min-w-0"
            style={{ animationDelay: "100ms" }}
          >
            <MarketOverview />
          </div>

          {/* Drag handle — visible on lg+ */}
          <div
            onPointerDown={onDragStart}
            onPointerMove={onDragMove}
            onPointerUp={onDragEnd}
            onPointerCancel={onDragEnd}
            className="hidden lg:flex items-center justify-center w-2 -mx-2 cursor-col-resize group/handle touch-none"
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize panels"
          >
            <div className="h-20 w-px rounded-full bg-foreground/12 transition-colors group-hover/handle:bg-gold/60" />
          </div>

          <div
            className="animate-fade-in w-full lg:w-auto min-w-0"
            style={{ animationDelay: "150ms", flexBasis: `${chatPct}%`, flexGrow: 0, flexShrink: 0 }}
          >
            <AIChat onResetSize={() => setChatPct(40)} />
          </div>
        </section>

        {/* News - full width */}
        <section className="container px-4 md:px-6 mb-20 animate-fade-in md:mb-28" style={{ animationDelay: "200ms" }}>
          <div className="rounded-[22px] luxe-glass p-6 md:p-8">
            <TrendingNews />
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="relative mt-8 border-t border-border/50 bg-background/80">
        <div className="container px-4 md:px-6 py-5">
          <div className="flex flex-col md:flex-row items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              © {new Date().getFullYear()} Vantage Portfolio Solutions. For educational purposes only.
            </p>
            <div className="flex items-center gap-6 text-xs text-muted-foreground">
              <Link to="/terms" className="hover:text-foreground transition-colors duration-200">Terms</Link>
              <Link to="/privacy" className="hover:text-foreground transition-colors duration-200">Privacy</Link>
              <Link to="/chat" className="hover:text-foreground transition-colors duration-200">Support</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
