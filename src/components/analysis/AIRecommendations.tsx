import { positionRecs, type Holding } from '@/lib/portfolioAnalysis';
import { Sparkles, TrendingUp, TrendingDown, XCircle, Minus, RefreshCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Link } from 'react-router-dom';

const fmtPct = (n: number, d = 1) => `${(n * 100).toFixed(d)}%`;

const ICONS = {
  Add: TrendingUp,
  Trim: TrendingDown,
  Sell: XCircle,
  Hold: Minus,
  Replace: RefreshCcw,
};
const TONES: Record<string, string> = {
  Add: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  Trim: 'text-orange-400 bg-orange-500/10 border-orange-500/20',
  Sell: 'text-red-400 bg-red-500/10 border-red-500/20',
  Hold: 'text-muted-foreground bg-secondary/40 border-border/40',
  Replace: 'text-violet-400 bg-violet-500/10 border-violet-500/20',
};

const AIRecommendations = ({ holdings }: { holdings: Holding[] }) => {
  const recs = positionRecs(holdings);
  return (
    <div className="luxe-glass rounded-3xl p-6">
      <div className="flex items-center gap-2 mb-1">
        <Sparkles className="w-4 h-4 text-primary" />
        <h3 className="text-base font-semibold">AI Recommendations</h3>
      </div>
      <p className="text-xs text-muted-foreground mb-5">Position-level guidance based on your Vantage Rating and concentration risk.</p>

      <div className="space-y-2">
        {recs.map((r) => {
          const Icon = ICONS[r.action];
          return (
            <Link
              key={r.symbol}
              to={`/stock/${encodeURIComponent(r.symbol)}`}
              className="block rounded-2xl border border-border/40 bg-background/30 p-4 hover:bg-secondary/30 transition-colors group"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-secondary/50 border border-border/40 flex items-center justify-center flex-shrink-0">
                  <span className="text-[11px] font-mono font-semibold">{r.symbol.slice(0, 4)}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm truncate">{r.symbol}</span>
                    {r.name && <span className="text-xs text-muted-foreground truncate">· {r.name}</span>}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1 leading-relaxed line-clamp-2">{r.reason}</div>
                </div>
                <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                  <span className={cn('inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full border', TONES[r.action])}>
                    <Icon className="w-3 h-3" /> {r.action}
                  </span>
                  <span className="font-mono text-[11px] text-muted-foreground">{fmtPct(r.weight)}</span>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
};

export default AIRecommendations;