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
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat, index) => (
        <div 
          key={stat.label}
          className="glass-card p-4 animate-fade-in"
          style={{ animationDelay: `${index * 100}ms` }}
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <stat.icon className="w-4 h-4 text-primary" />
            </div>
            <span className="text-sm text-muted-foreground">{stat.label}</span>
          </div>
          <p className="text-2xl font-bold text-foreground mb-1">{stat.value}</p>
          <p className={cn(
            "text-sm font-medium",
            stat.positive ? "text-success" : "text-destructive"
          )}>
            {stat.change} this month
          </p>
        </div>
      ))}
    </div>
  );
};

export default PortfolioSummary;
