import Header from "@/components/Header";

const Practice = () => {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container px-4 md:px-6 py-8">
        <div className="mb-12">
          <h1 className="text-4xl font-bold text-foreground mb-4">Practice Investing</h1>
          <p className="text-lg text-muted-foreground max-w-3xl">
            Learn and test investment strategies in a simulated environment.
          </p>
        </div>

        <div className="mb-8 rounded-xl border border-border/60 bg-card p-8">
          <div className="space-y-4">
            <div>
              <h2 className="text-2xl font-semibold text-foreground mb-2">Start with $10,000 Virtual Capital</h2>
              <p className="text-muted-foreground">
                Build a hypothetical portfolio using real-time market data and our AI-powered research tools.
              </p>
            </div>
          </div>
        </div>

        <div className="mb-12">
          <h3 className="text-xl font-semibold text-foreground mb-6">This feature allows you to:</h3>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-border/60 bg-card p-6 space-y-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <span className="text-lg">🔍</span>
              </div>
              <h4 className="font-semibold text-foreground">Analyze Securities</h4>
              <p className="text-sm text-muted-foreground">
                Research stocks, ETFs, and funds with detailed metrics and AI insights.
              </p>
            </div>

            <div className="rounded-xl border border-border/60 bg-card p-6 space-y-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <span className="text-lg">🎯</span>
              </div>
              <h4 className="font-semibold text-foreground">Construct Portfolios</h4>
              <p className="text-sm text-muted-foreground">
                Build diversified portfolios tailored to your investment goals.
              </p>
            </div>

            <div className="rounded-xl border border-border/60 bg-card p-6 space-y-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <span className="text-lg">📊</span>
              </div>
              <h4 className="font-semibold text-foreground">Simulate Trades</h4>
              <p className="text-sm text-muted-foreground">
                Execute buy and sell decisions without any real financial risk.
              </p>
            </div>

            <div className="rounded-xl border border-border/60 bg-card p-6 space-y-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <span className="text-lg">📈</span>
              </div>
              <h4 className="font-semibold text-foreground">Track Performance</h4>
              <p className="text-sm text-muted-foreground">
                Monitor your portfolio's progress and learn from your decisions.
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-8">
          <h3 className="font-semibold text-foreground mb-4">⚠️ Important Disclaimer</h3>
          <div className="space-y-3 text-sm text-muted-foreground">
            <p>All transactions occur in a simulated environment. No real money is used, and no trades are executed in live markets.</p>
            <p>This tool is designed for educational and planning purposes only.</p>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Practice;
