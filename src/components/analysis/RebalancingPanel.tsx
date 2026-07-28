import { useState } from 'react';
import { buildRebalance, MODELS, type Holding, type ModelId } from '@/lib/portfolioAnalysis';
import { Scale, ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

const fmtUSD = (n: number) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const fmtPct = (n: number, d = 1) => `${(n * 100).toFixed(d)}%`;

const RebalancingPanel = ({ holdings }: { holdings: Holding[] }) => {
  const [model, setModel] = useState<ModelId>('growth');
  const rows = buildRebalance(holdings, model);

  return (
    <div className="luxe-glass rounded-3xl p-6">
      <div className="flex items-start justify-between gap-4 mb-5">
        <div>
          <div className="flex items-center gap-2">
            <Scale className="w-4 h-4 text-primary" />
            <h3 className="text-base font-semibold">Rebalancing Plan</h3>
          </div>
          <p className="text-xs text-muted-foreground mt-1">{MODELS[model].description}</p>
        </div>

        <div className="flex flex-wrap gap-1 rounded-full border border-border/40 bg-background/30 p-1">
          {(Object.keys(MODELS) as ModelId[]).map((m) => (
            <button
              key={m}
              onClick={() => setModel(m)}
              className={cn(
                'text-[11px] font-medium px-3 py-1 rounded-full transition-colors',
                model === m ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {MODELS[m].label}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto -mx-2">
        <table className="w-full text-sm">
          <thead className="text-[10px] uppercase tracking-widest text-muted-foreground">
            <tr>
              <th className="text-left font-normal px-2 pb-3">Asset Class</th>
              <th className="text-right font-normal px-2 pb-3">Current</th>
              <th className="text-right font-normal px-2 pb-3">Target</th>
              <th className="text-right font-normal px-2 pb-3">Change</th>
              <th className="text-right font-normal px-2 pb-3">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/30">
            {rows.map((r) => {
              const Icon = r.action === 'Buy' ? ArrowUpRight : r.action === 'Sell' ? ArrowDownRight : Minus;
              const tone = r.action === 'Buy'
                ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                : r.action === 'Sell'
                  ? 'text-red-400 bg-red-500/10 border-red-500/20'
                  : 'text-muted-foreground bg-secondary/40 border-border/40';
              return (
                <tr key={r.asset_class} className="hover:bg-secondary/20 transition-colors">
                  <td className="px-2 py-3 capitalize">{r.asset_class.replace('_', ' ')}</td>
                  <td className="px-2 py-3 text-right font-mono">{fmtPct(r.currentWeight)}</td>
                  <td className="px-2 py-3 text-right font-mono">{fmtPct(r.targetWeight)}</td>
                  <td className={cn(
                    'px-2 py-3 text-right font-mono',
                    r.deltaValue > 0 ? 'text-emerald-400' : r.deltaValue < 0 ? 'text-red-400' : 'text-muted-foreground'
                  )}>
                    {r.deltaValue >= 0 ? '+' : ''}{fmtUSD(r.deltaValue)}
                  </td>
                  <td className="px-2 py-3 text-right">
                    <span className={cn('inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full border', tone)}>
                      <Icon className="w-3 h-3" /> {r.action}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-4 text-[11px] text-muted-foreground leading-relaxed">
        Trade sizes shown are the dollar amounts needed to bring each asset class in line with the {MODELS[model].label.toLowerCase()} model. Positions are ranked by impact so you can execute the largest deltas first.
      </div>
    </div>
  );
};

export default RebalancingPanel;