import Header from "@/components/Header";

const Practice = () => {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container px-4 md:px-6 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-foreground mb-2">Practice Investing</h1>
          <p className="text-muted-foreground">
            Sharpen your skills with simulated trades — no real money at risk.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-xl border border-border/60 bg-card p-6 space-y-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <span className="text-lg">📊</span>
            </div>
            <h3 className="font-semibold text-foreground">Paper Trading</h3>
            <p className="text-sm text-muted-foreground">
              Buy and sell stocks with virtual cash and track your performance over time.
            </p>
          </div>

          <div className="rounded-xl border border-border/60 bg-card p-6 space-y-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <span className="text-lg">🎯</span>
            </div>
            <h3 className="font-semibold text-foreground">Challenges</h3>
            <p className="text-sm text-muted-foreground">
              Compete in timed investing challenges and see how your strategy stacks up.
            </p>
          </div>

          <div className="rounded-xl border border-border/60 bg-card p-6 space-y-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <span className="text-lg">📚</span>
            </div>
            <h3 className="font-semibold text-foreground">Learn & Earn</h3>
            <p className="text-sm text-muted-foreground">
              Complete lessons on investing fundamentals and earn virtual rewards.
            </p>
          </div>
        </div>

        <div className="mt-8 rounded-xl border border-border/60 bg-card p-8 text-center">
          <p className="text-muted-foreground text-sm">
            Practice investing features coming soon. Stay tuned!
          </p>
        </div>
      </main>
    </div>
  );
};

export default Practice;
