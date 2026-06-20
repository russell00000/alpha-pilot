import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";
import { top100Stocks, topETFs } from "@/data/top-stocks";
import { useSymbolSearch } from "@/hooks/useSymbolSearch";

interface SecuritySearchProps {
  onBuy: (symbol: string, name: string) => void;
}

const cryptoAssets = [
  { symbol: "BTC", name: "Bitcoin", type: "Crypto" },
  { symbol: "ETH", name: "Ethereum", type: "Crypto" },
  { symbol: "SOL", name: "Solana", type: "Crypto" },
  { symbol: "XRP", name: "XRP", type: "Crypto" },
  { symbol: "ADA", name: "Cardano", type: "Crypto" },
  { symbol: "DOGE", name: "Dogecoin", type: "Crypto" },
  { symbol: "DOT", name: "Polkadot", type: "Crypto" },
  { symbol: "AVAX", name: "Avalanche", type: "Crypto" },
  { symbol: "LINK", name: "Chainlink", type: "Crypto" },
];

const allSecurities = [
  ...cryptoAssets,
  ...top100Stocks.map(s => ({ symbol: s.symbol, name: s.name, type: "Stock" })),
  ...topETFs.map(e => ({ symbol: e.symbol, name: e.name, type: "ETF" })),
];

export default function SecuritySearch({ onBuy }: SecuritySearchProps) {
  const [query, setQuery] = useState("");

  const results = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return allSecurities
      .filter(s => s.symbol.toLowerCase().includes(q) || s.name.toLowerCase().includes(q))
      .slice(0, 5);
  }, [query]);

  // Market-wide fallback so any listed security is searchable.
  const { results: remote } = useSymbolSearch(query, 1, 250);
  const mapType = (t: string) => {
    if (t === "etf") return "ETF";
    if (t === "mutual_fund") return "Mutual Fund";
    if (t === "crypto") return "Crypto";
    if (t === "index") return "Index";
    return "Stock";
  };
  const merged = (() => {
    const seen = new Set(results.map(r => r.symbol.toUpperCase()));
    const extra = remote
      .filter(r => r.symbol && !seen.has(r.symbol.toUpperCase()))
      .map(r => ({ symbol: r.symbol, name: r.name, type: mapType(r.type) }));
    return [...results, ...extra].slice(0, 12);
  })();

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search stocks & ETFs (e.g. AAPL, Vanguard)..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {merged.length > 0 && (
        <div className="rounded-lg border border-border/60 bg-card divide-y divide-border/40 max-h-80 overflow-y-auto">
          {merged.map((s) => (
            <div key={s.symbol} className="flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors cursor-pointer" onClick={() => onBuy(s.symbol, s.name)}>
              <div className="flex items-center gap-3">
                <img
                  src={`https://assets.parqet.com/logos/symbol/${s.symbol}`}
                  alt=""
                  className="w-8 h-8 rounded-full bg-muted/50"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                />
                <div>
                  <p className="font-medium text-foreground text-sm">{s.symbol}</p>
                  <p className="text-xs text-muted-foreground">{s.name}</p>
                </div>
              </div>
              <span className="text-xs text-muted-foreground bg-muted/40 px-2 py-0.5 rounded">{s.type}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
