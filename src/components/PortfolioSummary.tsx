import { Wallet, TrendingUp, PieChart, Activity } from "lucide-react";
import { cn } from "@/lib/utils";

const stats = [
  { 
    label: "Total Value", 
    value: "$124,892.45", 
    change: "+12.4%", 
    positive: true,
    icon: Wallet 
  },
  { 
    label: "Today's P/L", 
    value: "+$2,341.12", 
    change: "+1.9%", 
    positive: true,
    icon: TrendingUp 
  },
  { 
    label: "Total Return", 
    value: "+$24,892.45", 
    change: "+24.9%", 
    positive: true,
    icon: PieChart 
  },
  { 
    label: "Win Rate", 
    value: "68%", 
    change: "+5%", 
    positive: true,
    icon: Activity 
  },
];

const PortfolioSummary = () => {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 animate-stagger">
      {stats.map((stat) => (
        <div 
          key={stat.label}
          className="glass-card p-5 card-hover group"
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-primary/15 to-primary/5 border border-primary/10 group-hover:border-primary/30 transition-colors duration-300">
              <stat.icon className="w-4 h-4 text-primary" />
            </div>
            <span className="text-sm text-muted-foreground font-medium">{stat.label}</span>
          </div>
          <p className="text-2xl md:text-3xl font-bold text-foreground mb-2 tracking-tight">{stat.value}</p>
          <div className="flex items-center gap-2">
            <span className={cn(
              "text-sm font-semibold px-2 py-0.5 rounded-md",
              stat.positive 
                ? "text-success bg-success/10" 
                : "text-destructive bg-destructive/10"
            )}>
              {stat.change}
            </span>
            <span className="text-xs text-muted-foreground">this month</span>
          </div>
        </div>
      ))}
    </div>
  );
};

export default PortfolioSummary;