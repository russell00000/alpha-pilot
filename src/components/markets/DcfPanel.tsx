import { useEffect, useState } from "react";
import { AlertTriangle, Calculator, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import DcfExtractionAudit, { type ExtractionAudit } from "./DcfExtractionAudit";

interface CompanyType { sic: number | null; sic_description: string | null; warnings: string[] }
interface Result {
  share_count_basis: { value: number; fiscal_year: number; period: { start: string; end: string }; tag: string; accession_number: string; filed: string };
  ticker: string; wacc: number; enterprise_value: number; equity_value: number;
  implied_share_price: number; difference_pct: number; current_price: number;
  fiscal_year: number; deviation_warning: boolean; market_price_source: string; market_price_as_of: string | null;
  treasury: { date: string; rate: number; refreshed_at: string; cache: { hit: boolean; stale: boolean } }; assumptions: { beta: number; cost_of_debt: number; cost_of_debt_estimated: boolean; revenue_growth_rate: number; ebit_margin: number; share_count_change: number; tax_rate_normalized: boolean };
  projections: { year: number; fiscal_year: number; revenue_growth_rate: number; diluted_shares: number; balance_check: { balanced: boolean; gap: number; assets: number; liabilities: number; equity: number } }[];
  model_notes: string[]; warnings: string[]; company_type: CompanyType;
}
interface Preparation {
  extraction_audit?: ExtractionAudit;
  ticker: string; treasury: { rate: number; date: string; refreshed_at: string; cache: { hit: boolean; stale: boolean } };
  cost_of_debt_input: { required: boolean; estimated: boolean; suggested_rate: number | null; label: string };
  historical_assumptions: { revenue_growth_rate: number; ebit_margin: number; share_count_change: number } | null;
  preparation_note: string | null;
  beta_input: { suggested: number | null; source: string | null; peers_used?: number };
  company_type: CompanyType;
}
const money = (value: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(value);
const largeMoney = (value: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 2 }).format(value);
const pct = (value: number) => `${(value * 100).toFixed(4)}%`;
const differs = (used: number, prefill: number | undefined) => prefill === undefined || Math.abs(used - prefill) > 1e-9;
function assumptionRows(result: Result, preparation: Preparation | null): [string, string, string][] {
  const hist = preparation?.historical_assumptions ?? undefined;
  const betaSource = differs(result.assumptions.beta, preparation?.beta_input.suggested ?? undefined) ? "User override"
    : preparation?.beta_input.source === "company" ? "Company-reported beta"
    : preparation?.beta_input.source === "peer_average" ? `Peer group average (${preparation.beta_input.peers_used ?? 0} peers)` : "User input";
  return [
    ["Base diluted shares (valuation denominator)", result.share_count_basis.value.toLocaleString("en-US"), `SEC FY${result.share_count_basis.fiscal_year} annual weighted average · ${result.share_count_basis.period.start}–${result.share_count_basis.period.end} · ${result.share_count_basis.tag} · 10-K ${result.share_count_basis.accession_number}, filed ${result.share_count_basis.filed}`],
    ["Year-one diluted shares (projected)", result.projections[0]?.diluted_shares.toLocaleString("en-US", { maximumFractionDigits: 0 }) ?? "Unavailable", `FY${result.fiscal_year + 1} forecast = audited base shares × (1 + share count change); not used as the valuation denominator`],
    ["Revenue growth (year 1, fades to terminal)", pct(result.assumptions.revenue_growth_rate), differs(result.assumptions.revenue_growth_rate, hist?.revenue_growth_rate) ? "User override" : `Audited FY${result.fiscal_year} year-over-year growth`],
    ["EBIT margin (held flat)", pct(result.assumptions.ebit_margin), differs(result.assumptions.ebit_margin, hist?.ebit_margin) ? "User override" : "Four-year audited average"],
    ["Share count change (per year)", pct(result.assumptions.share_count_change), differs(result.assumptions.share_count_change, hist?.share_count_change) ? "User override" : "Trailing three-year audited average"],
    ["Beta", result.assumptions.beta.toFixed(2), betaSource],
    ["Cost of debt", pct(result.assumptions.cost_of_debt), result.assumptions.cost_of_debt_estimated ? "Estimated — company does not separately disclose interest expense (user input)" : "SEC interest expense / total debt"],
    ["Tax rate", result.assumptions.tax_rate_normalized ? "21.00%" : "Effective", result.assumptions.tax_rate_normalized ? "Normalized statutory rate — company reported a loss" : "Audited effective rate"],
    ["Risk-free rate", pct(result.treasury.rate), `Treasury 10-year · observation ${result.treasury.date} · cache refreshed ${result.treasury.refreshed_at}${result.treasury.cache.stale ? " · Stale: refresh temporarily unavailable" : " · 24-hour cache"}`],
    ["Equity risk premium", "4.50%", "Default"],
    ["Terminal growth", "2.50%", "Default"],
  ];
}

export default function DcfPanel({ ticker }: { ticker: string }) {
  const [beta, setBeta] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [preparation, setPreparation] = useState<Preparation | null>(null);
  const [costOfDebt, setCostOfDebt] = useState("");
  const [growth, setGrowth] = useState("");
  const [margin, setMargin] = useState("");
  const [shareChange, setShareChange] = useState("");
  useEffect(() => {
    let active = true;
    setResult(null); setError(""); setPreparation(null); setCostOfDebt(""); setGrowth(""); setMargin(""); setShareChange(""); setBeta("");
    setPreparing(Boolean(ticker));
    if (!ticker) return;
    const timer = window.setTimeout(async () => {
      try {
        const { data, error: invokeError } = await supabase.functions.invoke("calculate-dcf", { timeout: 15000, body: { action: "prepare", ticker } });
        if (invokeError) {
          const response = (invokeError as { context?: Response }).context;
          const detail = response instanceof Response ? await response.json().catch(() => null) : null;
          throw new Error(detail?.error || "Data temporarily unavailable, try again.");
        }
        if (!active) return;
        const prepared = data as Preparation;
        setPreparation(prepared);
        setCostOfDebt(prepared.cost_of_debt_input.suggested_rate === null ? "" : (prepared.cost_of_debt_input.suggested_rate * 100).toFixed(2));
        if (prepared.historical_assumptions) {
          setGrowth((prepared.historical_assumptions.revenue_growth_rate * 100).toFixed(4));
          setMargin((prepared.historical_assumptions.ebit_margin * 100).toFixed(4));
          setShareChange((prepared.historical_assumptions.share_count_change * 100).toFixed(4));
        }
        if (prepared.beta_input.suggested !== null) setBeta(prepared.beta_input.suggested.toFixed(2));
      } catch (err) { if (active) setError(err instanceof Error ? err.message : "Unable to load DCF inputs."); }
      finally { if (active) setPreparing(false); }
    }, 400);
    return () => { active = false; window.clearTimeout(timer); };
  }, [ticker]);
  const requiresDebtCost = preparation?.cost_of_debt_input.required ?? false;
  const validDebtCost = Boolean(costOfDebt.trim()) && Number.isFinite(Number(costOfDebt)) && Number(costOfDebt) >= 0 && Number(costOfDebt) <= 100;
  const validProjectionInputs = Boolean(growth.trim()) && Boolean(margin.trim()) && Boolean(shareChange.trim()) && Number.isFinite(Number(growth)) && Number(growth) > -100 && Number.isFinite(Number(margin)) && Number.isFinite(Number(shareChange)) && Number(shareChange) > -100;
  // An unchanged displayed prefill must use the original full-precision rate.
  const projectionRate = (text: string, historical: number) => text === (historical * 100).toFixed(4) ? historical : Number(text) / 100;
  const run = async () => {
    setBusy(true); setError(""); setResult(null);
    try {
      if (!preparation?.historical_assumptions || !validProjectionInputs) throw new Error("Enter valid revenue growth, EBIT margin and share count assumptions.");
      const { data, error: invokeError } = await supabase.functions.invoke("calculate-dcf", { timeout: 15000, body: { ticker, beta: Number(beta),
        revenue_growth_rate: projectionRate(growth, preparation.historical_assumptions.revenue_growth_rate),
        ebit_margin: projectionRate(margin, preparation.historical_assumptions.ebit_margin),
        share_count_change: projectionRate(shareChange, preparation.historical_assumptions.share_count_change),
        ...(requiresDebtCost ? { cost_of_debt: Number(costOfDebt) / 100 } : {}) } });
      if (invokeError) {
        const response = (invokeError as { context?: Response }).context;
        const detail = response instanceof Response ? await response.json().catch(() => null) : null;
        const missing = detail?.missing_fields?.length ? ` Missing: ${detail.missing_fields.join(", ")}.` : "";
        throw new Error((detail?.error || "Data temporarily unavailable, try again.") + missing);
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
          {preparation?.beta_input.suggested !== null && preparation?.beta_input.suggested !== undefined && <p className="mt-1 text-[10px] text-muted-foreground">{preparation.beta_input.source === "company" ? "Company-reported beta" : `Peer average (${preparation.beta_input.peers_used ?? 0} peers)`} — editable</p>}
        </div>
        <div className="w-48">
          <Label htmlFor="dcf-growth" className="text-xs text-muted-foreground">Revenue Growth Rate (%)</Label>
          <Input id="dcf-growth" type="number" step="0.01" required value={growth} onChange={(e) => { setGrowth(e.target.value); setResult(null); }} disabled={busy || preparing} className="mt-1" />
        </div>
        <div className="w-36">
          <Label htmlFor="dcf-margin" className="text-xs text-muted-foreground">EBIT Margin (%)</Label>
          <Input id="dcf-margin" type="number" step="0.01" required value={margin} onChange={(e) => { setMargin(e.target.value); setResult(null); }} disabled={busy || preparing} className="mt-1" />
        </div>
        <div className="w-44">
          <Label htmlFor="dcf-share-change" className="text-xs text-muted-foreground">Share Count Change (%/yr)</Label>
          <Input id="dcf-share-change" type="number" step="0.01" required value={shareChange} onChange={(e) => { setShareChange(e.target.value); setResult(null); }} disabled={busy || preparing} className="mt-1" />
        </div>
        {requiresDebtCost && <div className="w-40">
          <Label htmlFor="dcf-cost-of-debt" className="text-xs text-muted-foreground">Cost of Debt (%)</Label>
          <Input id="dcf-cost-of-debt" type="number" min="0" max="100" step="0.01" required value={costOfDebt} onChange={(e) => { setCostOfDebt(e.target.value); setResult(null); }} disabled={busy} aria-describedby="dcf-debt-estimate" className="mt-1" />
        </div>}
        <Button onClick={run} disabled={busy || preparing || !preparation || preparation.ticker !== ticker || !ticker || !beta.trim() || !Number.isFinite(Number(beta)) || !validProjectionInputs || (requiresDebtCost && !validDebtCost)}>
          {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Calculator className="mr-2 h-4 w-4" />}Run DCF
        </Button>
      </div>
      {preparation && <p className="mt-3 text-xs text-muted-foreground">Treasury 10-year: {pct(preparation.treasury.rate)} · observation {preparation.treasury.date} · cache refreshed {preparation.treasury.refreshed_at}{preparation.treasury.cache.stale ? " · Stale: refresh temporarily unavailable" : " · 24-hour cache"}</p>}
      {preparing && <p role="status" className="mt-3 text-xs text-muted-foreground">Loading annual financial inputs and Treasury yield…</p>}
      {preparation?.company_type.warnings.map((warning) => <div key={warning} role="alert" className="mt-3 rounded-md border border-amber-500/50 bg-amber-500/10 p-3 text-xs text-foreground"><span className="font-medium">{preparation.company_type.sic_description ?? "Company type"} notice:</span> {warning}</div>)}
      {preparation?.preparation_note && <p role="alert" className="mt-3 text-xs text-destructive">{preparation.preparation_note}</p>}
      {requiresDebtCost && <div id="dcf-debt-estimate" className="mt-3 text-xs text-muted-foreground">
        <p>{preparation?.cost_of_debt_input.label}</p>
        <p className="mt-1">Suggested Cost of Debt: Treasury 10-year yield {((preparation?.treasury.rate ?? 0) * 100).toFixed(2)}% + 1.00% · As of {preparation?.treasury.date}</p>
      </div>}
      {error && <p role="alert" className="mt-4 break-words text-sm text-destructive">{error}</p>}
      {preparation?.extraction_audit && <DcfExtractionAudit audit={preparation.extraction_audit} />}
      {result && <>
        <p className="mt-4 text-xs text-muted-foreground">{result.ticker} · FY{result.fiscal_year} · Beta {result.assumptions.beta} · Treasury yield as of {result.treasury.date}</p>
        {result.assumptions.cost_of_debt_estimated && <p className="mt-2 text-xs text-muted-foreground">Estimated — company does not separately disclose interest expense · Cost of Debt used: {(result.assumptions.cost_of_debt * 100).toFixed(2)}% (user input)</p>}
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[
            ["WACC", `${(result.wacc * 100).toFixed(2)}%`],
            ["Enterprise Value", largeMoney(result.enterprise_value)],
            ["Equity Value", largeMoney(result.equity_value)],
            ["Implied Share Price", money(result.implied_share_price)],
            ["Current Market Price", money(result.current_price)],
            ["Difference from Market", `${result.difference_pct > 0 ? "+" : ""}${result.difference_pct.toFixed(2)}%`],
          ].map(([label, value]) => <div key={label} className="rounded-md border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="mt-2 break-words font-mono text-xl text-foreground">{value}</p>
          </div>)}
        </div>
        {result.deviation_warning && <div role="alert" className="mt-3 rounded-md border border-destructive/50 bg-destructive/10 p-4">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground"><AlertTriangle className="h-4 w-4 shrink-0 text-destructive" />&gt;40% deviation from current price</div>
          <p className="mt-2 text-sm text-muted-foreground">The implied share price of {money(result.implied_share_price)} is {Math.abs(result.difference_pct).toFixed(2)}% {result.difference_pct < 0 ? "below" : "above"} the current market price of {money(result.current_price)}. This valuation is highly sensitive to growth, margins and discount-rate assumptions.</p>
        </div>}
        {result.warnings.length > 0 && <div className="mt-3 space-y-2">{result.warnings.map((warning) => <div key={warning} role="alert" className="rounded-md border border-amber-500/50 bg-amber-500/10 p-3 text-xs text-foreground">{warning}</div>)}</div>}
        <h3 className="mt-5 text-sm font-medium text-foreground">Assumptions &amp; Sources</h3>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-muted-foreground"><tr>{["Assumption", "Value", "Source"].map((heading) => <th key={heading} className="whitespace-nowrap border-b border-border px-3 py-2 font-medium">{heading}</th>)}</tr></thead>
            <tbody>{assumptionRows(result, preparation).map(([label, value, source]) => <tr key={label}>
              <td className="whitespace-nowrap border-b border-border px-3 py-2">{label}</td>
              <td className="whitespace-nowrap border-b border-border px-3 py-2 font-mono">{value}</td>
              <td className="border-b border-border px-3 py-2 text-muted-foreground">{source}</td>
            </tr>)}</tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">Market price source: {result.market_price_source}{result.market_price_as_of ? ` · As of ${new Date(result.market_price_as_of).toLocaleString()}` : ""}</p>
        <h3 className="mt-5 text-sm font-medium text-foreground">Projected balance checks</h3>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-muted-foreground"><tr>{["Fiscal year", "Assets", "Liabilities + Equity", "Difference", "Check"].map((heading) => <th key={heading} className="whitespace-nowrap border-b border-border px-3 py-2 font-medium">{heading}</th>)}</tr></thead>
            <tbody>{result.projections.map((row) => <tr key={row.year}>
              <td className="whitespace-nowrap border-b border-border px-3 py-2">FY{row.fiscal_year}</td>
              <td className="whitespace-nowrap border-b border-border px-3 py-2 font-mono">{money(row.balance_check.assets)}</td>
              <td className="whitespace-nowrap border-b border-border px-3 py-2 font-mono">{money(row.balance_check.liabilities + row.balance_check.equity)}</td>
              <td className="whitespace-nowrap border-b border-border px-3 py-2 font-mono">{money(row.balance_check.gap)}</td>
              <td className="whitespace-nowrap border-b border-border px-3 py-2 text-success">{row.balance_check.balanced ? "Balanced" : "Error"}</td>
            </tr>)}</tbody>
          </table>
        </div>
        <div className="mt-3 space-y-1 text-xs text-muted-foreground">{result.model_notes.map((note) => <p key={note}>{note}</p>)}</div>
      </>}
    </section>
  );
}