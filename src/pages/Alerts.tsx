import { useState } from "react";
import { Bell, Plus, Trash2, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import Header from "@/components/Header";

interface PriceAlert {
  id: string;
  symbol: string;
  condition: "above" | "below";
  price: number;
  email: string;
  enabled: boolean;
}

const Alerts = () => {
  const { toast } = useToast();
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [symbol, setSymbol] = useState("");
  const [condition, setCondition] = useState<"above" | "below">("above");
  const [price, setPrice] = useState("");
  const [email, setEmail] = useState("");

  const handleAddAlert = () => {
    if (!symbol || !price || !email) {
      toast({
        title: "Missing fields",
        description: "Please fill in all fields to create an alert",
        variant: "destructive",
      });
      return;
    }

    const newAlert: PriceAlert = {
      id: crypto.randomUUID(),
      symbol: symbol.toUpperCase(),
      condition,
      price: parseFloat(price),
      email,
      enabled: true,
    };

    setAlerts([...alerts, newAlert]);
    setSymbol("");
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
            <div className="space-y-2">
              <Label htmlFor="symbol">Symbol</Label>
              <Input
                id="symbol"
                placeholder="e.g., AAPL"
                value={symbol}
                onChange={(e) => setSymbol(e.target.value)}
                className="bg-secondary/30 border-border/50"
              />
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
          <Button onClick={handleAddAlert} className="mt-4">
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
                      <p className="text-sm text-muted-foreground">{alert.email}</p>
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