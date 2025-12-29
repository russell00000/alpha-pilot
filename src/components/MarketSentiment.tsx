import { Target, Lightbulb, BarChart3, BookOpen } from "lucide-react";

const categories = [
  { 
    label: "Strategy", 
    items: ["Value Investing Core", "AI-Optimization", "Risk-Management"],
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
          className="glass-card p-4 card-hover group"
        >
          <div className="flex items-center gap-2.5 mb-3">
            <div className="p-2 rounded-lg bg-primary/8 group-hover:bg-primary/12 transition-colors duration-200">
              <category.icon className="w-4 h-4 text-primary" />
            </div>
            <span className="text-sm font-medium text-foreground">{category.label}</span>
          </div>
          <ul className="space-y-1.5">
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