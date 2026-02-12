import { ArrowUpRight, ArrowDownRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface MarketCardProps {
  symbol: string;
  name: string;
  price: string;
  change: number;
  changePercent: number;
}

const MarketCard = ({ symbol, name, price, change, changePercent }: MarketCardProps) => {
  const isPositive = change >= 0;

  return (
    <div className="group cursor-pointer p-4 rounded-xl bg-secondary/20 border border-border/20 hover:bg-secondary/40 hover:border-border/40 transition-all duration-200">
      <div className="flex items-center justify-between mb-3">
        <div className="min-w-0">
          <p className="font-semibold text-foreground text-sm">{symbol}</p>
          <p className="text-xs text-muted-foreground truncate">{name}</p>
        </div>
        <div className={cn(
          "flex items-center gap-0.5 px-2 py-0.5 rounded-md text-xs font-medium",
          isPositive ? "text-success" : "text-destructive"
        )}>
          {isPositive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
          {Math.abs(changePercent).toFixed(2)}%
        </div>
      </div>
      
      <p className="text-xl font-semibold text-foreground tabular-nums">${price}</p>
      <p className={cn(
        "text-xs font-medium mt-0.5 tabular-nums",
        isPositive ? "text-success" : "text-destructive"
      )}>
        {isPositive ? "+" : ""}{change.toFixed(2)}
      </p>
    </div>
  );
};

export default MarketCard;
