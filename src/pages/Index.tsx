import Header from "@/components/Header";
import PortfolioSummary from "@/components/PortfolioSummary";
import MarketOverview from "@/components/MarketOverview";
import AIChat from "@/components/AIChat";
import TrendingNews from "@/components/TrendingNews";
import QuickActions from "@/components/QuickActions";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container px-4 md:px-6 py-6 space-y-6">
        {/* Hero Section */}
        <section className="text-center py-8 md:py-12">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4 animate-fade-in">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
            </span>
            Markets Open • AI-Powered Analysis
          </div>
          <h1 className="text-3xl md:text-5xl font-bold text-foreground mb-4 animate-fade-in" style={{ animationDelay: "100ms" }}>
            Your <span className="text-gradient">AI Investing</span> Copilot
          </h1>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto animate-fade-in" style={{ animationDelay: "200ms" }}>
            Smart market insights, real-time data, and AI-powered analysis to help you make better investment decisions.
          </p>
        </section>

        {/* Portfolio Summary */}
        <section>
          <PortfolioSummary />
        </section>

        {/* Main Content Grid */}
        <section className="grid lg:grid-cols-3 gap-6">
          {/* Left Column - Market Data */}
          <div className="lg:col-span-2 space-y-6">
            <MarketOverview />
            <TrendingNews />
          </div>

          {/* Right Column - AI Chat & Actions */}
          <div className="space-y-6">
            <QuickActions />
            <AIChat />
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-border/50 mt-12">
        <div className="container px-4 md:px-6 py-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-sm text-muted-foreground">
              © 2024 InvestAI. For educational purposes only. Not financial advice.
            </p>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <a href="#" className="hover:text-foreground transition-colors">Terms</a>
              <a href="#" className="hover:text-foreground transition-colors">Privacy</a>
              <a href="#" className="hover:text-foreground transition-colors">Support</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
