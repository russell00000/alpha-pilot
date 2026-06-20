import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface SymbolSearchResult {
  symbol: string;
  name: string;
  type: "stock" | "etf" | "mutual_fund" | "crypto" | "index" | "future" | "currency";
  exchange?: string | null;
}

// Hits Yahoo Finance's symbol search via the market-data edge function.
// Lets us reach effectively every listed security, not just the static list.
export function useSymbolSearch(query: string, minLength = 1, debounceMs = 200) {
  const [results, setResults] = useState<SymbolSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const reqIdRef = useRef(0);

  useEffect(() => {
    const q = query.trim();
    if (q.length < minLength) {
      setResults([]);
      setLoading(false);
      return;
    }

    const myReq = ++reqIdRef.current;
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const { data, error } = await supabase.functions.invoke("market-data", {
          body: { symbolSearch: q },
        });
        if (myReq !== reqIdRef.current) return; // stale
        if (error) {
          setResults([]);
        } else {
          const arr = Array.isArray((data as any)?.data) ? (data as any).data : [];
          setResults(arr as SymbolSearchResult[]);
        }
      } catch {
        if (myReq === reqIdRef.current) setResults([]);
      } finally {
        if (myReq === reqIdRef.current) setLoading(false);
      }
    }, debounceMs);

    return () => clearTimeout(t);
  }, [query, minLength, debounceMs]);

  return { results, loading };
}