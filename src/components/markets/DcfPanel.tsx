import { useEffect, useState } from "react";
import { Calculator, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

interface Result {
  ticker: string; wacc: number; enterprise_value: number; equity_value: number;
  implied_share_price: number; difference_pct: number; current_price: number;
  fiscal_year: number; treasury: { date: string }; assumptions: { beta: number };
}
const money = (value: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(value);
const largeMoney = (value: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 2 }).format(value);

export default function DcfPanel({ ticker }: { ticker: string }) {
  const [beta, setBeta] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { setResult(null); setError(""); }, [ticker]);
  const run = async () => {
    setBusy(true); setError(""); setResult(null);
    try {
      const { data, error: invokeError } = await supabase.functions.invoke("calculate-dcf", { body: { ticker, beta: Number(beta) } });
      if (invokeError) {
        const response = (invokeError as { context?: Response }).context;
        const detail = response ? await response.json().catch(() => null) : null;
        const missing = detail?.missing_fields?.length ? ` Missing: ${detail.missing_fields.join(", ")}.` : "";
        throw new Error((detail?.error || invokeError.message) + missing);
      }
      setResult(data as Result);
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to calculate DCF."); }
    finally { setBusy(false); }
  };
  return (
    <section aria-label="Vantage DCF" className="mt-6 border-t border-border pt-5">
      <div className="flex flex-wrap items-end gap-3">
        <div className="mr-auto">
          <h2 className="font-display text-xl text-foreground">Vantage DCF</h2>
          <p className="mt-1 font-mono text-xs text-muted-foreground">{ticker || "Select a ticker"}</p>
        </div>
        <div className="w-28">
          <Label htmlFor="dcf-beta" className="text-xs text-muted-foreground">Beta</Label>
          <Input id="dcf-beta" type="number" step="0.01" value={beta} onChange={(e) => { setBeta(e.target.value); setResult(null); }} disabled={busy} placeholder="e.g. 1.0" className="mt-1" />
        </div>
        <Button onClick={run} disabled={busy || !ticker || !beta.trim() || !Number.isFinite(Number(beta))}>
          {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Calculator className="mr-2 h-4 w-4" />}Run DCF
        </Button>
      </div>
      {error && <p role="alert" className="mt-4 break-words text-sm text-destructive">{error}</p>}
      {result && <>
        <p className="mt-4 text-xs text-muted-foreground">{result.ticker} · FY{result.fiscal_year} · Beta {result.assumptions.beta} · Treasury yield as of {result.treasury.date}</p>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {[
            ["WACC", `${(result.wacc * 100).toFixed(2)}%`],
            ["Enterprise Value", largeMoney(result.enterprise_value)],
            ["Equity Value", largeMoney(result.equity_value)],
            ["Implied Share Price", money(result.implied_share_price)],
            ["Difference from Market", `${result.difference_pct > 0 ? "+" : ""}${result.difference_pct.toFixed(2)}%`],
          ].map(([label, value]) => <div key={label} className="rounded-md border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="mt-2 break-words font-mono text-xl text-foreground">{value}</p>
          </div>)}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">Market price {money(result.current_price)} · Equity risk premium 4.5% · Terminal growth 2.5%</p>
      </>}
    </section>
  );
}