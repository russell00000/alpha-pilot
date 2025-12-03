import { Clock, ExternalLink, Newspaper } from "lucide-react";
import { cn } from "@/lib/utils";

const newsItems = [
  {
    title: "Fed signals potential rate cuts in 2024",
    source: "Reuters",
    time: "2h ago",
    category: "Economy",
    sentiment: "positive",
  },
  {
    title: "NVIDIA surpasses expectations with AI chip demand",
    source: "Bloomberg",
    time: "3h ago",
    category: "Tech",
    sentiment: "positive",
  },
  {
    title: "Bitcoin ETF approval drives institutional interest",
    source: "CoinDesk",
    time: "4h ago",
    category: "Crypto",
    sentiment: "positive",
  },
  {
    title: "Apple announces record-breaking services revenue",
    source: "CNBC",
    time: "5h ago",
    category: "Tech",
    sentiment: "positive",
  },
  {
    title: "Oil prices stabilize amid Middle East tensions",
    source: "WSJ",
    time: "6h ago",
    category: "Commodities",
    sentiment: "neutral",
  },
];

const TrendingNews = () => {
  return (
    <div className="glass-card p-4">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 rounded-lg bg-primary/10">
          <Newspaper className="w-4 h-4 text-primary" />
        </div>
        <div>
          <h2 className="font-semibold text-foreground">Market News</h2>
          <p className="text-xs text-muted-foreground">Latest updates</p>
        </div>
      </div>

      <div className="space-y-3">
        {newsItems.map((item, index) => (
          <div
            key={index}
            className={cn(
              "p-3 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-all cursor-pointer group animate-fade-in"
            )}
            style={{ animationDelay: `${index * 100}ms` }}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground line-clamp-2 group-hover:text-primary transition-colors">
                  {item.title}
                </p>
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                    {item.category}
                  </span>
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {item.time}
                  </span>
                  <span className="text-xs text-muted-foreground">• {item.source}</span>
                </div>
              </div>
              <ExternalLink className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default TrendingNews;
