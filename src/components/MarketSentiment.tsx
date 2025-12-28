import { Target, Lightbulb, BarChart3, BookOpen } from "lucide-react";

const categories = [
  { 
    label: "Strategy", 
    items: ["Value Investing Core", "AI-Optimization", "Risk-Management Protocols"],
    icon: Target,
  },
  { 
    label: "Solutions", 
    items: ["Beginner Foundations", "Intermediate Growth", "Retirement Planning"],
    icon: Lightbulb,
  },
  { 
    label: "Analysis", 
    items: ["Weekly Market Signals", "Sector Research", "Fed Policy Updates"],
    icon: BarChart3,
  },
  { 
    label: "Resources", 
    items: ["Investing 101", "Platform FAQ", "Security Standards"],
    icon: BookOpen,
  },
];

const MarketSentiment = () => {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 animate-stagger">
      {categories.map((category) => (
        <div 
          key={category.label}
          className="glass-card p-5 card-hover group"
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-primary/15 to-primary/5 border border-primary/10 group-hover:border-primary/30 transition-colors duration-300">
              <category.icon className="w-4 h-4 text-primary" />
            </div>
            <span className="text-base font-semibold text-foreground">{category.label}</span>
          </div>
          <ul className="space-y-2">
            {category.items.map((item) => (
              <li 
                key={item}
                className="text-sm text-muted-foreground hover:text-foreground cursor-pointer transition-colors duration-200"
              >
                {item}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
};

export default MarketSentiment;