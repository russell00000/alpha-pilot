import Header from "@/components/Header";
import MarketOverview from "@/components/MarketOverview";
import AIChat from "@/components/AIChat";
import TrendingNews from "@/components/TrendingNews";
import QuickActions from "@/components/QuickActions";
import { Link } from "react-router-dom";
import { ArrowRight, Zap, TrendingUp, MessageSquare, BarChart3, Newspaper } from "lucide-react";
import { Button } from "@/components/ui/button";

const Index = () => {
  return (
    <div className="min-h-screen bg-background relative">
      {/* Subtle background gradient */}
      <div 
        className="fixed inset-0 pointer-events-none"
        style={{ background: 'var(--gradient-hero)' }}
      />
      <div className="fixed inset-0 pointer-events-none bg-dot-pattern opacity-20" />
      
      <Header />
      
      <main className="relative container px-4 md:px-6 py-8 space-y-8">
        {/* Compact Hero + Quick Actions Row */}
        <section className="grid lg:grid-cols-5 gap-6 items-center py-10 md:py-16">
          {/* Hero Text - Left */}
          <div className="lg:col-span-3 space-y-5">
            <div 
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/8 border border-primary/15 text-primary text-sm font-medium animate-fade-in"
            >
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-primary"></span>
              </span>
              Live Markets · AI-Powered
            </div>
            
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-semibold text-foreground animate-fade-in" style={{ animationDelay: "100ms" }}>
              Your <span className="text-gradient">AI Investing</span>
              <br className="hidden sm:block" /> Copilot
            </h1>
            
            <p className="text-muted-foreground text-base md:text-lg max-w-xl animate-fade-in leading-relaxed" style={{ animationDelay: "200ms" }}>
              Intelligent market insights and AI-powered analysis to help you make smarter investment decisions.
            </p>

            <div className="flex flex-col sm:flex-row items-start gap-3 animate-fade-in" style={{ animationDelay: "300ms" }}>
              <Link to="/portfolio">
                <Button size="lg" className="btn-hover-lift gap-2 h-11 px-6 text-sm font-medium">
                  <Zap className="w-4 h-4" />
                  Get Started
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
              <Link to="/markets">
                <Button variant="outline" size="lg" className="gap-2 h-11 px-6 text-sm font-medium border-border/60 hover:bg-secondary/50">
                  Explore Markets
                </Button>
              </Link>
            </div>
          </div>

          {/* Quick Actions - Right */}
          <div className="lg:col-span-2 animate-fade-in" style={{ animationDelay: "400ms" }}>
            <QuickActions />
          </div>
        </section>

        {/* Full-width Content Grid */}
        <section className="grid lg:grid-cols-5 gap-5">
          {/* Market Overview - spans wider */}
          <div className="lg:col-span-3 animate-fade-in" style={{ animationDelay: "500ms" }}>
            <MarketOverview />
          </div>

          {/* AI Chat - taller right column */}
          <div className="lg:col-span-2 animate-fade-in" style={{ animationDelay: "500ms" }}>
            <AIChat />
          </div>
        </section>

        {/* Trending News - full width */}
        <section className="animate-fade-in" style={{ animationDelay: "600ms" }}>
          <TrendingNews />
        </section>
      </main>

      {/* Footer */}
      <footer className="relative border-t border-border/40 mt-20 bg-card/50">
        <div className="container px-4 md:px-6 py-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-sm text-muted-foreground">
              © {new Date().getFullYear()} InvestAI. For educational purposes only.
            </p>
            <div className="flex items-center gap-6 text-sm text-muted-foreground">
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
