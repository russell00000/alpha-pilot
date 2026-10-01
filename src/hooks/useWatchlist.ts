import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "vantage:watchlist";
const CHANGE_EVENT = "vantage:watchlist-changed";

export interface WatchlistEntry {
  symbol: string;
  name: string;
  type: string;
  addedAt: number;
}

const read = (): WatchlistEntry[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const write = (entries: WatchlistEntry[]) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    /* storage full/blocked — ignore */
  }
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
};

/**
 * Local watchlist stored in localStorage and synced across components
 * (and tabs) via a custom event + the storage event.
 */
export function useWatchlist() {
  const [entries, setEntries] = useState<WatchlistEntry[]>(read);

  useEffect(() => {
    const sync = () => setEntries(read());
    window.addEventListener(CHANGE_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(CHANGE_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const toggle = useCallback((entry: { symbol: string; name: string; type: string }) => {
    const symbol = entry.symbol.toUpperCase();
    const current = read();
    const exists = current.some((e) => e.symbol === symbol);
    const next = exists
      ? current.filter((e) => e.symbol !== symbol)
      : [...current, { symbol, name: entry.name, type: entry.type, addedAt: Date.now() }];
    write(next);
    return !exists;
  }, []);

  const isWatched = useCallback(
    (symbol: string) => entries.some((e) => e.symbol === symbol.toUpperCase()),
    [entries],
  );

  return { entries, toggle, isWatched };
}
