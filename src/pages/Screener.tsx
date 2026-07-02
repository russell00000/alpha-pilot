import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Filter, Search, TrendingUp, TrendingDown, Loader2, RefreshCw, ArrowUpDown, ArrowUp, ArrowDown, SlidersHorizontal, X } from "lucide-react";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { top100Stocks } from "@/data/top-stocks";
import { cn } from "@/lib/utils";
import financeBg from "@/assets/finance-bg.jpg";

// Row model returned by the screener edge action.
type ScreenerRow = {
  symbol: string;
  name: string;
  sector?: string;
  price: number | null;
  changePercent: number | null;
  marketCap: number | null;
  peRatio: number | null;
  forwardPE: number | null;
  eps: number | null;
  dividendYield: number | null;
  volume: number | null;
  avgVolume: number | null;
  fiftyTwoWeekHigh: number | null;
  fiftyTwoWeekLow: number | null;
  exchange: string | null;
};

const SECTORS = [
  "Technology",
  "Healthcare",
  "Financial",
  "Consumer Cyclical",
  "Consumer Defensive",
  "Communication Services",
  "Industrials",
  "Energy",
  "Utilities",
  "Real Estate",
  "Basic Materials",
];

// Normalize inconsistent sector labels from static data.
const normalizeSector = (s?: string) => {
  if (!s) return undefined;
  if (s === "Communication") return "Communication Services";
  return s;
};

type MarketCapTier = "any" | "mega" | "large" | "mid" | "small";
type Preset =
  | "none"
  | "top-gainers"
  | "top-losers"
  | "most-active"
  | "value"
  | "growth"
  | "dividend"
  | "near-52w-high"
  | "near-52w-low";

type SortKey =
  | "symbol"
  | "name"
  | "sector"
  | "price"
  | "changePercent"
  | "marketCap"
  | "peRatio"
  | "dividendYield"
  | "volume"
  | "eps";

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

const capTier = (mc: number | null): MarketCapTier => {
  if (mc == null) return "any";
  if (mc >= 200e9) return "mega";
  if (mc >= 10e9) return "large";
  if (mc >= 2e9) return "mid";
  return "small";
};

