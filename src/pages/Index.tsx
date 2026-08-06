import { useRef, useState, useCallback } from "react";
import Header from "@/components/Header";
import QuickActions from "@/components/QuickActions";
import MarketOverview from "@/components/MarketOverview";
import AIChat from "@/components/AIChat";
import TrendingNews from "@/components/TrendingNews";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
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
          filter: 'grayscale(1) brightness(0.55) contrast(1.05)',
          opacity: 0.14,
          imageRendering: 'crisp-edges',
          WebkitMaskImage: 'linear-gradient(to bottom, hsl(0 0% 0% / 0.9) 0%, hsl(0 0% 0% / 0.9) 78%, hsl(0 0% 0% / 0.5) 92%, hsl(0 0% 0% / 0) 100%)',
          maskImage: 'linear-gradient(to bottom, hsl(0 0% 0% / 0.9) 0%, hsl(0 0% 0% / 0.9) 78%, hsl(0 0% 0% / 0.5) 92%, hsl(0 0% 0% / 0) 100%)',
        }}
      />
      {/* Overlay: fades the skyline softly into the background */}
      <div className="fixed inset-0 pointer-events-none bg-gradient-to-b from-background/50 via-background/70 to-background/95" />

      <Header />
      
      <main className="relative">
        {/* First screen: zoomed-out hero with actions fitting above the fold */}
        <section className="container px-4 md:px-6 h-[560px] md:h-[620px] flex flex-col justify-center pt-4 pb-4 text-center">
          <div className="flex flex-col items-center justify-center">
            <span className="relative text-[10px] uppercase tracking-[0.3em] font-medium text-foreground/70 mb-5 animate-fade-in px-3.5 py-1.5 rounded-full luxe-glass overflow-hidden">
              <span className="relative z-10 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-foreground animate-pulse" />
                AI · Investing Copilot
              </span>
            </span>
            <h1 className="font-display text-4xl sm:text-5xl md:text-7xl max-w-5xl leading-[1.04]">
              <span className="reveal-clip">
                <span className="reveal-line" style={{ ["--stagger" as string]: 0 }}>
                  Welcome to Vantage
                </span>
              </span>
              <span className="reveal-clip">
                <span className="reveal-line" style={{ ["--stagger" as string]: 1 }}>
                  Portfolio Solutions
                </span>
              </span>
            </h1>
            <p className="text-sm md:text-lg text-foreground/55 mt-5 max-w-xl animate-rise-in font-normal leading-relaxed" style={{ ["--stagger" as string]: 2 }}>
              Your capital, elevated. Real-time intelligence and AI-driven insights for the modern portfolio.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3 mt-7 animate-rise-in" style={{ ["--stagger" as string]: 3 }}>
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
          <div className="mt-6 md:mt-8">
            <QuickActions />
          </div>
        </section>

        {/* Market Overview + AI Chat (resizable split on lg+) */}
        <section ref={rowRef} className="container px-4 md:px-6 flex flex-col lg:flex-row gap-6 mb-12">
          <div
            className="animate-fade-in rounded-3xl luxe-glass p-6 w-full lg:w-auto lg:flex-1 min-w-0"
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
            <div className="h-20 w-1 rounded-full bg-foreground/10 group-hover/handle:bg-foreground/30 transition-colors" />
          </div>

          <div
            className="animate-fade-in w-full lg:w-auto min-w-0"
            style={{ animationDelay: "150ms", flexBasis: `${chatPct}%`, flexGrow: 0, flexShrink: 0 }}
          >
            <AIChat onResetSize={() => setChatPct(40)} />
          </div>
        </section>

        {/* News - full width */}
        <section className="container px-4 md:px-6 mb-12 animate-fade-in" style={{ animationDelay: "200ms" }}>
          <div className="rounded-3xl luxe-glass p-6">
            <TrendingNews />
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="relative border-t border-border/20 mt-12 bg-background/80">
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
