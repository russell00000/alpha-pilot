import { computeRisk, sectorBreakdown, type Holding } from '@/lib/portfolioAnalysis';
import { Activity, TrendingUp, Shield, Layers } from 'lucide-react';

const fmtUSD = (n: number) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const fmtPct = (n: number, d = 1) => `${(n * 100).toFixed(d)}%`;

const RiskMetricsPanel = ({ holdings }: { holdings: Holding[] }) => {
  const risk = computeRisk(holdings);
  const sectors = sectorBreakdown(holdings).slice(0, 6);

  const cards = [
    { label: 'Portfolio Value', value: fmtUSD(risk.totalValue), icon: TrendingUp, tone: 'text-foreground' },
    { label: 'Weighted Beta', value: risk.weightedBeta.toFixed(2), icon: Activity, tone: 'text-foreground' },
    { label: 'Volatility (ann.)', value: fmtPct(risk.volatility), icon: Activity, tone: 'text-foreground' },
    { label: 'Sharpe (est.)', value: risk.sharpe.toFixed(2), icon: TrendingUp, tone: 'text-foreground' },
    { label: 'Concentration (HHI)', value: risk.hhi.toFixed(2), icon: Shield, tone: risk.hhi > 0.25 ? 'text-orange-400' : 'text-foreground' },
    { label: 'Diversification', value: `${risk.diversificationScore}/100`, icon: Layers, tone: risk.diversificationScore < 50 ? 'text-orange-400' : 'text-emerald-400' },
  ];

  return (
    <div className="luxe-glass rounded-3xl p-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="text-base font-semibold">Risk Analysis</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Institutional metrics on your linked book.</p>
        </div>
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground px-2.5 py-1 rounded-full border border-border/40">
          {risk.riskGrade}
        </span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {cards.map((c) => (
          <div key={c.label} className="rounded-2xl border border-border/40 bg-background/30 p-4">
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-muted-foreground">
              <c.icon className="w-3 h-3" /> {c.label}
            </div>
            <div className={`mt-2 font-mono text-lg ${c.tone}`}>{c.value}</div>
          </div>
        ))}
      </div>

      <div className="mt-6">
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Sector Exposure</div>
        <div className="space-y-2">
          {sectors.map((s) => (
            <div key={s.sector} className="flex items-center gap-3">
              <div className="w-32 md:w-40 text-xs text-muted-foreground truncate">{s.sector}</div>
              <div className="flex-1 h-2 rounded-full bg-secondary/40 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-primary/70 to-primary/40"
                  style={{ width: `${Math.min(100, s.weight * 100)}%` }}
                />
              </div>
              <div className="w-14 text-right font-mono text-xs">{fmtPct(s.weight)}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default RiskMetricsPanel;