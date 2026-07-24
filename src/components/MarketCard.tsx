import { ArrowUpRight, ArrowDownRight } from "lucide-react";
import { cn } from "@/lib/utils";
import SparklineChart from "./SparklineChart";

interface MarketCardProps {
  symbol: string;
  name: string;
  price: string;
  change: number;
  changePercent: number;
  sparkline?: number[];
}

const MarketCard = ({ symbol, name, price, change, changePercent, sparkline }: MarketCardProps) => {
  const isPositive = change >= 0;

  return (
    <div className="luxe-sheen group relative cursor-pointer p-5 rounded-2xl luxe-glass hover:-translate-y-1 hover:shadow-[0_24px_60px_-12px_rgba(0,0,0,0.7)] active:scale-[0.98] transition-all duration-500 ease-out">
      <div className="absolute -inset-px rounded-2xl bg-[radial-gradient(circle_at_var(--mx,50%)_var(--my,0%),hsl(0_0%_100%/0.08),transparent_55%)] opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

      <div className="relative flex items-start justify-between">
        <div className="min-w-0">
          <p className="font-bold text-foreground text-base tracking-tight">{symbol}</p>
          <p className="text-[11px] text-muted-foreground truncate mt-0.5">{name}</p>
        </div>
        <div className={cn(
          "flex items-center gap-0.5 text-xs font-semibold font-mono tabular-nums",
          isPositive ? "text-success" : "text-destructive"
        )}>
          {isPositive ? <ArrowUpRight className="w-3 h-3" strokeWidth={2.5} /> : <ArrowDownRight className="w-3 h-3" strokeWidth={2.5} />}
          {Math.abs(changePercent).toFixed(2)}%
        </div>
      </div>

      <div className="relative mt-5">
        <p className="text-2xl font-bold font-mono text-foreground tabular-nums tracking-tight">${price}</p>
        <p className={cn(
          "text-[11px] font-medium font-mono mt-1 tabular-nums",
          isPositive ? "text-success" : "text-destructive"
        )}>
          {isPositive ? "+" : ""}{change.toFixed(2)} Today
        </p>
      </div>

      {sparkline && sparkline.length > 0 && (
        <div className="relative mt-3 h-10 opacity-40 group-hover:opacity-80 transition-opacity">
          <SparklineChart data={sparkline} positive={isPositive} />
        </div>
      )}
    </div>
  );
};

export default MarketCard;
