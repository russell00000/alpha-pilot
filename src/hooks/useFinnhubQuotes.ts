import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface FinnhubQuote {
  symbol: string;
  c: number;
  d: number;
  dp: number;
  h: number | null;
  l: number | null;
  o: number | null;
  pc: number | null;
  /** Direction of the most recent tick vs the previous poll. */
  tick?: "up" | "down" | "flat";
  /** Set when the latest poll failed and we're showing the last known price. */
  delayed?: boolean;
}

export type QuoteMap = Record<string, FinnhubQuote>;

interface Options {
  /** Equity / ETF symbols fetched from the Finnhub quote endpoint. */
  symbols?: string[];
  /** Crypto tickers (AVAX, LINK, DOGE…) fetched from the crypto endpoint. */
  cryptoSymbols?: string[];
  /** Poll cadence in ms. */
  intervalMs?: number;
  enabled?: boolean;
}

const invoke = async (action: string, symbols: string[]): Promise<FinnhubQuote[]> => {
  if (symbols.length === 0) return [];
  const { data, error } = await supabase.functions.invoke("finnhub", { body: { action, symbols } });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return Array.isArray(data?.data) ? (data.data as FinnhubQuote[]) : [];
};

/**
 * Polls the backend Finnhub proxy on an interval. Prices never blank out:
 * a failed poll keeps the last known value and flags it as delayed.
 */
export const useFinnhubQuotes = ({
  symbols = [],
  cryptoSymbols = [],
  intervalMs = 15000,
  enabled = true,
}: Options) => {
  const [quotes, setQuotes] = useState<QuoteMap>({});
  const [isFetching, setIsFetching] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isDelayed, setIsDelayed] = useState(false);
  const quotesRef = useRef<QuoteMap>({});

  const symbolKey = symbols.join(",");
  const cryptoKey = cryptoSymbols.join(",");

  const refresh = useCallback(async () => {
    const equities = symbolKey ? symbolKey.split(",") : [];
    const cryptos = cryptoKey ? cryptoKey.split(",") : [];
    if (equities.length === 0 && cryptos.length === 0) return;

    setIsFetching(true);
    try {
      const [stockQuotes, cryptoQuotes] = await Promise.all([
        invoke("quotes", equities).catch(() => [] as FinnhubQuote[]),
        invoke("crypto", cryptos).catch(() => [] as FinnhubQuote[]),
      ]);
      const incoming = [...stockQuotes, ...cryptoQuotes];

      if (incoming.length === 0) {
        // Keep the last known prices, flag them as delayed.
        setIsDelayed(true);
        setQuotes((prev) => {
          const next: QuoteMap = {};
          Object.entries(prev).forEach(([key, value]) => {
            next[key] = { ...value, delayed: true, tick: "flat" };
          });
          quotesRef.current = next;
          return next;
        });
        return;
      }

      const next: QuoteMap = { ...quotesRef.current };
      incoming.forEach((quote) => {
        const previous = quotesRef.current[quote.symbol];
        const tick: FinnhubQuote["tick"] = !previous || previous.c === quote.c
          ? "flat"
          : quote.c > previous.c
            ? "up"
            : "down";
        next[quote.symbol] = { ...quote, tick, delayed: false };
      });
      quotesRef.current = next;
      setQuotes(next);
      setIsDelayed(false);
      setLastUpdated(new Date());
    } finally {
      setIsFetching(false);
    }
  }, [symbolKey, cryptoKey]);

  useEffect(() => {
    if (!enabled) return;
    refresh();
    const id = setInterval(refresh, intervalMs);
    return () => clearInterval(id);
  }, [enabled, intervalMs, refresh]);

  return { quotes, isFetching, lastUpdated, isDelayed, refresh };
};

export default useFinnhubQuotes;
