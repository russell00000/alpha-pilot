import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

interface TradeDialogProps {
  open: boolean;
  onClose: () => void;
  mode: "buy" | "sell";
  symbol: string;
  name: string;
  maxShares?: number;
  cashBalance: number;
  onExecute: (symbol: string, name: string, quantity: number, price: number) => Promise<void>;
}

export default function TradeDialog({
  open, onClose, mode, symbol, name, maxShares, cashBalance, onExecute,
}: TradeDialogProps) {
  const [quantity, setQuantity] = useState("1");
  const [price, setPrice] = useState<number | null>(null);
  const [loadingPrice, setLoadingPrice] = useState(false);
  const [executing, setExecuting] = useState(false);

  useEffect(() => {
    if (!open || !symbol) return;
    setQuantity("1");
    setPrice(null);
    setLoadingPrice(true);

    const fetchPrice = async () => {
      try {
        const { data } = await supabase.functions.invoke("market-data", {
          body: { symbols: [symbol] },
        });
        // The edge function returns { data: MarketData[] }
        const results = data?.data;
        if (Array.isArray(results) && results.length > 0) {
          setPrice(parseFloat(results[0].price));
        }
      } catch {
        // fallback
      } finally {
        setLoadingPrice(false);
      }
    };
    fetchPrice();
  }, [open, symbol]);

  const qty = parseFloat(quantity) || 0;
  const totalCost = qty * (price || 0);
  const maxBuyable = price ? Math.floor((cashBalance / price) * 10000) / 10000 : 0;

  const handleExecute = async () => {
    if (!price || qty <= 0) return;
    setExecuting(true);
    try {
      await onExecute(symbol, name, qty, price);
      onClose();
    } catch (err: any) {
      // error handled in hook
    } finally {
      setExecuting(false);
    }
  };

  const isBuy = mode === "buy";
  const isValid = qty > 0 && price && (isBuy ? totalCost <= cashBalance : qty <= (maxShares || 0));

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className={isBuy ? "text-green-500" : "text-red-500"}>
            {isBuy ? "Buy" : "Sell"} {symbol}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div>
            <p className="text-sm text-muted-foreground">{name}</p>
            <p className="text-lg font-semibold text-foreground mt-1">
              {loadingPrice ? "Loading price..." : price ? `$${price.toFixed(2)}` : "Price unavailable"}
            </p>
          </div>

          <div className="space-y-2">
            <Label>Quantity</Label>
            <Input
              type="number"
              min="0.0001"
              step="any"
              max={isBuy ? maxBuyable : maxShares}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              {isBuy
                ? `Available cash: $${cashBalance.toFixed(2)} · Max: ${maxBuyable}`
                : `Owned: ${maxShares || 0}`}
            </p>
            <p className="text-xs text-muted-foreground/60">Fractional shares supported</p>
          </div>

          {price && qty > 0 && (
            <div className="rounded-lg border border-border/60 bg-muted/30 p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Price per share</span>
                <span className="text-foreground">${price.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Quantity</span>
                <span className="text-foreground">{qty}</span>
              </div>
              <div className="border-t border-border/60 pt-2 flex justify-between font-semibold">
                <span className="text-foreground">{isBuy ? "Total Cost" : "Total Proceeds"}</span>
                <span className={isBuy ? "text-red-400" : "text-green-400"}>${totalCost.toFixed(2)}</span>
              </div>
            </div>
          )}

          <Button
            className="w-full"
            variant={isBuy ? "default" : "destructive"}
            disabled={!isValid || executing || loadingPrice}
            onClick={handleExecute}
          >
            {executing ? "Processing..." : `${isBuy ? "Buy" : "Sell"} ${qty} Share${qty !== 1 ? "s" : ""}`}
          </Button>

          <p className="text-xs text-center text-muted-foreground">
            This is a simulated trade. No real money is involved.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
