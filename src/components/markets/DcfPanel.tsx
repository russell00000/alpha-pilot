import { useEffect, useState } from "react";
import { Calculator, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

interface Result {
  ticker: string; wacc: number; enterprise_value: number; equity_value: number;
  implied_share_price: number; difference_pct: number; current_price: number;
  fiscal_year: number; treasury: { date: string }; assumptions: { beta: number; cost_of_debt: number; cost_of_debt_estimated: boolean };
}
interface Preparation {
  ticker: string; treasury: { rate: number; date: string };
  cost_of_debt_input: { required: boolean; estimated: boolean; suggested_rate: number | null; label: string };
}
const money = (value: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(value);
const largeMoney = (value: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 2 }).format(value);

export default function DcfPanel({ ticker }: { ticker: string }) {
  const [beta, setBeta] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [preparation, setPreparation] = useState<Preparation | null>(null);
  const [costOfDebt, setCostOfDebt] = useState("");
  useEffect(() => {
    let active = true;
    setResult(null); setError(""); setPreparation(null); setCostOfDebt("");
    setPreparing(Boolean(ticker));
    if (!ticker) return;
    const timer = window.setTimeout(async () => {
      try {
        const { data, error: invokeError } = await supabase.functions.invoke("calculate-dcf", { body: { action: "prepare", ticker } });
        if (invokeError) {
          const response = (invokeError as { context?: Response }).context;
          const detail = response ? await response.json().catch(() => null) : null;
          throw new Error(detail?.error || invokeError.message);
        }
        if (!active) return;
        const prepared = data as Preparation;
        setPreparation(prepared);
        setCostOfDebt(prepared.cost_of_debt_input.suggested_rate === null ? "" : (prepared.cost_of_debt_input.suggested_rate * 100).toFixed(2));
      } catch (err) { if (active) setError(err instanceof Error ? err.message : "Unable to load DCF inputs."); }
      finally { if (active) setPreparing(false); }
    }, 400);
    return () => { active = false; window.clearTimeout(timer); };
  }, [ticker]);
  const requiresDebtCost = preparation?.cost_of_debt_input.required ?? false;
  const validDebtCost = Boolean(costOfDebt.trim()) && Number.isFinite(Number(costOfDebt)) && Number(costOfDebt) >= 0 && Number(costOfDebt) <= 100;
  const run = async () => {
    setBusy(true); setError(""); setResult(null);
    try {
      const { data, error: invokeError } = await supabase.functions.invoke("calculate-dcf", { body: { ticker, beta: Number(beta), ...(requiresDebtCost ? { cost_of_debt: Number(costOfDebt) / 100 } : {}) } });
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
          <Input id="dcf-beta" type="number" step="0.01" value={beta} onChange={(e) => { setBeta(e.target.value); setResult(null); }} disabled={busy} required placeholder="e.g. 1.0" className="mt-1" />
        </div>
        {requiresDebtCost && <div className="w-40">
          <Label htmlFor="dcf-cost-of-debt" className="text-xs text-muted-foreground">Cost of Debt (%)</Label>
          <Input id="dcf-cost-of-debt" type="number" min="0" max="100" step="0.01" required value={costOfDebt} onChange={(e) => { setCostOfDebt(e.target.value); setResult(null); }} disabled={busy} aria-describedby="dcf-debt-estimate" className="mt-1" />
        </div>}
        <Button onClick={run} disabled={busy || preparing || !preparation || preparation.ticker !== ticker || !ticker || !beta.trim() || !Number.isFinite(Number(beta)) || (requiresDebtCost && !validDebtCost)}>
          {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Calculator className="mr-2 h-4 w-4" />}Run DCF
        </Button>
      </div>
      {preparing && <p role="status" className="mt-3 text-xs text-muted-foreground">Loading annual financial inputs and Treasury yield…</p>}
      {requiresDebtCost && <div id="dcf-debt-estimate" className="mt-3 text-xs text-muted-foreground">
        <p>{preparation?.cost_of_debt_input.label}</p>
        <p className="mt-1">Suggested Cost of Debt: Treasury 10-year yield {((preparation?.treasury.rate ?? 0) * 100).toFixed(2)}% + 1.00% · As of {preparation?.treasury.date}</p>
      </div>}
      {error && <p role="alert" className="mt-4 break-words text-sm text-destructive">{error}</p>}
      {result && <>
        <p className="mt-4 text-xs text-muted-foreground">{result.ticker} · FY{result.fiscal_year} · Beta {result.assumptions.beta} · Treasury yield as of {result.treasury.date}</p>
        {result.assumptions.cost_of_debt_estimated && <p className="mt-2 text-xs text-muted-foreground">Estimated — company does not separately disclose interest expense · Cost of Debt used: {(result.assumptions.cost_of_debt * 100).toFixed(2)}% (user input)</p>}
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