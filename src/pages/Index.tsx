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
    <div className="min-h-screen relative" style={{ background: 'hsl(var(--background))' }}>
      {/* Institutional hero background — layered depth, no illustrations */}
      {/* Base: midnight navy → deep slate → graphite → page bg */}
      <div
        className="absolute inset-x-0 top-0 h-[1100px] pointer-events-none"
        style={{
          background:
            'linear-gradient(180deg, #0B1020 0%, #0E1426 34%, #111827 66%, hsl(var(--background)) 100%)',
        }}
      />
      {/* Soft radial key light centered behind the headline */}
      <div
        className="absolute inset-x-0 top-0 h-[900px] pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 55% 45% at 50% 26%, hsl(210 40% 70% / 0.10) 0%, transparent 70%)',
        }}
      />
      {/* Cool blue fill light — very restrained */}
      <div className="absolute inset-x-0 top-0 h-[1100px] pointer-events-none overflow-hidden">
        <div
          className="absolute -top-[8%] left-[10%] w-[55vw] h-[55vw] rounded-full blur-[140px]"
          style={{ background: 'radial-gradient(circle, hsl(215 60% 55% / 0.10), transparent 70%)' }}
        />
        <div
          className="absolute top-[6%] -right-[10%] w-[50vw] h-[50vw] rounded-full blur-[150px]"
          style={{ background: 'radial-gradient(circle, hsl(220 40% 40% / 0.14), transparent 72%)' }}
        />
        {/* muted gold whisper, low & centered — barely there */}
        <div
          className="absolute top-[28%] left-1/2 -translate-x-1/2 w-[40vw] h-[40vw] rounded-full blur-[160px]"
          style={{ background: 'radial-gradient(circle, hsl(42 40% 60% / 0.06), transparent 70%)' }}
        />
      </div>
      {/* Extremely faint financial grid (~4%) */}
      <div
        className="absolute inset-x-0 top-0 h-[1100px] pointer-events-none opacity-[0.04]"
        style={{
          backgroundImage:
            'linear-gradient(hsl(0 0% 100% / 1) 1px, transparent 1px), linear-gradient(90deg, hsl(0 0% 100% / 1) 1px, transparent 1px)',
          backgroundSize: '64px 64px',
          maskImage:
            'radial-gradient(ellipse 70% 60% at 50% 30%, black 40%, transparent 85%)',
          WebkitMaskImage:
            'radial-gradient(ellipse 70% 60% at 50% 30%, black 40%, transparent 85%)',
        }}
      />
      {/* Tiny glowing data points connected by thin lines — barely visible */}
      <svg
        className="absolute inset-x-0 top-[80px] w-full h-[640px] pointer-events-none opacity-[0.18]"
        viewBox="0 0 1600 640"
        preserveAspectRatio="none"
        aria-hidden
      >
        <g stroke="hsl(210 30% 80% / 0.35)" strokeWidth="0.6" fill="none" vectorEffect="non-scaling-stroke">
          <path d="M120,180 L340,120 L560,240 L820,150 L1080,220 L1320,140 L1500,200" />
          <path d="M80,420 L300,480 L520,380 L780,460 L1040,360 L1280,440 L1520,380" opacity="0.5" />
        </g>
        <g fill="hsl(210 40% 90%)">
          {[
            [120,180],[340,120],[560,240],[820,150],[1080,220],[1320,140],[1500,200],
            [80,420],[300,480],[520,380],[780,460],[1040,360],[1280,440],[1520,380],
          ].map(([x,y],i)=>(
            <circle key={i} cx={x} cy={y} r="1.6" opacity="0.9" />
          ))}
        </g>
      </svg>
      {/* Edge vignette for boardroom depth */}
      <div
        className="absolute inset-x-0 top-0 h-[1100px] pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 90% 70% at 50% 40%, transparent 55%, hsl(220 40% 4% / 0.55) 100%)',
        }}
      />
      {/* Soft glass reflection sweep near top */}
      <div
        className="absolute inset-x-0 top-0 h-[420px] pointer-events-none"
        style={{
          background:
            'linear-gradient(180deg, hsl(0 0% 100% / 0.04) 0%, transparent 100%)',
        }}
      />
      {/* Bottom fade into page background */}
      <div
        className="absolute inset-x-0 top-[800px] h-[400px] pointer-events-none"
        style={{
          background:
            'linear-gradient(180deg, transparent 0%, hsl(var(--background)) 90%)',
        }}
      />

      <Header />
      
      <main className="relative">
        {/* First screen: zoomed-out hero with actions fitting above the fold */}
        <section className="container px-4 md:px-6 h-[560px] md:h-[620px] flex flex-col justify-center pt-4 pb-4 text-center [text-shadow:0_2px_18px_hsl(var(--background)/0.9)]">
          <div className="flex flex-col items-center justify-center">
            <span className="relative text-[10px] uppercase tracking-[0.3em] font-bold text-foreground/80 mb-5 animate-fade-in px-3.5 py-1.5 rounded-full luxe-glass overflow-hidden">
              <span className="relative z-10 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-primary/90 animate-pulse" />
                AI · Investing Copilot
              </span>
            </span>
            <h1 className="text-4xl sm:text-5xl md:text-7xl font-bold tracking-tight max-w-5xl leading-[1.04]">
              Welcome to{" "}
              <span>Vantage</span>
              <span className="block">Portfolio Solutions</span>
            </h1>
            <p className="text-sm md:text-lg text-foreground mt-5 max-w-xl animate-fade-in font-normal leading-relaxed tracking-wide [text-shadow:0_1px_16px_hsl(var(--background)/0.95),0_0_28px_hsl(var(--primary)/0.18)]" style={{ animationDelay: "100ms" }}>
              Your capital, elevated. Real-time intelligence and AI-driven insights for the modern portfolio.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3 mt-7 animate-fade-in" style={{ animationDelay: "200ms" }}>
              <Link to="/portfolio">
                <Button
                  size="lg"
                  className="luxe-sheen group gap-2 px-8 py-5 text-sm font-semibold rounded-full bg-primary text-primary-foreground hover:bg-primary hover:scale-[1.02] active:scale-95 transition-all shadow-[0_8px_24px_-12px_hsl(0_0%_0%/0.6)]"
                >
                  Get Started
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </Button>
              </Link>
              <Link to="/markets">
                <Button
                  variant="outline"
                  size="lg"
                  className="luxe-sheen px-8 py-5 text-sm font-medium rounded-full bg-background/15 backdrop-blur-md border-border/60 text-foreground hover:bg-secondary/60 hover:text-foreground hover:border-border transition-all"
                >
                  All Markets
                </Button>
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
            <div className="h-20 w-1 rounded-full bg-white/10 group-hover/handle:bg-white/30 transition-colors" />
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
