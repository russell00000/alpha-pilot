import { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Filter, Search, TrendingUp, TrendingDown, Loader2, RefreshCw, ArrowUpDown, ArrowUp, ArrowDown, SlidersHorizontal, X, ChevronLeft, ChevronRight, Info } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import financeBg from "@/assets/finance-bg.jpg";

// Row shape returned by the `screener` edge function (from screener_view).
type ScreenerRow = {
  symbol: string;
  name: string;
  exchange: string | null;
  asset_type: string;
  sector: string | null;
  pe_ratio: number | null;
  forward_pe: number | null;
  eps: number | null;
  dividend_yield: number | null;
  revenue_growth: number | null;
  profit_margins: number | null;
  debt_to_equity: number | null;
  eps_beat_streak: number | null;
  eps_miss_streak: number | null;
  fundamental_score: number | null;
  price: number | null;
  change_pct: number | null;
  volume: number | null;
  avg_volume: number | null;
  market_cap: number | null;
  rsi_14: number | null;
  macd_hist: number | null;
  macd_prev_hist: number | null;
  sma_50: number | null;
  sma_200: number | null;
  fifty_two_week_high: number | null;
  fifty_two_week_low: number | null;
  technical_score: number | null;
  combined_score: number | null;
  rating: "strong_buy" | "buy" | "hold" | "sell" | "strong_sell" | null;
};

const SECTORS = [
  "Technology","Healthcare","Financial Services","Consumer Cyclical","Consumer Defensive",
  "Communication Services","Industrials","Energy","Utilities","Real Estate","Basic Materials",
];

type MarketCapTier = "any" | "mega" | "large" | "mid" | "small";
type Rating = "any" | "strong_buy" | "buy" | "hold" | "sell" | "strong_sell";
type AssetType = "any" | "stock" | "etf";

type SortKey =
  | "symbol" | "name" | "sector" | "price" | "change_pct"
  | "market_cap" | "pe_ratio" | "dividend_yield" | "volume"
  | "combined_score" | "technical_score" | "fundamental_score";

const ratingLabel = (r: ScreenerRow["rating"]): { label: string; tone: "buy" | "hold" | "sell" | "neutral" } => {
  switch (r) {
    case "strong_buy": return { label: "Strong Buy", tone: "buy" };
    case "buy": return { label: "Buy", tone: "buy" };
    case "hold": return { label: "Hold", tone: "hold" };
    case "sell": return { label: "Sell", tone: "sell" };
    case "strong_sell": return { label: "Strong Sell", tone: "sell" };
    default: return { label: "—", tone: "neutral" };
  }
};

const capTierToMin = (t: MarketCapTier): number | null => {
  if (t === "mega") return 200e9;
  if (t === "large") return 10e9;
  if (t === "mid") return 2e9;
  if (t === "small") return 0;
  return null;
};

