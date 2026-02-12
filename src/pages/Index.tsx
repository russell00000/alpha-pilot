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
      <div className="fixed inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse at 50% 0%, hsl(210 100% 60% / 0.04) 0%, transparent 60%)' }} />
      
      <Header />
      
      <main className="relative container px-4 md:px-6 py-5">
        {/* Compact hero bar */}
        <section className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-4">
            <div>
              <h1 className="text-2xl font-semibold text-foreground tracking-tight">
                Welcome to <span className="text-gradient">Vantage</span>
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5">AI-powered market insights & portfolio analysis</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/portfolio">
              <Button size="sm" className="gap-1.5 h-9 px-4 text-sm font-medium rounded-lg">
                <Zap className="w-3.5 h-3.5" />
                Get Started
                <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            </Link>
            <Link to="/markets">
              <Button variant="outline" size="sm" className="h-9 px-4 text-sm font-medium border-border/40 hover:bg-secondary/40 rounded-lg">
                All Markets
              </Button>
            </Link>
          </div>
        </section>

        {/* Quick Actions */}
        <section className="mb-6">
          <QuickActions />
        </section>

        {/* Main dashboard grid - 3 columns */}
        <section className="grid lg:grid-cols-12 gap-5">
          {/* Market Overview - left */}
          <div className="lg:col-span-4 animate-fade-in" style={{ animationDelay: "100ms" }}>
            <MarketOverview />
          </div>

          {/* News - center */}
          <div className="lg:col-span-4 animate-fade-in" style={{ animationDelay: "150ms" }}>
            <TrendingNews />
          </div>

          {/* AI Chat - right */}
          <div className="lg:col-span-4 animate-fade-in" style={{ animationDelay: "200ms" }}>
            <AIChat />
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="relative border-t border-border/20 mt-12 bg-background">
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
