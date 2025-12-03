import { ArrowUpRight, ArrowDownRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface MarketCardProps {
  symbol: string;
  name: string;
  price: string;
  change: number;
  changePercent: number;
  volume?: string;
}

const MarketCard = ({ symbol, name, price, change, changePercent, volume }: MarketCardProps) => {
  const isPositive = change >= 0;

  return (
    <div className="glass-card p-4 hover:border-primary/30 transition-all duration-300 group cursor-pointer">
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="font-bold text-foreground group-hover:text-primary transition-colors">
            {symbol}
          </p>
          <p className="text-xs text-muted-foreground truncate max-w-[100px]">{name}</p>
        </div>
        <div className={cn(
          "flex items-center gap-0.5 px-2 py-1 rounded-md text-xs font-medium",
          isPositive ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"
        )}>
          {isPositive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
          {Math.abs(changePercent).toFixed(2)}%
        </div>
      </div>
      
      <div className="space-y-1">
        <p className="text-2xl font-bold text-foreground">${price}</p>
        <p className={cn(
          "text-sm font-medium",
          isPositive ? "text-success" : "text-destructive"
        )}>
          {isPositive ? "+" : ""}{change.toFixed(2)}
        </p>
      </div>

      {volume && (
        <div className="mt-3 pt-3 border-t border-border/50">
          <p className="text-xs text-muted-foreground">
            Vol: <span className="text-foreground font-medium">{volume}</span>
          </p>
        </div>
      )}
    </div>
  );
};

export default MarketCard;
