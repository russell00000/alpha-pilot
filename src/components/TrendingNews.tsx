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
  image?: string;
  domain?: string;
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
        // Defensive client-side dedupe by url + normalized title, cap per source.
        const seenUrl = new Set<string>();
        const seenTitle = new Set<string>();
        const perSource = new Map<string, number>();
        const cleaned: NewsItem[] = [];
        for (const item of data.data as NewsItem[]) {
          const u = (item.url ?? "").split("?")[0];
          const t = (item.title ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
          if (!u || !t || seenUrl.has(u) || seenTitle.has(t)) continue;
          const src = item.source ?? "Unknown";
          if ((perSource.get(src) ?? 0) >= 2) continue;
          perSource.set(src, (perSource.get(src) ?? 0) + 1);
          seenUrl.add(u);
          seenTitle.add(t);
          cleaned.push(item);
        }
        setNews(cleaned);
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
          <h2 className="text-2xl font-semibold text-foreground tracking-tight">Latest Intelligence</h2>
          <p className="text-[10px] text-muted-foreground uppercase tracking-[0.2em] font-medium mt-1.5">
            {lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString()}` : "Global market impact reports"}
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
        <div className="space-y-3 flex-1 overflow-y-auto scrollbar-hide animate-stagger">
          {news.map((item, index) => {
            const domain =
              item.domain ||
              (() => { try { return new URL(item.url).hostname.replace(/^www\./, ""); } catch { return ""; } })();
            const logo = domain ? `https://www.google.com/s2/favicons?domain=${domain}&sz=64` : "";
            return (
            <div
              key={`${item.url}-${index}`}
              onClick={() => handleNewsClick(item.url)}
              className="flex gap-4 p-5 rounded-2xl bg-foreground/[0.02] border border-foreground/[0.06] hover:bg-foreground/[0.04] hover:border-foreground/[0.15] hover:-translate-y-0.5 hover:shadow-[0_12px_32px_hsl(0_0%_0%_/_0.12),inset_0_1px_0_hsl(0_0%_100%_/_0.6)] active:scale-[0.99] transition-all duration-300 ease-out cursor-pointer group"
            >
              <div className="hidden md:flex w-16 h-16 shrink-0 items-center justify-center rounded-xl bg-foreground/[0.04] border border-foreground/[0.06] group-hover:bg-foreground/[0.08] transition-colors overflow-hidden">
                {logo ? (
                  <img
                    src={logo}
                    alt={`${item.source} logo`}
                    loading="lazy"
                    referrerPolicy="no-referrer"
                    className="w-8 h-8 object-contain"
                    onError={(e) => {
                      const t = e.currentTarget;
                      t.style.display = "none";
                      const sib = t.nextElementSibling as HTMLElement | null;
                      if (sib) sib.style.display = "block";
                    }}
                  />
                ) : null}
                <ExternalLink
                  className="w-5 h-5 text-muted-foreground/60 group-hover:text-foreground/80 transition-colors"
                  strokeWidth={1.5}
                  style={{ display: logo ? "none" : "block" }}
                />
              </div>
              <div className="flex-1 min-w-0 space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] uppercase tracking-[0.15em] px-2 py-0.5 rounded-full bg-foreground/[0.08] text-foreground font-bold">
                    {item.category}
                  </span>
                  <span className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider flex items-center gap-1">
                    <Clock className="w-2.5 h-2.5" />
                    {item.time}
                  </span>
                  <span className="text-[10px] text-muted-foreground/70">· {item.source}</span>
                </div>
                <p className="text-base font-semibold text-foreground line-clamp-2 group-hover:text-foreground/90 transition-colors leading-snug">
                  {item.title}
                </p>
                {item.summary && (
                  <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">{item.summary}</p>
                )}
              </div>
            </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default TrendingNews;
