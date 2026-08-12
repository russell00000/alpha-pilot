import { useRef, useState, useCallback } from "react";
import Header from "@/components/Header";
import QuickActions from "@/components/QuickActions";
import MarketOverview from "@/components/MarketOverview";
import AIChat from "@/components/AIChat";
import TrendingNews from "@/components/TrendingNews";
import { Link } from "react-router-dom";
import Reveal from "@/components/motion/Reveal";
import LandingHero from "@/components/LandingHero";
import TickerBar from "@/components/TickerBar";

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
      <Header />
      <TickerBar />
      
      <main className="relative">
        <LandingHero />

        <section className="container px-4 md:px-6 pb-14 md:pb-20">
          <Reveal variant="stagger">
            <QuickActions />
          </Reveal>
        </section>

        {/* Market Overview + AI Chat (resizable split on lg+) */}
        <section
          ref={rowRef}
          data-scene="analytics"
          className="container px-4 md:px-6 flex flex-col lg:flex-row gap-6 mb-20 md:mb-28"
        >
          <Reveal
            variant="depth"
            className="rounded-[22px] luxe-glass p-6 w-full lg:w-auto lg:flex-1 min-w-0"
          >
            <MarketOverview />
          </Reveal>

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

          <Reveal
            variant="depth"
            delay={120}
            className="w-full lg:w-auto min-w-0"
            style={{ flexBasis: `${chatPct}%`, flexGrow: 0, flexShrink: 0 }}
          >
            <AIChat onResetSize={() => setChatPct(40)} />
          </Reveal>
        </section>

        {/* News - full width */}
        <section data-scene="insights" className="container px-4 md:px-6 mb-20 md:mb-28">
          <Reveal variant="drift-x" className="rounded-[22px] luxe-glass p-6 md:p-8">
            <TrendingNews />
          </Reveal>
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
