import { useState, useEffect, useCallback } from "react";
import { Clock, ExternalLink, RefreshCw, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

interface NewsItem {
  title: string;
  source: string;
  time: string;
  category: string;
  url: string;
  summary?: string;
}

const fallbackNews: NewsItem[] = [
  {
    title: "Markets update: Check back for the latest financial news",
    source: "InvestAI",
    time: "Just now",
    category: "Markets",
    url: "https://www.reuters.com/markets/",
  },
];

const TrendingNews = () => {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchNews = useCallback(async (showLoading = true) => {
    if (showLoading) setIsLoading(true);
    setError(null);
    
    try {
      const { data, error: fetchError } = await supabase.functions.invoke("market-news");
      if (fetchError) throw new Error("Failed to fetch news");
      if (data?.error) throw new Error(data.error);
      
      if (data?.data && Array.isArray(data.data) && data.data.length > 0) {
        setNews(data.data);
        setLastUpdated(new Date());
      } else {
        setNews(fallbackNews);
      }
    } catch (err) {
      console.error("Failed to fetch news:", err);
      setError("Unable to load news");
      setNews(fallbackNews);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNews();
    const interval = setInterval(() => fetchNews(false), 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchNews]);

  const handleNewsClick = (url: string) => {
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-lg font-semibold text-foreground">News</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString()}` : "Live updates"}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => fetchNews()}
          disabled={isLoading}
          className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-secondary/40"
        >
          <RefreshCw className={cn("w-3.5 h-3.5", isLoading && "animate-spin")} />
        </Button>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 mb-4 rounded-xl bg-destructive/5 text-destructive text-xs">
          <AlertCircle className="w-3.5 h-3.5" />
          <span>{error}</span>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-2 flex-1">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="p-3.5 rounded-xl bg-secondary/20 animate-pulse">
              <div className="h-4 bg-muted rounded w-full mb-2" />
              <div className="h-3 bg-muted rounded w-2/3" />
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-2 flex-1 overflow-y-auto scrollbar-hide">
          {news.slice(0, Math.max(news.length - 3, 1)).map((item, index) => (
            <div
              key={index}
              onClick={() => handleNewsClick(item.url)}
              className="p-3.5 rounded-xl bg-secondary/20 hover:bg-secondary/40 border border-transparent hover:border-border/20 transition-all duration-200 cursor-pointer group"
            >
              <p className="text-sm font-medium text-foreground line-clamp-2 group-hover:text-primary transition-colors duration-200 leading-relaxed">
                {item.title}
              </p>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-md bg-primary/8 text-primary font-medium">
                  {item.category}
                </span>
                <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {item.time}
                </span>
                <span className="text-[11px] text-muted-foreground">· {item.source}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default TrendingNews;
