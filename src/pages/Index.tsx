import Header from "@/components/Header";
import MarketSentiment from "@/components/MarketSentiment";
import MarketOverview from "@/components/MarketOverview";
import AIChat from "@/components/AIChat";
import TrendingNews from "@/components/TrendingNews";
import QuickActions from "@/components/QuickActions";
import { Link } from "react-router-dom";
import { ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

const Index = () => {
  return (
    <div className="min-h-screen bg-background relative">
      {/* Subtle background gradient */}
      <div 
        className="fixed inset-0 pointer-events-none"
        style={{ background: 'var(--gradient-hero)' }}
      />
      <div className="fixed inset-0 pointer-events-none bg-dot-pattern opacity-30" />
      
      <Header />
      
      <main className="relative container px-4 md:px-6 py-8 space-y-8">
        {/* Hero Section */}
        <section className="text-center py-12 md:py-20">
          <div 
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/5 border border-primary/20 text-primary text-sm font-medium mb-6 animate-fade-in"
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
            </span>
            Live Markets • AI-Powered Analysis
          </div>
          
          <h1 
            className="text-4xl md:text-6xl lg:text-7xl font-bold text-foreground mb-6 animate-fade-in tracking-tight"
            style={{ animationDelay: "100ms" }}
          >
            Your <span className="text-gradient">AI Investing</span>
            <br className="hidden sm:block" /> Copilot
          </h1>
          
          <p 
            className="text-muted-foreground text-lg md:text-xl max-w-2xl mx-auto mb-8 animate-fade-in leading-relaxed"
            style={{ animationDelay: "200ms" }}
          >
            Smart market insights, real-time data, and AI-powered analysis to help you make better investment decisions.
          </p>

          <div 
            className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-fade-in"
            style={{ animationDelay: "300ms" }}
          >
            <Link to="/portfolio">
              <Button size="lg" className="btn-hover-lift gap-2 px-6">
                <Sparkles className="w-4 h-4" />
                Get Portfolio Recommendation
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
            <Link to="/markets">
              <Button variant="outline" size="lg" className="gap-2 px-6">
                Explore Markets
              </Button>
            </Link>
          </div>
        </section>

        {/* Market Sentiment */}
        <section className="animate-fade-in" style={{ animationDelay: "400ms" }}>
          <MarketSentiment />
        </section>

        {/* Main Content Grid */}
        <section className="grid lg:grid-cols-3 gap-6">
          {/* Left Column - Market Data */}
          <div className="lg:col-span-2 space-y-6">
            <div className="animate-fade-in" style={{ animationDelay: "500ms" }}>
              <MarketOverview />
            </div>
            <div className="animate-fade-in" style={{ animationDelay: "600ms" }}>
              <TrendingNews />
            </div>
          </div>

          {/* Right Column - AI Chat & Actions */}
          <div className="space-y-6">
            <div className="animate-fade-in" style={{ animationDelay: "500ms" }}>
              <QuickActions />
            </div>
            <div className="animate-fade-in" style={{ animationDelay: "600ms" }}>
              <AIChat />
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="relative border-t border-border/30 mt-16 bg-card/30 backdrop-blur-sm">
        <div className="container px-4 md:px-6 py-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-sm text-muted-foreground">
              © {new Date().getFullYear()} InvestAI. For educational purposes only. Not financial advice.
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