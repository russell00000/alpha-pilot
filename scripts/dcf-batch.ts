/** Run with bun scripts/dcf-batch.ts; requires DCF_FUNCTIONS_URL and an authenticated session/token in the environment. */
import { writeFileSync } from "node:fs";
const url = process.env.DCF_FUNCTIONS_URL;
const session = process.env.LOVABLE_BROWSER_SUPABASE_SESSION_JSON;
const token = process.env.DCF_ACCESS_TOKEN ?? (session ? JSON.parse(session).access_token : undefined);
if (!url || !token) throw new Error("Set DCF_FUNCTIONS_URL and an authenticated session/token; never put credentials in this script.");
const tickers = ["AAPL", "MSFT", "COST", "JNJ", "XOM", "CAT", "DAL", "RIVN", "CRWD", "PG"];
async function invoke(name: string, body: object) {
  try {
    const response = await fetch(`${url}/${name}`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(45000) });
    return { status: response.status, data: await response.json() };
  } catch { return { status: 503, data: { error: "Data temporarily unavailable, try again (batch request timeout or transport failure)." } }; }
}
const resolved = (value: any, latest: any) => value && latest && value.period?.end === latest.period?.end && value.fiscal_year === latest.fiscal_year ? `Yes — ${value.tag}` : `No${value ? ` — stale ${value.period?.end} (${value.tag})` : ""}`;
async function validate(ticker: string) {
  const extracted = await invoke("get-company-financials", { ticker });
  const f = extracted.data;
  const latest = f.history?.revenue?.[0];
  const interest = f.financials?.interest_expense;
  const currentInterest = interest && latest && interest.period?.end === latest.period?.end && interest.period?.start === latest.period?.start && interest.fiscal_year === latest.fiscal_year;
  const row = { ticker, total_debt: resolved(f.financials?.total_debt, latest), ppe: resolved(f.linked_financials?.ppe, latest), interest: currentInterest ? `Found — ${interest.tag}` : "Not found — estimate required", dcf: "Failed", implied: null as number | null, market: null as number | null, deviation: null as number | null, reason: "", sic: f.company_profile?.sic ?? null, status: extracted.status };
  // Call calculate even when extraction failed, so every ticker exercises both endpoints.
  const preparation = currentInterest ? null : await invoke("calculate-dcf", { action: "prepare", ticker });
  const cost = preparation?.data?.cost_of_debt_input?.suggested_rate;
  const calculated = await invoke("calculate-dcf", { action: "calculate", ticker, beta: 1.0, ...(!currentInterest && Number.isFinite(cost) ? { cost_of_debt: cost } : {}) });
  row.status = calculated.status;
  if (!currentInterest && Number.isFinite(cost)) row.interest = `Estimated — ${(cost * 100).toFixed(2)}%`;
  if (calculated.status === 200 && Number.isFinite(calculated.data.implied_share_price)) {
    row.dcf = "Completed"; row.implied = calculated.data.implied_share_price; row.market = calculated.data.current_price; row.deviation = calculated.data.difference_pct;
  } else {
    row.reason = calculated.data.error ?? f.error ?? "Unknown response";
    if (calculated.data.missing_fields?.length) row.reason += ` Missing: ${calculated.data.missing_fields.join(", ")}.`;
    if (row.reason.includes("Standard DCF is not supported")) row.dcf = "Blocked";
  }
  return row;
}
const started_at = new Date().toISOString();
const rows = [];
for (const ticker of tickers) rows.push(await validate(ticker));
// Extra controls are not part of the ten-ticker results.
const controls = [];
for (const ticker of ["JPM", "O"]) {
  const result = await invoke("calculate-dcf", { action: "calculate", ticker, beta: 1.0 });
  controls.push({ ticker, status: result.status, sic: result.data.company_type?.sic, error: result.data.error });
}
console.log(`Batch started ${started_at}; finished ${new Date().toISOString()}; beta 1.0; unchanged historical defaults; suggested debt-cost estimates explicitly supplied.`);
console.table(rows);
console.table(controls);
if (process.env.DCF_BATCH_OUTPUT) writeFileSync(process.env.DCF_BATCH_OUTPUT, JSON.stringify({ started_at, finished_at: new Date().toISOString(), rows, controls }, null, 2));
if (controls.some(row => row.status !== 422 || !row.error?.includes("Standard DCF is not supported"))) process.exitCode = 1;