const Screener = () => {
  const navigate = useNavigate();
  const [rows, setRows] = useState<ScreenerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Filters
  const [query, setQuery] = useState("");
  const [sector, setSector] = useState<string>("any");
  const [cap, setCap] = useState<MarketCapTier>("any");
  const [minPrice, setMinPrice] = useState<string>("");
  const [maxPrice, setMaxPrice] = useState<string>("");
  const [minChange, setMinChange] = useState<string>("");
  const [maxChange, setMaxChange] = useState<string>("");
  const [maxPE, setMaxPE] = useState<string>("");
  const [minDivYield, setMinDivYield] = useState<string>("");
  const [preset, setPreset] = useState<Preset>("none");
  const [showFilters, setShowFilters] = useState(true);

  // Sort
  const [sortKey, setSortKey] = useState<SortKey>("marketCap");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const loadData = async (silent = false) => {
    if (silent) setRefreshing(true);
    else setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("market-data", {
        body: { screener: top100Stocks.map((s) => s.symbol) },
      });
      if (error) throw error;
      const enriched: ScreenerRow[] = (data?.data || []).map((r: ScreenerRow) => {
        const meta = top100Stocks.find((s) => s.symbol === r.symbol);
        return { ...r, sector: normalizeSector(meta?.sector), name: meta?.name || r.name };
      });
      setRows(enriched);
      setLastUpdated(new Date());
    } catch (e) {
      console.error("Screener load failed", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const minP = parseFloat(minPrice);
    const maxP = parseFloat(maxPrice);
    const minC = parseFloat(minChange);
    const maxC = parseFloat(maxChange);
    const maxPeN = parseFloat(maxPE);
    const minDivN = parseFloat(minDivYield);

    let out = rows.filter((r) => {
      if (q) {
        const hay = `${r.symbol} ${r.name}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (sector !== "any" && r.sector !== sector) return false;
      if (cap !== "any" && capTier(r.marketCap) !== cap) return false;
      if (!isNaN(minP) && (r.price ?? -Infinity) < minP) return false;
      if (!isNaN(maxP) && (r.price ?? Infinity) > maxP) return false;
      if (!isNaN(minC) && (r.changePercent ?? -Infinity) < minC) return false;
      if (!isNaN(maxC) && (r.changePercent ?? Infinity) > maxC) return false;
      if (!isNaN(maxPeN) && (r.peRatio == null || r.peRatio > maxPeN)) return false;
      if (!isNaN(minDivN) && (r.dividendYield ?? -Infinity) < minDivN) return false;
      return true;
    });

    // Preset overlays (further narrows result set)
    switch (preset) {
      case "top-gainers":
        out = out.filter((r) => (r.changePercent ?? 0) > 0);
        break;
      case "top-losers":
        out = out.filter((r) => (r.changePercent ?? 0) < 0);
        break;
      case "most-active":
        out = out.filter((r) => (r.volume ?? 0) > 5_000_000);
        break;
      case "value":
        out = out.filter((r) => r.peRatio != null && r.peRatio > 0 && r.peRatio < 15);
        break;
      case "growth":
        out = out.filter((r) => r.forwardPE != null && r.forwardPE > 15 && (r.changePercent ?? 0) >= 0);
        break;
      case "dividend":
        out = out.filter((r) => (r.dividendYield ?? 0) >= 2);
        break;
      case "near-52w-high":
        out = out.filter((r) => r.price != null && r.fiftyTwoWeekHigh != null && r.price / r.fiftyTwoWeekHigh >= 0.95);
        break;
      case "near-52w-low":
        out = out.filter((r) => r.price != null && r.fiftyTwoWeekLow != null && r.price / r.fiftyTwoWeekLow <= 1.1);
        break;
    }

    // Preset default sort
    const effectiveSort: { key: SortKey; dir: "asc" | "desc" } = (() => {
      if (preset === "top-gainers") return { key: "changePercent", dir: "desc" };
      if (preset === "top-losers") return { key: "changePercent", dir: "asc" };
      if (preset === "most-active") return { key: "volume", dir: "desc" };
      if (preset === "dividend") return { key: "dividendYield", dir: "desc" };
      if (preset === "value") return { key: "peRatio", dir: "asc" };
      return { key: sortKey, dir: sortDir };
    })();

    const dirMul = effectiveSort.dir === "asc" ? 1 : -1;
    const key = effectiveSort.key;

    out.sort((a, b) => {
      const av = a[key as keyof ScreenerRow];
      const bv = b[key as keyof ScreenerRow];
      if (typeof av === "string" && typeof bv === "string") {
        return av.localeCompare(bv) * dirMul;
      }
      const an = typeof av === "number" ? av : -Infinity * dirMul;
      const bn = typeof bv === "number" ? bv : -Infinity * dirMul;
      if (an === bn) return 0;
      return (an < bn ? -1 : 1) * dirMul;
    });

    return out;
  }, [rows, query, sector, cap, minPrice, maxPrice, minChange, maxChange, maxPE, minDivYield, preset, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const resetFilters = () => {
    setQuery("");
    setSector("any");
    setCap("any");
    setMinPrice("");
    setMaxPrice("");
    setMinChange("");
    setMaxChange("");
    setMaxPE("");
    setMinDivYield("");
    setPreset("none");
  };

  const activeFilterCount =
    [query, sector !== "any", cap !== "any", minPrice, maxPrice, minChange, maxChange, maxPE, minDivYield, preset !== "none"]
      .filter(Boolean).length;

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

  const presetPills: { id: Preset; label: string }[] = [
    { id: "top-gainers", label: "Top Gainers" },
    { id: "top-losers", label: "Top Losers" },
    { id: "most-active", label: "Most Active" },
    { id: "value", label: "Value (P/E < 15)" },
    { id: "growth", label: "Growth" },
    { id: "dividend", label: "Dividend ≥ 2%" },
    { id: "near-52w-high", label: "Near 52W High" },
    { id: "near-52w-low", label: "Near 52W Low" },
  ];

  return (
    <div className="min-h-screen bg-background relative">
      <div className="fixed inset-0 pointer-events-none opacity-100" style={{ backgroundImage: `url(${financeBg})`, backgroundSize: "cover", backgroundPosition: "center", backgroundRepeat: "no-repeat" }} />
      <div className="fixed inset-0 pointer-events-none bg-background/70" />

      <Header />

      <main className="container mx-auto px-4 py-8 relative">
        {/* Hero */}
        <div className="rounded-2xl bg-background/50 backdrop-blur-sm border border-border/20 p-6 md:p-8 mb-6">
          <div className="flex items-center gap-3 mb-2">
            <Filter className="w-6 h-6 text-primary" />
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">Stock Screener</h1>
          </div>
          <p className="text-sm md:text-base text-muted-foreground">
            Filter the market by sector, market cap, valuation, dividend yield, momentum and more.
          </p>

          {/* Preset pills */}
          <div className="flex flex-wrap gap-2 mt-5">
            {presetPills.map((p) => (
              <button
                key={p.id}
                onClick={() => setPreset((cur) => (cur === p.id ? "none" : p.id))}
                className={cn(
                  "text-xs font-medium px-3 py-1.5 rounded-full border transition-all",
                  preset === p.id
                    ? "bg-primary text-primary-foreground border-primary shadow-md shadow-primary/20"
                    : "border-border/50 text-muted-foreground hover:border-primary/40 hover:text-foreground",
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
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
              {/* Search */}
              <div className="lg:col-span-2">
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Search</label>
                <div className="relative mt-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Ticker or company name..."
                    className="pl-9 h-10"
                  />
                </div>
              </div>

              {/* Sector */}
              <div>
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Sector</label>
                <Select value={sector} onValueChange={setSector}>
                  <SelectTrigger className="mt-1 h-10"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">Any sector</SelectItem>
                    {SECTORS.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Market cap */}
              <div>
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Market Cap</label>
                <Select value={cap} onValueChange={(v) => setCap(v as MarketCapTier)}>
                  <SelectTrigger className="mt-1 h-10"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">Any size</SelectItem>
                    <SelectItem value="mega">Mega ({">"}$200B)</SelectItem>
                    <SelectItem value="large">Large ($10B–$200B)</SelectItem>
                    <SelectItem value="mid">Mid ($2B–$10B)</SelectItem>
                    <SelectItem value="small">Small ({"<"}$2B)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Price */}
              <div>
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Price ($)</label>
                <div className="flex gap-2 mt-1">
                  <Input value={minPrice} onChange={(e) => setMinPrice(e.target.value)} placeholder="Min" className="h-10" inputMode="decimal" />
                  <Input value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} placeholder="Max" className="h-10" inputMode="decimal" />
                </div>
              </div>

              {/* % change */}
              <div>
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Change % (Today)</label>
                <div className="flex gap-2 mt-1">
                  <Input value={minChange} onChange={(e) => setMinChange(e.target.value)} placeholder="Min" className="h-10" inputMode="decimal" />
                  <Input value={maxChange} onChange={(e) => setMaxChange(e.target.value)} placeholder="Max" className="h-10" inputMode="decimal" />
                </div>
              </div>

              {/* Max P/E */}
              <div>
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Max P/E</label>
                <Input value={maxPE} onChange={(e) => setMaxPE(e.target.value)} placeholder="e.g. 25" className="mt-1 h-10" inputMode="decimal" />
              </div>

              {/* Min div yield */}
              <div>
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Min Dividend %</label>
                <Input value={minDivYield} onChange={(e) => setMinDivYield(e.target.value)} placeholder="e.g. 2" className="mt-1 h-10" inputMode="decimal" />
              </div>
            </div>
          )}
        </div>

        {/* Results summary */}
        <div className="flex items-center justify-between mb-3 px-1">
          <p className="text-sm text-muted-foreground">
            {loading ? "Loading…" : (
              <>
                <span className="font-semibold text-foreground font-mono">{filtered.length}</span>
                {" "}of {rows.length} securities match
              </>
            )}
          </p>
          <p className="text-xs text-muted-foreground">
            {lastUpdated && `Updated ${lastUpdated.toLocaleTimeString()}`}
          </p>
        </div>

        {/* Results table */}
        <div className="rounded-2xl bg-background/50 backdrop-blur-sm border border-border/20 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px]">
              <thead>
                <tr className="border-b border-border/50 bg-background/40">
                  <th className="text-left p-3 pl-4"><SortHeader label="Symbol" k="symbol" /></th>
                  <th className="text-left p-3"><SortHeader label="Company" k="name" /></th>
                  <th className="text-left p-3"><SortHeader label="Sector" k="sector" /></th>
                  <th className="text-right p-3"><SortHeader label="Price" k="price" className="ml-auto" /></th>
                  <th className="text-right p-3"><SortHeader label="Change" k="changePercent" className="ml-auto" /></th>
                  <th className="text-right p-3"><SortHeader label="Market Cap" k="marketCap" className="ml-auto" /></th>
                  <th className="text-right p-3"><SortHeader label="P/E" k="peRatio" className="ml-auto" /></th>
                  <th className="text-right p-3"><SortHeader label="EPS" k="eps" className="ml-auto" /></th>
                  <th className="text-right p-3"><SortHeader label="Div %" k="dividendYield" className="ml-auto" /></th>
                  <th className="text-right p-3 pr-4"><SortHeader label="Volume" k="volume" className="ml-auto" /></th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  [...Array(12)].map((_, i) => (
                    <tr key={i} className="border-b border-border/40 animate-pulse">
                      {[...Array(10)].map((__, j) => (
                        <td key={j} className="p-3"><div className="h-4 bg-muted rounded w-16" /></td>
                      ))}
                    </tr>
                  ))
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="p-12 text-center">
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
                  filtered.map((r) => {
                    const positive = (r.changePercent ?? 0) >= 0;
                    return (
                      <tr
                        key={r.symbol}
                        onClick={() => navigate(`/stock/${r.symbol}`)}
                        className="border-b border-border/40 hover:bg-muted/20 transition-colors cursor-pointer"
                      >
                        <td className="p-3 pl-4">
                          <span className="font-mono font-semibold text-foreground">{r.symbol}</span>
                        </td>
                        <td className="p-3">
                          <span className="text-sm text-foreground line-clamp-1">{r.name}</span>
                        </td>
                        <td className="p-3">
                          <span className="text-xs text-muted-foreground">{r.sector || "—"}</span>
                        </td>
                        <td className="p-3 text-right font-mono text-foreground">{formatPrice(r.price)}</td>
                        <td className="p-3 text-right">
                          {r.changePercent == null ? (
                            <span className="text-muted-foreground">—</span>
                          ) : (
                            <span
                              className={cn(
                                "inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-mono font-semibold",
                                positive ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive",
                              )}
                            >
                              {positive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                              {positive ? "+" : ""}{r.changePercent.toFixed(2)}%
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-right font-mono text-foreground">{formatCap(r.marketCap)}</td>
                        <td className="p-3 text-right font-mono text-muted-foreground">
                          {r.peRatio != null ? r.peRatio.toFixed(1) : "—"}
                        </td>
                        <td className="p-3 text-right font-mono text-muted-foreground">
                          {r.eps != null ? r.eps.toFixed(2) : "—"}
                        </td>
                        <td className="p-3 text-right font-mono text-muted-foreground">
                          {r.dividendYield != null ? `${r.dividendYield.toFixed(2)}%` : "—"}
                        </td>
                        <td className="p-3 pr-4 text-right font-mono text-muted-foreground">{formatVolume(r.volume)}</td>
                      </tr>
                    );
                  })
                )}
                {refreshing && !loading && (
                  <tr>
                    <td colSpan={10} className="p-2 text-center">
                      <Loader2 className="w-4 h-4 animate-spin inline text-muted-foreground" />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <p className="text-xs text-muted-foreground text-center mt-4">
          Fundamentals sourced from Yahoo Finance. P/E is trailing twelve months. Dividend yield reflects trailing annual payouts.
        </p>
      </main>
    </div>
  );
};

export default Screener;