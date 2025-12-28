import { TrendingUp, TrendingDown, Activity, Gauge, BarChart3, Scale } from "lucide-react";
import { cn } from "@/lib/utils";

const sentimentData = [
  { 
    label: "Fear & Greed", 
    value: "67", 
    status: "Greed",
    description: "Market sentiment is bullish",
    icon: Gauge,
    color: "text-success"
  },
  { 
    label: "VIX Volatility", 
    value: "14.2", 
    status: "Low",
    description: "Markets are calm",
    icon: Activity,
    color: "text-success"
  },
  { 
    label: "Market Breadth", 
    value: "62%", 
    status: "Positive",
    description: "Stocks above 50-day MA",
    icon: BarChart3,
    color: "text-success"
  },
  { 
    label: "Put/Call Ratio", 
    value: "0.82", 
    status: "Bullish",
    description: "More calls than puts",
    icon: Scale,
    color: "text-success"
  },
];

const MarketSentiment = () => {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 animate-stagger">
      {sentimentData.map((item) => (
        <div 
          key={item.label}
          className="glass-card p-5 card-hover group"
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-primary/15 to-primary/5 border border-primary/10 group-hover:border-primary/30 transition-colors duration-300">
              <item.icon className="w-4 h-4 text-primary" />
            </div>
            <span className="text-sm text-muted-foreground font-medium">{item.label}</span>
          </div>
          <p className="text-2xl md:text-3xl font-bold text-foreground mb-2 tracking-tight">{item.value}</p>
          <div className="flex items-center gap-2">
            <span className={cn(
              "text-sm font-semibold px-2 py-0.5 rounded-md",
              item.color,
              item.color === "text-success" ? "bg-success/10" : "bg-destructive/10"
            )}>
              {item.status}
            </span>
            <span className="text-xs text-muted-foreground">{item.description}</span>
          </div>
        </div>
      ))}
    </div>
  );
};

export default MarketSentiment;
