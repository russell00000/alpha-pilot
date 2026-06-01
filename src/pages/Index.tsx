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
          <h1 className="text-4xl md:text-6xl font-bold text-white tracking-tight max-w-3xl animate-fade-in drop-shadow-[0_2px_12px_rgba(0,0,0,0.85)]">
            Welcome to <span className="text-gradient">Vantage Portfolio Solutions</span>
          </h1>
          <p className="text-lg md:text-xl text-white/95 mt-6 max-w-xl animate-fade-in font-normal drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]" style={{ animationDelay: "100ms" }}>
            We're here to turn your financial aspirations into reality. It all starts with the right vantage point.
          </p>
          <div className="flex items-center gap-3 mt-8 animate-fade-in" style={{ animationDelay: "200ms" }}>
            <Link to="/portfolio">
              <Button size="lg" className="gap-2 px-6 text-sm font-medium rounded-lg">
                <Zap className="w-4 h-4" />
                Get Started
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
            <Link to="/markets">
              <Button variant="outline" size="lg" className="px-6 text-sm font-medium border-border/40 hover:bg-secondary/40 rounded-lg">
                All Markets
              </Button>
            </Link>
          </div>
        </section>

        {/* Quick Actions */}
        <section className="container px-4 md:px-6 mb-10">
          <div className="rounded-2xl bg-background/50 backdrop-blur-sm border border-border/20 p-4">
            <QuickActions />
          </div>
        </section>

        {/* Market Overview + AI Chat */}
        <section className="container px-4 md:px-6 grid lg:grid-cols-5 gap-6 mb-12">
          <div className="lg:col-span-3 animate-fade-in rounded-2xl bg-background/50 backdrop-blur-sm border border-border/20 p-5" style={{ animationDelay: "100ms" }}>
            <MarketOverview />
          </div>
          <div className="lg:col-span-2 animate-fade-in" style={{ animationDelay: "150ms" }}>
            <AIChat />
          </div>
        </section>

        {/* News - full width */}
        <section className="container px-4 md:px-6 mb-12 animate-fade-in" style={{ animationDelay: "200ms" }}>
          <div className="rounded-2xl bg-background/50 backdrop-blur-sm border border-border/20 p-5">
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
