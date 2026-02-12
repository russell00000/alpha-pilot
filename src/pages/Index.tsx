import Header from "@/components/Header";
import MarketOverview from "@/components/MarketOverview";
import AIChat from "@/components/AIChat";
import TrendingNews from "@/components/TrendingNews";
import QuickActions from "@/components/QuickActions";
import { Link } from "react-router-dom";
import { ArrowRight, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";

const Index = () => {
  return (
    <div className="min-h-screen bg-background relative">
      {/* Minimal ambient glow */}
      <div className="fixed inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse at 50% 0%, hsl(210 100% 60% / 0.04) 0%, transparent 60%)' }} />
      
      <Header />
      
      <main className="relative container px-4 md:px-6 pt-6 pb-16">
        {/* Hero - compact, left-aligned */}
        <section className="grid lg:grid-cols-2 gap-8 items-center py-12 md:py-20 lg:py-24">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/5 border border-primary/10 text-primary text-xs font-medium tracking-wide uppercase">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-primary"></span>
              </span>
              Live Markets
            </div>
            
            <h1 className="text-5xl md:text-6xl lg:text-7xl font-semibold text-foreground leading-[1.05] tracking-tight">
              Your <span className="text-gradient">AI Investing</span> Copilot
            </h1>
            
            <p className="text-muted-foreground text-lg max-w-md leading-relaxed">
              Intelligent market analysis and portfolio insights, powered by AI.
            </p>

            <div className="flex items-center gap-3 pt-2">
              <Link to="/portfolio">
                <Button size="lg" className="btn-hover-lift gap-2 h-12 px-7 text-sm font-medium rounded-xl">
                  <Zap className="w-4 h-4" />
                  Get Started
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
              <Link to="/markets">
                <Button variant="outline" size="lg" className="gap-2 h-12 px-7 text-sm font-medium border-border/40 hover:bg-secondary/40 rounded-xl">
                  Explore Markets
                </Button>
              </Link>
            </div>
          </div>

          {/* AI Chat embedded in hero */}
          <div className="animate-fade-in" style={{ animationDelay: "200ms" }}>
            <AIChat />
          </div>
        </section>

        {/* Quick Actions - horizontal strip */}
        <section className="animate-fade-in mb-8" style={{ animationDelay: "300ms" }}>
          <QuickActions />
        </section>

        {/* Content: Market + News side by side */}
        <section className="grid lg:grid-cols-2 gap-6">
          <div className="animate-fade-in" style={{ animationDelay: "400ms" }}>
            <MarketOverview />
          </div>
          <div className="animate-fade-in" style={{ animationDelay: "450ms" }}>
            <TrendingNews />
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="relative border-t border-border/20 bg-background">
        <div className="container px-4 md:px-6 py-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
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
