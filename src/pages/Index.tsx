import { useRef, useState, useCallback } from "react";
import Header from "@/components/Header";
import QuickActions from "@/components/QuickActions";
import MarketOverview from "@/components/MarketOverview";
import AIChat from "@/components/AIChat";
import TrendingNews from "@/components/TrendingNews";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

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
      {/* Premium abstract financial background — institutional, restrained */}
      {/* Deep navy-to-black base gradient */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          background:
            'linear-gradient(180deg, hsl(220 40% 12%) 0%, hsl(220 28% 8%) 44%, hsl(var(--background)) 100%)',
        }}
      />
      {/* Broad institutional lighting — visible, but still restrained */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div
          className="absolute -top-[18%] left-[8%] w-[64vw] h-[64vw] rounded-full blur-[105px]"
          style={{
            background: 'radial-gradient(circle, hsl(38 80% 58% / 0.16), transparent 68%)',
          }}
        />
        <div
          className="absolute top-[16%] -right-[12%] w-[58vw] h-[58vw] rounded-full blur-[115px]"
          style={{
            background: 'radial-gradient(circle, hsl(205 70% 58% / 0.14), transparent 70%)',
          }}
        />
      </div>
      {/* Subtle radial lighting behind headline — warm amber, sparing */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 55% 36% at 50% 24%, hsl(38 82% 58% / 0.16) 0%, transparent 72%)',
        }}
      />
      {/* Faint grid pattern — visible on dark screens without feeling busy */}
      <div className="fixed inset-0 pointer-events-none opacity-[0.12] bg-grid-pattern" />
      {/* Thin market line — amber-tinted and placed through the hero */}
      <svg
        className="fixed inset-x-0 top-[18%] w-full h-[40vh] pointer-events-none opacity-[0.18] mix-blend-screen"
        viewBox="0 0 1600 400"
        preserveAspectRatio="none"
        aria-hidden
      >
        <defs>
          <linearGradient id="chartLine" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor="hsl(38 60% 70%)" stopOpacity="0" />
            <stop offset="20%" stopColor="hsl(38 60% 70%)" stopOpacity="1" />
            <stop offset="80%" stopColor="hsl(38 60% 70%)" stopOpacity="1" />
            <stop offset="100%" stopColor="hsl(38 60% 70%)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path
          d="M0,280 C120,260 220,300 340,240 C460,180 560,220 680,190 C800,160 900,210 1020,150 C1140,90 1240,140 1360,110 C1460,85 1540,120 1600,90"
          fill="none"
          stroke="url(#chartLine)"
          strokeWidth="1.25"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <svg
        className="fixed inset-x-0 top-[8%] w-full h-[58vh] pointer-events-none opacity-[0.10]"
        viewBox="0 0 1600 560"
        preserveAspectRatio="none"
        aria-hidden
      >
        <g fill="none" stroke="hsl(0 0% 100% / 0.42)" strokeWidth="1" vectorEffect="non-scaling-stroke">
          <path d="M-40,360 C180,315 280,390 520,330 C760,270 820,210 1040,250 C1240,286 1340,210 1640,240" />
          <path d="M-40,410 C220,355 330,430 560,370 C790,310 860,252 1080,292 C1260,326 1385,262 1640,292" opacity="0.55" />
          <path d="M-40,462 C220,407 360,478 600,418 C820,362 900,305 1135,342 C1310,370 1420,318 1640,340" opacity="0.35" />
        </g>
      </svg>
      {/* Quiet vignette for readability — does not compete with text */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 82% 58% at 50% 30%, transparent 0%, hsl(var(--background) / 0.26) 82%)',
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
