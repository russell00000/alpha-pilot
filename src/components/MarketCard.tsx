import { ArrowUpRight, ArrowDownRight } from "lucide-react";
import { cn } from "@/lib/utils";
import SparklineChart from "./SparklineChart";
import { motion } from "framer-motion";
import AnimatedNumber from "./AnimatedNumber";

interface MarketCardProps {
  symbol: string;
  name: string;
  price: string;
  change: number;
  changePercent: number;
  sparkline?: number[];
  /** Zero-based index for cascade stagger. */
  index?: number;
}

const MarketCard = ({ symbol, name, price, change, changePercent, sparkline, index = 0 }: MarketCardProps) => {
  const isPositive = change >= 0;
  const priceNum = Number(String(price).replace(/,/g, ""));

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ type: "spring", stiffness: 80, damping: 18, delay: Math.min(index * 0.06, 0.36) }}
      style={{ ["--stagger" as any]: index, willChange: "transform, opacity" }}
      className="luxe-sheen tap-scale group relative cursor-pointer p-5 rounded-2xl luxe-glass hover:-translate-y-1 hover:shadow-[0_24px_60px_-12px_rgba(0,0,0,0.7)] transition-all duration-300 ease-out"
    >
      <div className="absolute -inset-px rounded-2xl bg-[radial-gradient(circle_at_var(--mx,50%)_var(--my,0%),hsl(0_0%_100%/0.08),transparent_55%)] opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

      <div className="relative flex items-start justify-between">
        <div className="min-w-0 animate-card-in" style={{ ["--stagger" as any]: 0 }}>
          <p className="font-mono font-medium text-foreground text-[1.1rem] tracking-tight">{symbol}</p>
          <p className="text-[11px] text-muted-foreground truncate mt-0.5">{name}</p>
        </div>
        <div className={cn(
          "flex items-center gap-0.5 text-xs font-semibold font-mono tabular-nums px-1.5 py-0.5 rounded-md animate-badge-in",
          isPositive ? "text-success bg-success/10" : "text-destructive bg-destructive/10"
        )}>
          {isPositive ? <ArrowUpRight className="w-3 h-3" strokeWidth={2.5} /> : <ArrowDownRight className="w-3 h-3" strokeWidth={2.5} />}
          {Math.abs(changePercent).toFixed(2)}%
        </div>
      </div>

      <div className="relative mt-5">
        <p className="font-display text-[2rem] font-medium leading-none text-foreground tabular-nums tracking-tight">
          {Number.isFinite(priceNum) ? (
            <AnimatedNumber value={priceNum} prefix="$" decimals={2} />
          ) : (
            <>${price}</>
          )}
        </p>
        <p className={cn(
          "text-[11px] font-medium font-mono mt-1 tabular-nums",
          isPositive ? "text-success" : "text-destructive"
        )}>
          {isPositive ? "+" : ""}{change.toFixed(2)} Today
        </p>
      </div>

      {sparkline && sparkline.length > 0 && (
        <div className="relative mt-3 h-10 opacity-40 group-hover:opacity-80 transition-opacity">
          <SparklineChart data={sparkline} positive={isPositive} animate />
        </div>
      )}
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute -inset-6 -z-10 rounded-[28px] opacity-40 blur-2xl",
          isPositive ? "bg-gold/[0.07]" : "bg-destructive/[0.06]"
        )}
      />
    </motion.div>
  );
};

export default MarketCard;
