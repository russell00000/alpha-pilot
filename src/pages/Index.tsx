import Header from "@/components/Header";
import MarketOverview from "@/components/MarketOverview";
import AIChat from "@/components/AIChat";
import TrendingNews from "@/components/TrendingNews";
import QuickActions from "@/components/QuickActions";
import { Link } from "react-router-dom";
import { ArrowRight, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import financeBg from "@/assets/finance-bg.jpg";

const Index = () => {
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
          <h1 className="text-5xl md:text-7xl font-bold text-white tracking-tight max-w-4xl animate-fade-in drop-shadow-[0_2px_12px_rgba(0,0,0,0.85)] leading-[1.05]">
            Welcome to{" "}
            <span className="bg-gradient-to-b from-white to-zinc-500 bg-clip-text text-transparent">
              Vantage Portfolio
            </span>
          </h1>
          <p className="text-lg md:text-xl text-white/90 mt-6 max-w-2xl animate-fade-in font-light leading-relaxed drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]" style={{ animationDelay: "100ms" }}>
            We're here to turn your financial aspirations into reality. It all starts with the right vantage point.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 mt-10 animate-fade-in" style={{ animationDelay: "200ms" }}>
            <Link to="/portfolio">
              <Button
                size="lg"
                className="gap-2 px-8 py-6 text-sm font-semibold rounded-full bg-zinc-100 text-black hover:bg-white hover:scale-[1.03] active:scale-95 transition-all shadow-[0_0_30px_rgba(255,255,255,0.15)]"
              >
                <Zap className="w-4 h-4" />
                Get Started
                <ArrowRight className="w-4 h-4" />
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

        {/* Market Overview + AI Chat */}
        <section className="container px-4 md:px-6 grid lg:grid-cols-5 gap-6 mb-12">
          <div className="lg:col-span-3 animate-fade-in rounded-3xl bg-white/[0.03] backdrop-blur-xl border border-white/10 p-6 shadow-2xl shadow-black/40" style={{ animationDelay: "100ms" }}>
            <MarketOverview />
          </div>
          <div className="lg:col-span-2 animate-fade-in" style={{ animationDelay: "150ms" }}>
            <AIChat />
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
