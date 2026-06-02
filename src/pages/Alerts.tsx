import { useState } from "react";
import { Bell, Plus, Trash2, Mail, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import Header from "@/components/Header";
import { top100Stocks, topETFs, topMutualFunds } from "@/data/top-stocks";

interface PriceAlert {
  id: string;
  symbol: string;
  name: string;
  condition: "above" | "below";
  price: number;
  email: string;
  enabled: boolean;
}

// Crypto assets for search
const cryptoAssets = [
  { symbol: "BTC", name: "Bitcoin", type: "crypto" },
  { symbol: "ETH", name: "Ethereum", type: "crypto" },
  { symbol: "XRP", name: "XRP", type: "crypto" },
  { symbol: "SOL", name: "Solana", type: "crypto" },
  { symbol: "DOGE", name: "Dogecoin", type: "crypto" },
  { symbol: "ADA", name: "Cardano", type: "crypto" },
  { symbol: "LINK", name: "Chainlink", type: "crypto" },
  { symbol: "AVAX", name: "Avalanche", type: "crypto" },
  { symbol: "DOT", name: "Polkadot", type: "crypto" },
  { symbol: "MATIC", name: "Polygon", type: "crypto" },
];

// Combine all assets for search
const allAssets = [
  ...top100Stocks.map(s => ({ symbol: s.symbol, name: s.name, type: "stock" })),
  ...topETFs.map(e => ({ symbol: e.symbol, name: e.name, type: "etf" })),
  ...topMutualFunds.map(m => ({ symbol: m.symbol, name: m.name, type: "mutual_fund" })),
  ...cryptoAssets,
];

const Alerts = () => {
  const { toast } = useToast();
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [symbolQuery, setSymbolQuery] = useState("");
  const [selectedSymbol, setSelectedSymbol] = useState<{ symbol: string; name: string } | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [condition, setCondition] = useState<"above" | "below">("above");
  const [price, setPrice] = useState("");
  const [email, setEmail] = useState("");

  // Filter suggestions based on query
  const filteredSuggestions = symbolQuery.trim()
    ? (() => {
        const query = symbolQuery.toLowerCase().trim();

        const score = (asset: { symbol: string; name: string }) => {
          const sym = asset.symbol.toLowerCase();
          const name = asset.name.toLowerCase();

          if (sym === query) return 0;
          if (name === query) return 1;
          if (sym.startsWith(query)) return 10;
          if (name.startsWith(query)) return 11;
          const wordPrefix = name.split(/\s+/).some((w) => w.startsWith(query));
          if (wordPrefix) return 20;
          if (sym.includes(query)) return 30;
          if (name.includes(query)) return 31;
          return 999;
        };

        return allAssets
          .map((asset) => ({ asset, score: score(asset) }))
          .filter((x) => x.score < 999)
          .sort((a, b) => {
            if (a.score !== b.score) return a.score - b.score;
            const lenA = a.asset.symbol.length + a.asset.name.length;
            const lenB = b.asset.symbol.length + b.asset.name.length;
            return lenA - lenB;
          })
          .slice(0, 16)
          .map((x) => x.asset);
      })()
    : [];

  const handleSelectSymbol = (asset: { symbol: string; name: string; type: string }) => {
    setSelectedSymbol({ symbol: asset.symbol, name: asset.name });
    setSymbolQuery(asset.symbol);
    setShowSuggestions(false);
  };

  const handleAddAlert = () => {
    if (!selectedSymbol || !price || !email) {
      toast({
        title: "Missing fields",
        description: "Please fill in all fields to create an alert",
        variant: "destructive",
      });
      return;
    }

    const newAlert: PriceAlert = {
      id: crypto.randomUUID(),
      symbol: selectedSymbol.symbol.toUpperCase(),
      name: selectedSymbol.name,
      condition,
      price: parseFloat(price),
      email,
      enabled: true,
    };

    setAlerts([...alerts, newAlert]);
    setSymbolQuery("");
    setSelectedSymbol(null);
    setPrice("");
    
    toast({
      title: "Alert created",
      description: `You'll receive an email when ${newAlert.symbol} goes ${condition} $${newAlert.price}`,
    });
  };

  const handleDeleteAlert = (id: string) => {
    setAlerts(alerts.filter((alert) => alert.id !== id));
    toast({
      title: "Alert deleted",
      description: "Price alert has been removed",
    });
  };

  const handleToggleAlert = (id: string) => {
    setAlerts(
      alerts.map((alert) =>
        alert.id === id ? { ...alert, enabled: !alert.enabled } : alert
      )
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="flex items-center gap-3 mb-8">
          <div className="p-3 rounded-xl bg-primary/10">
            <Bell className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Price Alerts</h1>
            <p className="text-muted-foreground">Get email notifications when prices hit your targets</p>
          </div>
        </div>

        {/* Create Alert Form */}
        <div className="glass-card p-6 mb-8">
          <h2 className="text-lg font-semibold text-foreground mb-4">Create New Alert</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Symbol Search with Autocomplete */}
            <div className="space-y-2 relative">
              <Label htmlFor="symbol">Symbol</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="symbol"
                  placeholder="Search AAPL, BTC..."
                  value={symbolQuery}
                  onChange={(e) => {
                    setSymbolQuery(e.target.value);
                    setSelectedSymbol(null);
                    setShowSuggestions(true);
                  }}
                  onFocus={() => setShowSuggestions(true)}
                  onBlur={() => {
                    setTimeout(() => setShowSuggestions(false), 200);
                  }}
                  className="pl-9 bg-secondary/30 border-border/50"
                />
              </div>
              
              {/* Suggestions Dropdown */}
              {showSuggestions && symbolQuery && filteredSuggestions.length > 0 && (
                <div className="absolute z-50 w-full mt-1 bg-background border border-border rounded-lg shadow-lg max-h-96 overflow-y-auto">
                  {filteredSuggestions.map((asset) => (
                    <button
                      key={asset.symbol}
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        handleSelectSymbol(asset);
                      }}
                      className="w-full px-3 py-2.5 text-left hover:bg-muted/50 flex items-center justify-between border-b border-border/50 last:border-b-0"
                    >
                      <div>
                        <span className="font-semibold text-foreground">{asset.symbol}</span>
                        <span className="text-muted-foreground ml-2 text-sm">{asset.name}</span>
                      </div>
                      <span className="text-xs bg-secondary px-2 py-0.5 rounded">
                        {asset.type === "mutual_fund" ? "Fund" : asset.type.toUpperCase()}
                      </span>
                    </button>
                  ))}
                </div>
              )}
              
              {/* No results message */}
              {showSuggestions && symbolQuery && filteredSuggestions.length === 0 && (
                <div className="absolute z-50 w-full mt-1 bg-background border border-border rounded-lg shadow-lg p-3">
                  <p className="text-sm text-muted-foreground">No matching securities found</p>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="condition">Condition</Label>
              <Select value={condition} onValueChange={(v: "above" | "below") => setCondition(v)}>
                <SelectTrigger className="bg-secondary/30 border-border/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="above">Price goes above</SelectItem>
                  <SelectItem value="below">Price goes below</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="price">Target Price ($)</Label>
              <Input
                id="price"
                type="number"
                placeholder="150.00"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="bg-secondary/30 border-border/50"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-secondary/30 border-border/50"
              />
            </div>
          </div>
          
          {/* Selected symbol indicator */}
          {selectedSymbol && (
            <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 bg-primary/10 rounded-full text-sm">
              <span className="font-medium text-primary">{selectedSymbol.symbol}</span>
              <span className="text-muted-foreground">{selectedSymbol.name}</span>
            </div>
          )}
          
          <Button 
            onClick={handleAddAlert} 
            className="mt-5 h-11 px-6 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 transition-all duration-300 hover:-translate-y-0.5"
          >
            <Plus className="w-4 h-4 mr-2" />
            Create Alert
          </Button>
        </div>

        {/* Active Alerts */}
        <div className="glass-card p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">Active Alerts</h2>
          {alerts.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Mail className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No alerts yet. Create one above to get started.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {alerts.map((alert) => (
                <div
                  key={alert.id}
                  className="flex items-center justify-between p-4 rounded-xl bg-secondary/30 border border-border/30"
                >
                  <div className="flex items-center gap-4">
                    <Switch
                      checked={alert.enabled}
                      onCheckedChange={() => handleToggleAlert(alert.id)}
                    />
                    <div>
                      <p className="font-medium text-foreground">
                        {alert.symbol} {alert.condition === "above" ? ">" : "<"} ${alert.price.toFixed(2)}
                      </p>
                      <p className="text-sm text-muted-foreground">{alert.name} • {alert.email}</p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDeleteAlert(alert.id)}
                    className="text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default Alerts;
