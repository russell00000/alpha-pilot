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
    <div className="glass-card p-4 card-hover group cursor-pointer">
      <div className="flex items-start justify-between mb-2.5">
        <div>
          <p className="font-semibold text-foreground text-sm">
            {symbol}
          </p>
          <p className="text-xs text-muted-foreground truncate max-w-[100px]">{name}</p>
        </div>
        <div className={cn(
          "flex items-center gap-0.5 px-2 py-0.5 rounded-md text-xs font-medium",
          isPositive 
            ? "bg-success/10 text-success" 
            : "bg-destructive/10 text-destructive"
        )}>
          {isPositive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
          {Math.abs(changePercent).toFixed(2)}%
        </div>
      </div>
      
      <div className="space-y-0.5">
        <p className="text-xl font-semibold text-foreground">${price}</p>
        <p className={cn(
          "text-xs font-medium",
          isPositive ? "text-success" : "text-destructive"
        )}>
          {isPositive ? "+" : ""}{change.toFixed(2)}
        </p>
      </div>
    </div>
  );
};

export default MarketCard;