import { useRef, useState, useCallback } from "react";
import Header from "@/components/Header";
import QuickActions from "@/components/QuickActions";
import MarketOverview from "@/components/MarketOverview";
import AIChat from "@/components/AIChat";
import TrendingNews from "@/components/TrendingNews";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import financeBg from "@/assets/finance-bg.webp";

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
      {/* Finance background */}
      <div 
        className="fixed inset-0 pointer-events-none opacity-100"
        style={{ 
          backgroundImage: `url(${financeBg})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
        }} 
      />
      {/* Dark overlay for readability */}
      <div className="fixed inset-0 pointer-events-none bg-background/75" />
      
      <Header />
      
      <main className="relative">
        {/* Hero section - generous breathing room */}
        <section className="container px-4 md:px-6 flex flex-col items-center justify-center text-center min-h-[75vh] py-28">
          <span className="text-[10px] uppercase tracking-[0.3em] font-bold text-muted-foreground mb-6 animate-fade-in px-3 py-1.5 rounded-full bg-white/[0.04] border border-white/[0.08] backdrop-blur-md">
            AI · Investing Copilot
          </span>
          <h1 className="text-6xl md:text-8xl font-bold text-white tracking-tight max-w-5xl animate-fade-in drop-shadow-[0_2px_12px_rgba(0,0,0,0.85)] leading-[1.02]" style={{ animationDelay: "50ms" }}>
            Welcome to{" "}
            <span className="bg-gradient-to-b from-white via-white to-zinc-500 bg-clip-text text-transparent">
              Vantage
            </span>
          </h1>
          <p className="text-lg md:text-xl text-white/80 mt-6 max-w-2xl animate-fade-in font-light leading-relaxed drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]" style={{ animationDelay: "100ms" }}>
            Your capital, elevated. Real-time intelligence and AI-driven insights for the modern portfolio.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 mt-10 animate-fade-in" style={{ animationDelay: "200ms" }}>
            <Link to="/portfolio">
              <Button
                size="lg"
                className="group gap-2 px-8 py-6 text-sm font-semibold rounded-full bg-white text-black hover:bg-zinc-200 hover:scale-[1.03] active:scale-95 transition-all shadow-[0_0_40px_rgba(255,255,255,0.2)]"
              >
                Get Started
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
            <Link to="/markets">
              <Button
                variant="outline"
                size="lg"
                className="px-8 py-6 text-sm font-medium rounded-full bg-white/5 backdrop-blur-md border-white/10 text-white hover:bg-white/10 hover:text-white transition-all"
              >
                All Markets
              </Button>
            </Link>
          </div>
        </section>

        {/* Quick Actions - floating chips, no wrapper */}
        <section className="container px-4 md:px-6 mb-12">
          <QuickActions />
        </section>

        {/* Market Overview + AI Chat (resizable split on lg+) */}
        <section ref={rowRef} className="container px-4 md:px-6 flex flex-col lg:flex-row gap-6 mb-12">
          <div
            className="animate-fade-in rounded-3xl bg-white/[0.03] backdrop-blur-xl border border-white/10 p-6 shadow-2xl shadow-black/40 w-full lg:w-auto lg:flex-1 min-w-0"
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
          <div className="rounded-3xl bg-white/[0.03] backdrop-blur-xl border border-white/10 p-6 shadow-2xl shadow-black/40">
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