const formatCap = (n: number | null) => {
  if (n == null) return "—";
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  return `$${n.toLocaleString()}`;
};
const formatVolume = (n: number | null) => {
  if (n == null) return "—";
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return `${n}`;
};
const formatPrice = (n: number | null) =>
  n == null ? "—" : `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const Screener = () => {
  const navigate = useNavigate();
  const [rows, setRows] = useState<ScreenerRow[]>([]);
  const reqIdRef = useRef(0);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Filters — restored from the last visit so the screen picks up where you left off.
  const savedFilters = (() => {
    try { return JSON.parse(localStorage.getItem("vantage:screener-filters") || "{}"); } catch { return {}; }
  })();
  const [query, setQuery] = useState<string>(savedFilters.query ?? "");
  const [sector, setSector] = useState<string>(savedFilters.sector ?? "any");
  const [assetType, setAssetType] = useState<AssetType>(savedFilters.assetType ?? "any");
  const [cap, setCap] = useState<MarketCapTier>(savedFilters.cap ?? "any");
  const [minPrice, setMinPrice] = useState<string>(savedFilters.minPrice ?? "");
  const [maxPrice, setMaxPrice] = useState<string>(savedFilters.maxPrice ?? "");
  const [minChange, setMinChange] = useState<string>(savedFilters.minChange ?? "");
  const [maxChange, setMaxChange] = useState<string>(savedFilters.maxChange ?? "");
  const [maxPE, setMaxPE] = useState<string>(savedFilters.maxPE ?? "");
  const [minDivYield, setMinDivYield] = useState<string>(savedFilters.minDivYield ?? "");
  const [rating, setRating] = useState<Rating>(savedFilters.rating ?? "any");
  const [showFilters, setShowFilters] = useState(true);

  useEffect(() => {
    try {
      localStorage.setItem("vantage:screener-filters", JSON.stringify({
        query, sector, assetType, cap, minPrice, maxPrice, minChange, maxChange, maxPE, minDivYield, rating,
      }));
    } catch { /* ignore */ }
  }, [query, sector, assetType, cap, minPrice, maxPrice, minChange, maxChange, maxPE, minDivYield, rating]);

  // Sort & pagination
  const [sortKey, setSortKey] = useState<SortKey>("market_cap");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const pageSize = 50;

  const loadData = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true); else setLoading(true);
    const myReq = ++reqIdRef.current;
    try {
      const minP = parseFloat(minPrice);
      const maxP = parseFloat(maxPrice);
      const minC = parseFloat(minChange);
      const maxC = parseFloat(maxChange);
      const maxPeN = parseFloat(maxPE);
      const minDivN = parseFloat(minDivYield);
      const minMarketCap = capTierToMin(cap);

      const body: Record<string, unknown> = {
        q: query.trim() || undefined,
        sector: sector !== "any" ? sector : undefined,
        assetType: assetType !== "any" ? assetType : undefined,
        minMarketCap: minMarketCap && minMarketCap > 0 ? minMarketCap : undefined,
        minPrice: isNaN(minP) ? undefined : minP,
        maxPrice: isNaN(maxP) ? undefined : maxP,
        minChange: isNaN(minC) ? undefined : minC,
        maxChange: isNaN(maxC) ? undefined : maxC,
        maxPE: isNaN(maxPeN) ? undefined : maxPeN,
        minDivYield: isNaN(minDivN) ? undefined : minDivN,
        rating: rating !== "any" ? rating : undefined,
        sort: sortKey,
        dir: sortDir,
        page,
        pageSize,
      };
      const { data, error } = await supabase.functions.invoke("screener", { body });
      if (myReq !== reqIdRef.current) return; // stale — a newer request already fired
      if (error) throw error;
      setRows((data?.rows ?? []) as ScreenerRow[]);
      setTotal(data?.total ?? 0);
      setLastUpdated(new Date());
    } catch (e) {
      if (myReq !== reqIdRef.current) return;
      console.error("Screener load failed", e);
      setRows([]); setTotal(0);
    } finally {
      if (myReq === reqIdRef.current) { setLoading(false); setRefreshing(false); }
    }
  }, [query, sector, assetType, cap, minPrice, maxPrice, minChange, maxChange, maxPE, minDivYield, rating, sortKey, sortDir, page]);

  // Debounced auto-load whenever inputs change.
  useEffect(() => {
    const t = setTimeout(() => { loadData(); }, 300);
    return () => clearTimeout(t);
  }, [loadData]);

  // Reset to page 1 whenever a filter (not the page or sort) changes.
  useEffect(() => {
    setPage(1);
  }, [query, sector, assetType, cap, minPrice, maxPrice, minChange, maxChange, maxPE, minDivYield, rating]);

  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(k); setSortDir("desc"); }
  };

  const resetFilters = () => {
    setQuery(""); setSector("any"); setAssetType("any"); setCap("any");
    setMinPrice(""); setMaxPrice(""); setMinChange(""); setMaxChange("");
    setMaxPE(""); setMinDivYield(""); setRating("any");
  };

  const activeFilterCount =
    [query, sector !== "any", assetType !== "any", cap !== "any", minPrice, maxPrice, minChange, maxChange, maxPE, minDivYield, rating !== "any"]
      .filter(Boolean).length;

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const SortHeader = ({ label, k, className }: { label: string; k: SortKey; className?: string }) => {
    const active = sortKey === k;
    const Icon = !active ? ArrowUpDown : sortDir === "asc" ? ArrowUp : ArrowDown;
    return (
      <button
        onClick={() => toggleSort(k)}
        className={cn(
          "inline-flex items-center gap-1 text-xs font-medium uppercase tracking-wider transition-colors",
          active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
          className,
        )}
      >
        {label}
        <Icon className="w-3 h-3" />
      </button>
    );
  };

  // Convert a component score (±6 range) to an expected % move.
  // Rough heuristic: each point of score ≈ 5% expected upside/downside
  // over the coming 12 months, capped implicitly by the score range.
  const expectedPctCell = (v: number | null) => {
    if (v == null) return <span className="text-xs text-muted-foreground">—</span>;
    const pct = v * 5;
    const tone = pct > 0 ? "text-success" : pct < 0 ? "text-destructive" : "text-muted-foreground";
    const sign = pct > 0 ? "+" : "";
    return <span className={cn("font-mono text-xs font-semibold", tone)}>{sign}{pct.toFixed(1)}%</span>;
  };

  return (
    <div className="min-h-screen bg-background relative">
      <div className="fixed inset-0 pointer-events-none opacity-[0.16]" style={{ filter: "brightness(1.2) saturate(0.3) contrast(0.9)", backgroundImage: `url(${financeBg})`, backgroundSize: "cover", backgroundPosition: "center", backgroundRepeat: "no-repeat" }} />
      <div className="fixed inset-0 pointer-events-none bg-background/90" />

      <Header />

      <main className="container mx-auto px-4 py-8 relative">
        {/* Hero */}
        <div className="rounded-2xl bg-background/50 backdrop-blur-sm border border-border/20 p-6 md:p-8 mb-6">
          <div className="flex items-center gap-3 mb-2">
            <Filter className="w-6 h-6 text-primary" />
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">Stock Screener</h1>
          </div>
          <p className="text-sm md:text-base text-muted-foreground">
            The full US-listed universe — filter by sector, size, valuation and momentum. Scores refresh nightly.
          </p>
        </div>

        {/* Filter panel */}
        <div className="rounded-2xl bg-background/50 backdrop-blur-sm border border-border/20 mb-4">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border/30">
            <button
              onClick={() => setShowFilters((v) => !v)}
              className="flex items-center gap-2 text-sm font-medium text-foreground"
            >
              <SlidersHorizontal className="w-4 h-4" />
              Filters
              {activeFilterCount > 0 && (
                <span className="ml-1 text-[10px] font-mono px-2 py-0.5 rounded-full bg-primary/15 text-primary">
                  {activeFilterCount} active
                </span>
              )}
            </button>
            <div className="flex items-center gap-2">
              {activeFilterCount > 0 && (
                <Button variant="ghost" size="sm" onClick={resetFilters} className="h-8 text-xs">
                  <X className="w-3 h-3 mr-1" /> Clear
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={() => loadData(true)} disabled={refreshing} className="h-8 text-xs gap-2">
                <RefreshCw className={cn("w-3 h-3", refreshing && "animate-spin")} />
                Refresh
              </Button>
            </div>
          </div>

          {showFilters && (
            <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="lg:col-span-2">
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Search</label>
                <div className="relative mt-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Ticker or company name..." className="pl-9 h-10" />
                </div>
              </div>

              <div>
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Asset Type</label>
                <Select value={assetType} onValueChange={(v) => setAssetType(v as AssetType)}>
                  <SelectTrigger className="mt-1 h-10"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">Stocks & ETFs</SelectItem>
                    <SelectItem value="stock">Stocks only</SelectItem>
                    <SelectItem value="etf">ETFs only</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Sector</label>
                <Select value={sector} onValueChange={setSector}>
                  <SelectTrigger className="mt-1 h-10"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">Any sector</SelectItem>
                    {SECTORS.map((s) => (<SelectItem key={s} value={s}>{s}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Market Cap</label>
                <Select value={cap} onValueChange={(v) => setCap(v as MarketCapTier)}>
                  <SelectTrigger className="mt-1 h-10"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">Any size</SelectItem>
                    <SelectItem value="mega">Mega ({">"}$200B)</SelectItem>
                    <SelectItem value="large">Large ($10B+)</SelectItem>
                    <SelectItem value="mid">Mid ($2B+)</SelectItem>
                    <SelectItem value="small">Small (all)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Vantage Rating</label>
                <Select value={rating} onValueChange={(v) => setRating(v as Rating)}>
                  <SelectTrigger className="mt-1 h-10"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">Any rating</SelectItem>
                    <SelectItem value="strong_buy">Strong Buy</SelectItem>
                    <SelectItem value="buy">Buy</SelectItem>
                    <SelectItem value="hold">Hold</SelectItem>
                    <SelectItem value="sell">Sell</SelectItem>
                    <SelectItem value="strong_sell">Strong Sell</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Price ($)</label>
                <div className="flex gap-2 mt-1">
                  <Input value={minPrice} onChange={(e) => setMinPrice(e.target.value)} placeholder="Min" className="h-10" inputMode="decimal" />
                  <Input value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} placeholder="Max" className="h-10" inputMode="decimal" />
                </div>
              </div>

              <div>
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Change % (Today)</label>
                <div className="flex gap-2 mt-1">
                  <Input value={minChange} onChange={(e) => setMinChange(e.target.value)} placeholder="Min" className="h-10" inputMode="decimal" />
                  <Input value={maxChange} onChange={(e) => setMaxChange(e.target.value)} placeholder="Max" className="h-10" inputMode="decimal" />
                </div>
              </div>

              <div>
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Max P/E</label>
                <Input value={maxPE} onChange={(e) => setMaxPE(e.target.value)} placeholder="e.g. 25" className="mt-1 h-10" inputMode="decimal" />
              </div>

              <div>
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Min Dividend %</label>
                <Input value={minDivYield} onChange={(e) => setMinDivYield(e.target.value)} placeholder="e.g. 2" className="mt-1 h-10" inputMode="decimal" />
              </div>
            </div>
          )}
        </div>

        {/* Summary */}
        <div className="flex items-center justify-between mb-3 px-1">
          <p className="text-sm text-muted-foreground">
            {loading ? "Loading…" : (
              <>
                <span className="font-semibold text-foreground font-mono">{total.toLocaleString()}</span>
                {" "}securities match — page {page} of {totalPages}
              </>
            )}
          </p>
          <p className="text-xs text-muted-foreground">
            {lastUpdated && `Updated ${lastUpdated.toLocaleTimeString()}`}
          </p>
        </div>

        {/* Table */}
        <div className="rounded-2xl bg-background/50 backdrop-blur-sm border border-border/20 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px]">
              <thead>
                <tr className="border-b border-border/50 bg-background/40">
                  <th className="text-left p-3 pl-4"><SortHeader label="Symbol" k="symbol" /></th>
                  <th className="text-left p-3"><SortHeader label="Company" k="name" /></th>
                  <th className="text-left p-3"><SortHeader label="Sector" k="sector" /></th>
                  <th className="text-right p-3"><SortHeader label="Price" k="price" className="ml-auto" /></th>
                  <th className="text-right p-3"><SortHeader label="Change" k="change_pct" className="ml-auto" /></th>
                  <th className="text-right p-3"><SortHeader label="Market Cap" k="market_cap" className="ml-auto" /></th>
                  <th className="text-right p-3"><SortHeader label="P/E" k="pe_ratio" className="ml-auto" /></th>
                  <th className="text-right p-3"><SortHeader label="Div %" k="dividend_yield" className="ml-auto" /></th>
                  <th className="text-center p-3"><SortHeader label="Expected Move" k="combined_score" className="mx-auto" /></th>
                  <th className="text-center p-3"><SortHeader label="Rating" k="combined_score" className="mx-auto" /></th>
                  <th className="text-right p-3 pr-4"><SortHeader label="Volume" k="volume" className="ml-auto" /></th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  [...Array(12)].map((_, i) => (
                    <tr key={i} className="border-b border-border/40 animate-pulse">
                      {[...Array(11)].map((__, j) => (
                        <td key={j} className="p-3"><div className="h-4 bg-muted rounded w-16" /></td>
                      ))}
                    </tr>
                  ))
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="p-12 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <Search className="w-10 h-10 text-muted-foreground/50" />
                        <p className="text-muted-foreground">No securities match these filters.</p>
                        {activeFilterCount > 0 && (
                          <Button variant="outline" size="sm" onClick={resetFilters}>Clear filters</Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  rows.map((r) => {
                    const positive = (r.change_pct ?? 0) >= 0;
                    const { label, tone } = ratingLabel(r.rating);
                    return (
                      <tr
                        key={r.symbol}
                        onClick={() => navigate(`/stock/${r.symbol}`)}
                        className="border-b border-border/40 hover:bg-muted/20 transition-colors cursor-pointer"
                      >
                        <td className="p-3 pl-4"><span className="font-mono font-semibold text-foreground">{r.symbol}</span></td>
                        <td className="p-3"><span className="text-sm text-foreground line-clamp-1">{r.name}</span></td>
                        <td className="p-3"><span className="text-xs text-muted-foreground">{r.sector || (r.asset_type === "etf" ? "ETF" : "—")}</span></td>
                        <td className="p-3 text-right font-mono text-foreground">{formatPrice(r.price)}</td>
                        <td className="p-3 text-right">
                          {r.change_pct == null ? <span className="text-muted-foreground">—</span> : (
                            <span className={cn("inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-mono font-semibold",
                              positive ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive")}>
                              {positive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                              {positive ? "+" : ""}{r.change_pct.toFixed(2)}%
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-right font-mono text-foreground">{formatCap(r.market_cap)}</td>
                        <td className="p-3 text-right font-mono text-muted-foreground">{r.pe_ratio != null ? r.pe_ratio.toFixed(1) : "—"}</td>
                        <td className="p-3 text-right font-mono text-muted-foreground">{r.dividend_yield != null ? `${r.dividend_yield.toFixed(2)}%` : "—"}</td>
                        <td className="p-3 text-center">{expectedPctCell(r.combined_score)}</td>
                        <td className="p-3 text-center">
                          {label === "—" ? (
                            <span className="text-xs text-muted-foreground">—</span>
                          ) : (
                            <span className={cn(
                              "inline-block text-[10px] font-semibold uppercase tracking-wider px-2 py-1 rounded-md border",
                              tone === "buy" && "bg-success/10 text-success border-success/30",
                              tone === "hold" && "bg-muted/40 text-muted-foreground border-border/50",
                              tone === "sell" && "bg-destructive/10 text-destructive border-destructive/30",
                            )}>{label}</span>
                          )}
                        </td>
                        <td className="p-3 pr-4 text-right font-mono text-muted-foreground">{formatVolume(r.volume)}</td>
                      </tr>
                    );
                  })
                )}
                {refreshing && !loading && (
                  <tr><td colSpan={11} className="p-2 text-center"><Loader2 className="w-4 h-4 animate-spin inline text-muted-foreground" /></td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pagination */}
        {!loading && total > pageSize && (
          <div className="flex items-center justify-center gap-2 mt-4">
            <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="h-8 gap-1">
              <ChevronLeft className="w-3 h-3" /> Prev
            </Button>
            <span className="text-sm text-muted-foreground font-mono px-3">
              {page} / {totalPages}
            </span>
            <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="h-8 gap-1">
              Next <ChevronRight className="w-3 h-3" />
            </Button>
          </div>
        )}

        <p className="text-xs text-muted-foreground text-center mt-4">
          Full US-listed universe from NASDAQ Trader. Fundamentals & technicals cached nightly from Yahoo Finance.
        </p>
      </main>
    </div>
  );
};

export default Screener;
