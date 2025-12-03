import { useState, useEffect } from "react";
import { Clock, ExternalLink, Newspaper, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface NewsItem {
  title: string;
  source: string;
  time: string;
  category: string;
  url: string;
}

// Curated financial news - in production, this would come from a news API
const curatedNews: NewsItem[] = [
  {
    title: "Fed signals potential rate cuts in 2024 amid cooling inflation",
    source: "Reuters",
    time: "2h ago",
    category: "Economy",
    url: "https://www.reuters.com/markets/",
  },
  {
    title: "NVIDIA surpasses expectations with AI chip demand surge",
    source: "Bloomberg",
    time: "3h ago",
    category: "Tech",
    url: "https://www.bloomberg.com/technology",
  },
  {
    title: "Bitcoin breaks $90K as institutional adoption accelerates",
    source: "CoinDesk",
    time: "4h ago",
    category: "Crypto",
    url: "https://www.coindesk.com/",
  },
  {
    title: "Apple announces record-breaking services revenue growth",
    source: "CNBC",
    time: "5h ago",
    category: "Tech",
    url: "https://www.cnbc.com/technology/",
  },
  {
    title: "Oil prices stabilize as OPEC+ considers production cuts",
    source: "WSJ",
    time: "6h ago",
    category: "Commodities",
    url: "https://www.wsj.com/news/markets/oil-gas-energy",
  },
];

const TrendingNews = () => {
  const [news, setNews] = useState<NewsItem[]>(curatedNews);
  const [isLoading, setIsLoading] = useState(false);

  const refreshNews = () => {
    setIsLoading(true);
    // Simulate refresh - in production, fetch from news API
    setTimeout(() => {
      setNews([...curatedNews].sort(() => Math.random() - 0.5));
      setIsLoading(false);
    }, 500);
  };

  const handleNewsClick = (url: string) => {
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="glass-card p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Newspaper className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h2 className="font-semibold text-foreground">Market News</h2>
            <p className="text-xs text-muted-foreground">Latest updates</p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={refreshNews}
          disabled={isLoading}
          className="text-muted-foreground"
        >
          <RefreshCw className={cn("w-4 h-4", isLoading && "animate-spin")} />
        </Button>
      </div>

      <div className="space-y-3">
        {news.map((item, index) => (
          <div
            key={index}
            onClick={() => handleNewsClick(item.url)}
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

      <p className="text-xs text-muted-foreground text-center mt-4">
        Click any article to read more on the source website
      </p>
    </div>
  );
};

export default TrendingNews;
