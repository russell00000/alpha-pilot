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
    <div className="group relative cursor-pointer p-5 rounded-2xl bg-white/[0.02] border border-white/[0.06] backdrop-blur-xl hover:bg-white/[0.05] hover:border-white/[0.15] hover:-translate-y-1 hover:shadow-[0_16px_48px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.06)] active:scale-[0.98] transition-all duration-300 ease-out overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-white/[0.03] to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />

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
