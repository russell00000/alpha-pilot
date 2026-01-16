import { TrendingUp, Shield, Users, Sparkles } from "lucide-react";

const stats = [
  { 
    label: "Assets Tracked", 
    value: "10,000+",
    sublabel: "Stocks, ETFs & Crypto",
    icon: TrendingUp,
    gradient: "from-emerald-500/20 to-emerald-500/5",
  },
  { 
    label: "AI Insights Daily", 
    value: "50K+",
    sublabel: "Real-time analysis",
    icon: Sparkles,
    gradient: "from-violet-500/20 to-violet-500/5",
  },
  { 
    label: "Active Investors", 
    value: "25K+",
    sublabel: "Growing community",
    icon: Users,
    gradient: "from-blue-500/20 to-blue-500/5",
  },
  { 
    label: "Bank-Level Security", 
    value: "256-bit",
    sublabel: "SSL encryption",
    icon: Shield,
    gradient: "from-amber-500/20 to-amber-500/5",
  },
];

const MarketSentiment = () => {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat, index) => (
        <div 
          key={stat.label}
          className="relative overflow-hidden rounded-xl border border-border/50 bg-card/80 backdrop-blur-sm p-5 group"
          style={{ animationDelay: `${index * 100}ms` }}
        >
          {/* Gradient background */}
          <div 
            className={`absolute inset-0 bg-gradient-to-br ${stat.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-500`}
          />
          
          {/* Content */}
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 rounded-lg bg-muted/50">
                <stat.icon className="w-4 h-4 text-muted-foreground" />
              </div>
            </div>
            
            <div className="space-y-1">
              <p className="text-2xl md:text-3xl font-semibold text-foreground tracking-tight">
                {stat.value}
              </p>
              <p className="text-sm font-medium text-foreground/80">
                {stat.label}
              </p>
              <p className="text-xs text-muted-foreground">
                {stat.sublabel}
              </p>
            </div>
          </div>
          
          {/* Decorative element */}
          <div className="absolute -bottom-4 -right-4 w-20 h-20 rounded-full bg-gradient-to-br from-primary/5 to-transparent blur-2xl" />
        </div>
      ))}
    </div>
  );
};

export default MarketSentiment;
