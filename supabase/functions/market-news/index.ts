import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface NewsArticle {
  title: string;
  source: string;
  time: string;
  category: string;
  url: string;
  summary?: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Fetching market news...");
    
    const FINNHUB_API_KEY = Deno.env.get('FINNHUB_API_KEY');
    
    if (!FINNHUB_API_KEY) {
      console.error("FINNHUB_API_KEY not configured");
      throw new Error("News API not configured");
    }

    // Fetch general market news from Finnhub
    const newsResponse = await fetch(
      `https://finnhub.io/api/v1/news?category=general&token=${FINNHUB_API_KEY}`
    );
    
    if (!newsResponse.ok) {
      console.error("Finnhub API error:", newsResponse.status);
      throw new Error("Failed to fetch news");
    }
    
    const newsData = await newsResponse.json();
    console.log(`Received ${newsData.length} news articles`);
    
    // Transform and filter the news data
    const articles: NewsArticle[] = newsData
      .slice(0, 10) // Get top 10 articles
      .map((article: any) => {
        // Calculate time ago
        const publishedTime = new Date(article.datetime * 1000);
        const now = new Date();
        const diffMs = now.getTime() - publishedTime.getTime();
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const diffMinutes = Math.floor(diffMs / (1000 * 60));
        
        let timeAgo;
        if (diffHours < 1) {
          timeAgo = `${diffMinutes}m ago`;
        } else if (diffHours < 24) {
          timeAgo = `${diffHours}h ago`;
        } else {
          const diffDays = Math.floor(diffHours / 24);
          timeAgo = `${diffDays}d ago`;
        }
        
        // Determine category based on keywords
        let category = "Markets";
        const headline = (article.headline || "").toLowerCase();
        const summary = (article.summary || "").toLowerCase();
        const content = headline + " " + summary;
        
        if (content.includes("crypto") || content.includes("bitcoin") || content.includes("ethereum")) {
          category = "Crypto";
        } else if (content.includes("tech") || content.includes("apple") || content.includes("google") || content.includes("nvidia") || content.includes("microsoft") || content.includes("ai") || content.includes("semiconductor")) {
          category = "Tech";
        } else if (content.includes("fed") || content.includes("rate") || content.includes("inflation") || content.includes("economy") || content.includes("gdp")) {
          category = "Economy";
        } else if (content.includes("oil") || content.includes("gold") || content.includes("commodity")) {
          category = "Commodities";
        } else if (content.includes("earn") || content.includes("revenue") || content.includes("profit") || content.includes("quarter")) {
          category = "Earnings";
        }
        
        return {
          title: article.headline,
          source: article.source,
          time: timeAgo,
          category,
          url: article.url,
          summary: article.summary?.substring(0, 150) + "...",
        };
      })
      .filter((article: NewsArticle) => article.title && article.url);

    console.log(`Returning ${articles.length} processed articles`);

    return new Response(
      JSON.stringify({ data: articles }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error("Error fetching market news:", error);
    
    const errorMessage = error instanceof Error ? error.message : "Failed to fetch news";
    
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        data: [] 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 // Return 200 with error in body to handle gracefully on frontend
      }
    );
  }
});
