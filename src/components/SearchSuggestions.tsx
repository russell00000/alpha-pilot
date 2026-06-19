import { BarChart3, Bitcoin, Briefcase, PieChart, SearchX } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SuggestionAsset {
  symbol: string;
  name: string;
  type: "stock" | "crypto" | "etf" | "mutual_fund";
}

interface SearchSuggestionsProps {
  suggestions: SuggestionAsset[];
  onSelect: (asset: SuggestionAsset) => void;
  visible: boolean;
  query?: string;
  className?: string;
}

const typeConfig: Record<
  string,
  { icon: typeof BarChart3; label: string; color: string }
> = {
  stock: { icon: BarChart3, label: "Stock", color: "text-emerald-400" },
  crypto: { icon: Bitcoin, label: "Crypto", color: "text-amber-400" },
  etf: { icon: PieChart, label: "ETF", color: "text-sky-400" },
  mutual_fund: { icon: Briefcase, label: "Fund", color: "text-violet-400" },
};

export function SearchSuggestions({
  suggestions,
  onSelect,
  visible,
  query,
  className,
}: SearchSuggestionsProps) {
  if (!visible) return null;

  if (suggestions.length === 0 && query?.trim()) {
    return (
      <div
        className={cn(
          "absolute z-50 w-full mt-2",
          "bg-background/80 backdrop-blur-xl",
          "border border-border/30 rounded-xl",
          "shadow-[0_8px_32px_-8px_rgba(0,0,0,0.5)]",
          "overflow-hidden",
          className
        )}
      >
        <div className="flex items-center gap-3 px-4 py-6 text-muted-foreground">
          <SearchX className="w-5 h-5 opacity-50" />
          <span className="text-sm">No matching securities found</span>
        </div>
      </div>
    );
  }

  if (suggestions.length === 0) return null;

  return (
    <div
      className={cn(
        "absolute z-50 w-full mt-2",
        "bg-background/80 backdrop-blur-xl",
        "border border-border/30 rounded-xl",
        "shadow-[0_8px_32px_-8px_rgba(0,0,0,0.5)]",
        "max-h-80 overflow-y-auto scrollbar-hide",
        "animate-stagger",
        className
      )}
    >
      {suggestions.map((asset, index) => {
        const config = typeConfig[asset.type] || typeConfig.stock;
        const Icon = config.icon;

        return (
          <button
            key={`${asset.symbol}-${index}`}
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              onSelect(asset);
            }}
            className={cn(
              "group w-full px-4 py-3 text-left",
              "flex items-center gap-3",
              "border-b border-border/20 last:border-b-0",
              "transition-all duration-200 ease-out",
              "hover:bg-primary/[0.04]",
              "focus:bg-primary/[0.04] focus:outline-none"
            )}
          >
            {/* Left accent bar on hover */}
            <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-primary/0 group-hover:bg-primary/60 transition-colors duration-200 rounded-r-full" />

            {/* Icon */}
            <div
              className={cn(
                "flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center",
                "bg-secondary/60 border border-border/30",
                "transition-colors duration-200",
                "group-hover:bg-secondary group-hover:border-border/50"
              )}
            >
              <Icon className={cn("w-4 h-4", config.color)} />
            </div>

            {/* Text content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-foreground text-sm tracking-tight">
                  {asset.symbol}
                </span>
                <span className="text-xs text-muted-foreground truncate">
                  {asset.name}
                </span>
              </div>
            </div>

            {/* Type badge */}
            <span
              className={cn(
                "flex-shrink-0 text-[10px] font-medium uppercase tracking-wider",
                "px-2 py-1 rounded-md",
                "bg-secondary/50 border border-border/30",
                "text-muted-foreground",
                "transition-colors duration-200",
                "group-hover:bg-secondary group-hover:text-foreground/80"
              )}
            >
              {config.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
