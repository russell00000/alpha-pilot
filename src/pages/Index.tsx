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
        className="fixed inset-0 pointer-events-none opacity-40"
        style={{ 
          backgroundImage: `url(${financeBg})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
        }} 
      />
      {/* Dark overlay for readability */}
      <div className="fixed inset-0 pointer-events-none bg-background/70" />
      
      <Header />
      
      <main className="relative container px-4 md:px-6 py-5">
        {/* Compact hero bar */}
        <section className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-5">
          <div>
            <h1 className="text-2xl font-semibold text-foreground tracking-tight">
              Welcome to <span className="text-gradient">Vantage Portfolio Solutions</span>
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">We're here to turn your financial aspirations into reality. It all starts with the right vantage point.</p>
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
        <section className="mb-5">
          <QuickActions />
        </section>

        {/* Top row: Movers + AI Chat side by side */}
        <section className="grid lg:grid-cols-5 gap-5 mb-5">
          <div className="lg:col-span-3 animate-fade-in" style={{ animationDelay: "100ms" }}>
            <MarketOverview />
          </div>
          <div className="lg:col-span-2 animate-fade-in" style={{ animationDelay: "150ms" }}>
            <AIChat />
          </div>
        </section>

        {/* News - full width bottom */}
        <section className="animate-fade-in" style={{ animationDelay: "200ms" }}>
          <TrendingNews />
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
