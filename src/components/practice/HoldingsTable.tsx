import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import type { PracticeHolding } from "@/hooks/usePracticeTrading";
import SparklineChart from "@/components/SparklineChart";

interface LiveQuote {
  price: number;
  changePercent: number;
  sparkline: number[];
}

interface HoldingsTableProps {
  holdings: PracticeHolding[];
  onSell: (symbol: string, name: string, maxShares: number) => void;
  liveQuotes?: Record<string, LiveQuote>;
}

export default function HoldingsTable({ holdings, onSell, liveQuotes = {} }: HoldingsTableProps) {
  const navigate = useNavigate();

  if (holdings.length === 0) {
    return (
      <div className="rounded-xl border border-border/60 bg-card p-8 text-center">
        <p className="text-muted-foreground text-sm">No holdings yet. Search for a security above to make your first trade!</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/40 bg-muted/20">
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Security</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground">Shares</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground">Avg Cost</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground">Price</th>
              <th className="text-center px-4 py-3 font-medium text-muted-foreground w-32">Today</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground">Value</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground">Gain/Loss</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground"></th>
            </tr>
          </thead>
          <tbody>
            {holdings.map((h) => {
              const quote = liveQuotes[h.symbol];
              const currentPrice = quote?.price || 0;
              const sparkline = quote?.sparkline ?? [];
              const changePct = quote?.changePercent ?? 0;
              const totalValue = h.quantity * currentPrice;
              const totalCost = h.quantity * h.avg_cost_basis;
              const gainLoss = totalValue - totalCost;
              const gainPct = totalCost > 0 ? (gainLoss / totalCost) * 100 : 0;

              return (
                <tr key={h.symbol} className="border-b border-border/20 hover:bg-muted/10 cursor-pointer" onClick={() => navigate(`/stock/${h.symbol}`)}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <img
                        src={`https://assets.parqet.com/logos/symbol/${h.symbol}`}
                        alt=""
                        className="w-7 h-7 rounded-full bg-muted/50"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                      />
                      <div>
                        <p className="font-medium text-foreground">{h.symbol}</p>
                        <p className="text-xs text-muted-foreground">{h.name}</p>
                      </div>
                    </div>
                  </td>
                  <td className="text-right px-4 py-3 text-foreground">{Number.isInteger(h.quantity) ? h.quantity : h.quantity.toFixed(4)}</td>
                  <td className="text-right px-4 py-3 text-foreground">${h.avg_cost_basis.toFixed(2)}</td>
                  <td className="text-right px-4 py-3 text-foreground">
                    {currentPrice ? `$${currentPrice.toFixed(2)}` : "—"}
                  </td>
                  <td className="px-4 py-3">
                    {sparkline.length > 1 ? (
                      <div className="h-10 w-24">
                        <SparklineChart data={sparkline} positive={changePct >= 0} />
                      </div>
                    ) : (
                      <div className="text-center text-xs text-muted-foreground">—</div>
                    )}
                  </td>
                  <td className="text-right px-4 py-3 text-foreground font-medium">
                    {currentPrice ? `$${totalValue.toFixed(2)}` : "—"}
                  </td>
                  <td className="text-right px-4 py-3">
                    {currentPrice ? (
                      <div>
                        <span className={gainLoss >= 0 ? "text-green-500" : "text-red-500"}>
                          {gainLoss >= 0 ? "+" : ""}${gainLoss.toFixed(2)}
                        </span>
                        <span className={`text-xs ml-1 ${gainPct >= 0 ? "text-green-500/70" : "text-red-500/70"}`}>
                          ({gainPct >= 0 ? "+" : ""}{gainPct.toFixed(1)}%)
                        </span>
                      </div>
                    ) : "—"}
                  </td>
                  <td className="text-right px-4 py-3">
                    <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); onSell(h.symbol, h.name, h.quantity); }}>
                      Sell
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
