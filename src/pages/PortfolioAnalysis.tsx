import { useEffect, useMemo, useState } from 'react';
import Header from '@/components/Header';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Navigate } from 'react-router-dom';
import ConnectBrokerage from '@/components/analysis/ConnectBrokerage';
import RiskMetricsPanel from '@/components/analysis/RiskMetricsPanel';
import RebalancingPanel from '@/components/analysis/RebalancingPanel';
import AIRecommendations from '@/components/analysis/AIRecommendations';
import { DEMO_HOLDINGS, type Holding } from '@/lib/portfolioAnalysis';
import { Loader2 } from 'lucide-react';

const PortfolioAnalysis = () => {
  const { user, loading: authLoading } = useAuth();
  const [demoMode, setDemoMode] = useState(false);
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('brokerage_holdings')
        .select('symbol, name, quantity, cost_basis, market_value, asset_class, sector');
      if (cancelled) return;
      if (error) {
        console.error('Failed to load holdings', error);
        setHoldings([]);
      } else {
        setHoldings(
          (data ?? []).map((h) => ({
            symbol: h.symbol,
            name: h.name,
            quantity: Number(h.quantity),
            cost_basis: h.cost_basis == null ? null : Number(h.cost_basis),
            market_value: Number(h.market_value ?? 0),
            asset_class: h.asset_class,
            sector: h.sector,
          })),
        );
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [user]);

  const activeHoldings = useMemo<Holding[]>(
    () => (demoMode || holdings.length === 0 ? DEMO_HOLDINGS : holdings),
    [demoMode, holdings],
  );

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container px-4 py-24 flex items-center justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }
  if (!user) return <Navigate to="/auth" replace />;

  const hasLive = holdings.length > 0 && !demoMode;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main data-scene="analytics" className="container px-4 md:px-6 py-8 space-y-6">
        <div className="animate-fade-in">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <span className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Portfolio Analysis</span>
              <h1 className="text-2xl md:text-3xl font-semibold tracking-tight mt-1">
                {hasLive ? 'Your linked book' : 'Institutional-grade analysis on your real portfolio'}
              </h1>
              <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
                Risk metrics, rebalancing plans, and AI-driven Add/Trim/Sell recommendations — driven by holdings from your brokerage.
              </p>
            </div>
            {(demoMode || hasLive) && (
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground px-3 py-1 rounded-full border border-border/40">
                {demoMode ? 'Demo Data' : 'Live Data'}
              </span>
            )}
          </div>
        </div>

        <ConnectBrokerage
          onDemoMode={() => setDemoMode(true)}
          onLinked={() => { /* future: refetch */ }}
          isDemoMode={demoMode}
        />

        {loading && !demoMode ? (
          <div className="luxe-glass rounded-3xl p-10 flex items-center justify-center">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <div className="grid gap-6 lg:grid-cols-2">
              <RiskMetricsPanel holdings={activeHoldings} />
              <RebalancingPanel holdings={activeHoldings} />
            </div>
            <AIRecommendations holdings={activeHoldings} />
          </>
        )}
      </main>
    </div>
  );
};

export default PortfolioAnalysis;