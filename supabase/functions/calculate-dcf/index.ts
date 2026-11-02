import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3";
import { calculateDcf, companyTypeWarnings, debtCostInput, historicalAssumptions, DcfInputError, type DcfData } from "./math.ts";
import { parseTreasuryYield } from "./treasury.ts";

const Schema = z.object({
  ticker: z.string().trim().min(1).max(15).regex(/^[A-Za-z0-9]+(?:[.-][A-Za-z0-9]+)*$/),
  action: z.enum(["prepare", "calculate"]).default("calculate"),
  beta: z.number().finite().optional(), cost_of_debt: z.number().finite().min(0).max(1).optional(),
  equity_risk_premium: z.number().finite().optional(), terminal_growth_rate: z.number().finite().optional(),
  revenue_growth_rate: z.number().finite().gt(-1).optional(), ebit_margin: z.number().finite().optional(),
  share_count_change: z.number().finite().gt(-1).optional(),
}).strict();
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status,
  headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" } });
let yieldCache: { fetched: number; data: { date: string; rate: number; source: string } } | undefined;
async function treasuryYield() {
  if (yieldCache && Date.now() - yieldCache.fetched < 3600000) return yieldCache.data;
  const currentYear = new Date().getUTCFullYear();
  for (const year of [currentYear, currentYear - 1]) {
    const source = `https://home.treasury.gov/resource-center/data-chart-center/interest-rates/pages/xml?data=daily_treasury_yield_curve&field_tdr_date_value=${year}`;
    const response = await fetch(source, { headers: { "User-Agent": "Vantage DCF research-project dorioruss@gmail.com", Accept: "application/xml" }, signal: AbortSignal.timeout(20000) });
    if (!response.ok) throw new Error(`Treasury yield request failed (${response.status}).`);
    const xml = await response.text();
    try {
      const data = { ...parseTreasuryYield(xml), source };
      yieldCache = { fetched: Date.now(), data }; return data;
    } catch { if (year === currentYear - 1) throw new Error("No Treasury 10-year yield is available."); }
  }
  throw new Error("No Treasury yield is available.");
}
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return reply({ error: "Use POST with ticker and beta." }, 405);
  const authorization = req.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) return reply({ error: "Sign in to run a DCF." }, 401);
  const url = Deno.env.get("SUPABASE_URL"), key = Deno.env.get("SUPABASE_ANON_KEY");
  if (!url || !key) return reply({ error: "DCF service is not configured." }, 503);
  const client = createClient(url, key, { global: { headers: { Authorization: authorization } } });
  const { data: claims, error: authError } = await client.auth.getClaims(authorization.slice(7));
  if (authError || !claims?.claims?.sub) return reply({ error: "Invalid or expired sign-in." }, 401);
  let body: unknown;
  try { body = await req.json(); } catch { return reply({ error: "Invalid JSON body." }, 400); }
  const parsed = Schema.safeParse(body);
  if (!parsed.success) return reply({ error: "Invalid DCF inputs: use a valid ticker, numeric beta and a Cost of Debt between 0 and 100%." }, 400);
  if (parsed.data.action === "calculate" && parsed.data.beta === undefined) return reply({ error: "A numeric beta is required." }, 400);
  const ticker = parsed.data.ticker.toUpperCase().replace(/\./g, "-");
  let caughtCompanyType: unknown = null;
  try {
    const { data: financials, error: financialError } = await client.functions.invoke("get-company-financials", { body: { ticker } });
    if (financialError) {
      const context = (financialError as { context?: Response }).context;
      const detail = context ? await context.json().catch(() => null) : null;
      return reply({ error: detail?.error ?? "Unable to load SEC financials." }, context?.status ?? 503);
    }
    const treasury = await treasuryYield();
    const costOfDebtInput = debtCostInput(financials as DcfData, treasury.rate);
    const sic = financials.company_profile?.sic ?? null;
    const company_type = { sic, sic_description: financials.company_profile?.sic_description ?? null, warnings: companyTypeWarnings(sic) };
    caughtCompanyType = company_type;
    if (parsed.data.action === "prepare") {
      // Beta anchors to the company's own data first, then its peer group —
      // never a flat 1.0. Suggestions prefill the input; the user still confirms.
      let beta_input: { suggested: number | null; source: string | null; peers_used?: number } = { suggested: null, source: null };
      try {
        const ownMetric = await client.functions.invoke("finnhub", { body: { action: "metrics", symbols: [ticker] } });
        const ownBeta = ownMetric.data?.data?.[0]?.beta;
        if (Number.isFinite(ownBeta) && ownBeta > 0) beta_input = { suggested: ownBeta, source: "company" };
        else {
          const peersResponse = await client.functions.invoke("finnhub", { body: { action: "peers", symbols: [ticker] } });
          const peerSymbols: string[] = peersResponse.data?.data?.[0]?.peers ?? [];
          if (peerSymbols.length) {
            const peerMetrics = await client.functions.invoke("finnhub", { body: { action: "metrics", symbols: peerSymbols.slice(0, 8) } });
            const betas = (peerMetrics.data?.data ?? []).map((row: { beta?: number | null }) => row.beta).filter((b: unknown) => Number.isFinite(b) && (b as number) > 0) as number[];
            if (betas.length) beta_input = { suggested: betas.reduce((sum, b) => sum + b, 0) / betas.length, source: "peer_average", peers_used: betas.length };
          }
        }
      } catch (betaError) { console.error("beta suggestion failed:", betaError); }
      // Historical prefills may be unavailable for companies with short or
      // irregular filings; the company-type warning must still reach the UI.
      let historical_assumptions: unknown = null, preparation_note: string | null = null;
      try { historical_assumptions = historicalAssumptions(financials as DcfData); }
      catch (note) { preparation_note = note instanceof Error ? note.message : "Historical assumptions unavailable."; }
      return reply({ ticker, company_name: financials.company_name, treasury, cost_of_debt_input: costOfDebtInput,
        historical_assumptions, preparation_note, beta_input, company_type });
    }
    const beta = parsed.data.beta;
    if (beta === undefined) return reply({ error: "A numeric beta is required.", company_type }, 400);
    if (costOfDebtInput.required && parsed.data.cost_of_debt === undefined) return reply({ error: "Enter the estimated Cost of Debt before running DCF.", missing_fields: ["cost_of_debt"], treasury, cost_of_debt_input: costOfDebtInput, company_type }, 422);
    const quoteResponse = await client.functions.invoke("finnhub", { body: { action: "quotes", symbols: [ticker] } });
    const quote = quoteResponse.data?.data?.find((row: { symbol: string }) => row.symbol === ticker);
    if (quoteResponse.error || !Number.isFinite(quote?.c) || quote.c <= 0) return reply({ error: "No live market price is available from the existing quote source." }, 503);
    const result = calculateDcf(financials as DcfData, { ...parsed.data, beta, risk_free_rate: treasury.rate, current_price: quote.c });
    return reply({ ticker, company_name: financials.company_name, ...result, treasury, cost_of_debt_input: costOfDebtInput, company_type,
      warnings: [...company_type.warnings, ...result.warnings],
      market_price_source: "Finnhub", market_price_as_of: quote.t ? new Date(quote.t * 1000).toISOString() : null,
      financial_inputs: { financials: financials.financials, history: financials.history, linked_financials: financials.linked_financials },
    });
  } catch (error) {
    if (error instanceof DcfInputError) return reply({ error: error.message, missing_fields: error.missing_fields, company_type: caughtCompanyType ?? undefined }, 422);
    return reply({ error: error instanceof Error ? error.message : "DCF unavailable." }, 503);
  }
});