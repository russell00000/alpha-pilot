import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3";
import { extractFinancials, normalizeTicker, type CompanyFacts } from "./financials.ts";

const USER_AGENT = "Vantage DCF research-project dorioruss@gmail.com";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const BodySchema = z.object({ ticker: z.string().trim().min(1).max(15).regex(/^[A-Za-z0-9]+(?:[.-][A-Za-z0-9]+)*$/) }).strict();
const reply = (data: unknown, status = 200) => new Response(JSON.stringify(data), {
  status, headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" },
});
const fresh = (date: string) => Date.now() - Date.parse(date) < CACHE_TTL_MS;

async function fetchSec(url: string): Promise<unknown> {
  const response = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) throw new Error(`SEC request failed (${response.status}). Please try again later.`);
  return await response.json();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return reply({ error: "Use POST with a ticker." }, 405);
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return reply({ error: "Sign in to look up company financials." }, 401);
  const url = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !anonKey || !serviceKey) return reply({ error: "Financial-data service is not configured." }, 503);
  const auth = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } });
  const { data: claims, error: authError } = await auth.auth.getClaims(authHeader.slice(7));
  if (authError || !claims?.claims?.sub) return reply({ error: "Invalid or expired sign-in." }, 401);
  let body: unknown;
  try { body = await req.json(); } catch { return reply({ error: "Send a valid JSON body." }, 400); }
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) return reply({ error: "Send a valid stock ticker, for example AAPL." }, 400);
  const ticker = normalizeTicker(parsed.data.ticker);
  const db = createClient(url, serviceKey, { auth: { persistSession: false } });
  try {
    const { data: registry, error: registryError } = await db.from("sec_ticker_cache").select("raw_response,fetched_at").eq("id", "company_tickers").maybeSingle();
    if (registryError) throw new Error("Unable to read the SEC ticker cache.");
    let tickerData = registry?.raw_response;
    if (!registry || !fresh(registry.fetched_at)) {
      tickerData = await fetchSec("https://www.sec.gov/files/company_tickers.json");
      if (!tickerData || typeof tickerData !== "object" || !Object.values(tickerData).some((row: any) => typeof row?.ticker === "string" && Number.isInteger(row?.cik_str))) {
        throw new Error("SEC returned an invalid ticker registry.");
      }
      const { error } = await db.from("sec_ticker_cache").upsert({ id: "company_tickers", raw_response: tickerData, fetched_at: new Date().toISOString() });
      if (error) throw new Error("Unable to save the SEC ticker cache.");
    }
    const company = Object.values(tickerData as Record<string, { ticker: string; cik_str: number; title: string }>).find((row) => normalizeTicker(row.ticker) === ticker);
    if (!company) return reply({ error: "Ticker not found in the SEC company registry.", ticker }, 404);
    const cik = String(company.cik_str).padStart(10, "0");
    const { data: cached, error: cacheError } = await db.from("sec_company_facts_cache").select("raw_response,fetched_at").eq("cik", cik).maybeSingle();
    if (cacheError) throw new Error("Unable to read the company financials cache.");
    const cacheHit = Boolean(cached && fresh(cached.fetched_at));
    let raw = cached?.raw_response as CompanyFacts | undefined;
    let fetchedAt = cached?.fetched_at;
    if (!cacheHit) {
      raw = await fetchSec(`https://data.sec.gov/api/xbrl/companyfacts/CIK${cik}.json`) as CompanyFacts;
      if (!raw?.facts || typeof raw.entityName !== "string" || Number(raw.cik) !== company.cik_str) {
        throw new Error("SEC returned invalid company financials.");
      }
      fetchedAt = new Date().toISOString();
      const { error } = await db.from("sec_company_facts_cache").upsert({ cik, raw_response: raw, fetched_at: fetchedAt });
      if (error) throw new Error("Unable to save the company financials cache.");
    }
    if (!raw) throw new Error("No company financials available.");
    return reply({ ticker, cik, company_name: raw.entityName, ...extractFinancials(raw),
      source: "SEC EDGAR companyfacts", fetched_at: fetchedAt,
      cache: { hit: cacheHit, expires_at: new Date(Date.parse(fetchedAt ?? "") + CACHE_TTL_MS).toISOString() },
    });
  } catch (error) {
    return reply({ error: error instanceof Error ? error.message : "Unable to fetch SEC financials." }, 503);
  }
});