import { useState, useEffect, useCallback } from "react";
import { Clock, ExternalLink, Newspaper, RefreshCw, AlertCircle } from "lucide-react";
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
      
      if (fetchError) {
        console.error("Error fetching news:", fetchError);
        throw new Error("Failed to fetch news");
      }
      
      if (data?.error) {
        console.error("News API error:", data.error);
        throw new Error(data.error);
      }
      
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
    
    // Refresh news every 5 minutes
    const interval = setInterval(() => {
      fetchNews(false);
    }, 5 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, [fetchNews]);

  const handleNewsClick = (url: string) => {
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="glass-card p-5">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-primary/15 to-primary/5 border border-primary/10">
            <Newspaper className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h2 className="font-semibold text-foreground">Market News</h2>
            <p className="text-xs text-muted-foreground">
              {lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString()}` : "Live updates"}
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => fetchNews()}
          disabled={isLoading}
          className="text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors duration-200"
        >
          <RefreshCw className={cn("w-4 h-4", isLoading && "animate-spin")} />
        </Button>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 mb-4 rounded-lg bg-destructive/10 text-destructive text-sm">
          <AlertCircle className="w-4 h-4" />
          <span>{error}</span>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="p-4 rounded-xl bg-secondary/20 animate-pulse">
              <div className="h-4 bg-muted rounded w-full mb-2" />
              <div className="h-4 bg-muted rounded w-3/4 mb-3" />
              <div className="flex gap-2">
                <div className="h-5 bg-muted rounded w-16" />
                <div className="h-5 bg-muted rounded w-12" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {news.map((item, index) => (
            <div
              key={index}
              onClick={() => handleNewsClick(item.url)}
              className="p-4 rounded-xl bg-secondary/20 hover:bg-secondary/40 border border-transparent hover:border-border/30 transition-all duration-200 cursor-pointer group"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground line-clamp-2 group-hover:text-primary transition-colors duration-200 leading-relaxed">
                    {item.title}
                  </p>
                  <div className="flex items-center gap-2 mt-2.5 flex-wrap">
                    <span className="text-xs px-2.5 py-1 rounded-lg bg-primary/10 text-primary font-medium">
                      {item.category}
                    </span>
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {item.time}
                    </span>
                    <span className="text-xs text-muted-foreground">• {item.source}</span>
                  </div>
                </div>
                <ExternalLink className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-all duration-200 flex-shrink-0 mt-1" />
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-muted-foreground text-center mt-5 pt-4 border-t border-border/30">
        Click any article to read full story
      </p>
    </div>
  );
};

export default TrendingNews;
