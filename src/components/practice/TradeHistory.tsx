import type { PracticeTrade } from "@/hooks/usePracticeTrading";

interface TradeHistoryProps {
  trades: PracticeTrade[];
}

export default function TradeHistory({ trades }: TradeHistoryProps) {
  if (trades.length === 0) {
    return (
      <div className="rounded-xl border border-border/60 bg-card p-8 text-center">
        <p className="text-muted-foreground text-sm">No trades yet.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/40 bg-muted/20">
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Date</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Type</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Security</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground">Shares</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground">Price</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground">Total</th>
            </tr>
          </thead>
          <tbody>
            {trades.map((t) => (
              <tr key={t.id} className="border-b border-border/20 hover:bg-muted/10">
                <td className="px-4 py-3 text-muted-foreground">
                  {new Date(t.created_at).toLocaleDateString()}
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded ${
                    t.trade_type === "buy"
                      ? "bg-green-500/10 text-green-500"
                      : "bg-red-500/10 text-red-500"
                  }`}>
                    {t.trade_type.toUpperCase()}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className="font-medium text-foreground">{t.symbol}</span>
                  <span className="text-xs text-muted-foreground ml-2">{t.name}</span>
                </td>
                <td className="text-right px-4 py-3 text-foreground">{t.quantity}</td>
                <td className="text-right px-4 py-3 text-foreground">${t.price_per_share.toFixed(2)}</td>
                <td className="text-right px-4 py-3 font-medium text-foreground">${t.total_amount.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
