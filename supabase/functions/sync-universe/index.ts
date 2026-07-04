// sync-universe: pulls the full US-listed symbol master from NASDAQ Trader
// (public, no auth). Runs weekly. Filters test issues, warrants, rights,
// units, preferreds — anything the Screener shouldn't score.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type UniverseRow = {
  symbol: string;
  name: string;
  exchange: string;
  asset_type: string;
  is_active: boolean;
};

// Reject symbols that look like non-common-equity instruments.
const BAD_SUFFIX = /[.\-](WS|WSA|WSB|WT|W|U|R|P|PA|PB|PC|PD|PE|PF|PG|PH|PI|PJ|PK|PL|PM|PN|PO|PP|PQ|PR|PS|PT|PU|PV|PW|PX|PY|PZ)$/;
const NAME_JUNK = /\b(warrant|right|unit|preferred|depositary|notes?|debentures?|trust preferred|when[- ]issued)\b/i;

function shouldKeep(symbol: string, name: string, etf: boolean): boolean {
  if (!symbol) return false;
  if (symbol.length > 6 && !etf) return false; // long tickers are usually preferred/warrant classes
  if (!/^[A-Z0-9.\-]+$/.test(symbol)) return false;
  if (BAD_SUFFIX.test(symbol)) return false;
  if (NAME_JUNK.test(name)) return false;
  return true;
}

async function fetchNasdaqListed(): Promise<UniverseRow[]> {
  const r = await fetch("https://www.nasdaqtrader.com/dynamic/SymDir/nasdaqlisted.txt");
  if (!r.ok) throw new Error(`nasdaqlisted fetch ${r.status}`);
  const text = await r.text();
  const lines = text.split(/\r?\n/).filter((l) => l && !l.startsWith("File Creation Time"));
  const [header, ...rest] = lines;
  const cols = header.split("|");
  const iSym = cols.indexOf("Symbol");
  const iName = cols.indexOf("Security Name");
  const iEtf = cols.indexOf("ETF");
  const iTest = cols.indexOf("Test Issue");
  const out: UniverseRow[] = [];
  for (const line of rest) {
    const parts = line.split("|");
    if (parts.length < 4) continue;
    const symbol = (parts[iSym] || "").trim().toUpperCase();
    const name = (parts[iName] || "").trim();
    const etf = (parts[iEtf] || "").trim() === "Y";
    const test = (parts[iTest] || "").trim() === "Y";
    if (test) continue;
    if (!shouldKeep(symbol, name, etf)) continue;
    out.push({ symbol, name, exchange: "NASDAQ", asset_type: etf ? "etf" : "stock", is_active: true });
  }
  return out;
}

async function fetchOtherListed(): Promise<UniverseRow[]> {
  const r = await fetch("https://www.nasdaqtrader.com/dynamic/SymDir/otherlisted.txt");
  if (!r.ok) throw new Error(`otherlisted fetch ${r.status}`);
  const text = await r.text();
  const lines = text.split(/\r?\n/).filter((l) => l && !l.startsWith("File Creation Time"));
  const [header, ...rest] = lines;
  const cols = header.split("|");
  const iSym = cols.indexOf("ACT Symbol");
  const iName = cols.indexOf("Security Name");
  const iExch = cols.indexOf("Exchange");
  const iEtf = cols.indexOf("ETF");
  const iTest = cols.indexOf("Test Issue");
  const out: UniverseRow[] = [];
  const exchMap: Record<string, string> = { A: "AMEX", N: "NYSE", P: "NYSE ARCA", Z: "BATS", V: "IEX" };
  for (const line of rest) {
    const parts = line.split("|");
    if (parts.length < 4) continue;
    const symbol = (parts[iSym] || "").trim().toUpperCase();
    const name = (parts[iName] || "").trim();
    const etf = (parts[iEtf] || "").trim() === "Y";
    const test = (parts[iTest] || "").trim() === "Y";
    const exch = exchMap[(parts[iExch] || "").trim()] ?? "OTHER";
    if (test) continue;
    if (!shouldKeep(symbol, name, etf)) continue;
    out.push({ symbol, name, exchange: exch, asset_type: etf ? "etf" : "stock", is_active: true });
  }
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const [a, b] = await Promise.all([fetchNasdaqListed(), fetchOtherListed()]);
    // Merge, prefer first occurrence.
    const seen = new Set<string>();
    const rows: UniverseRow[] = [];
    for (const r of [...a, ...b]) {
      if (seen.has(r.symbol)) continue;
      seen.add(r.symbol);
      rows.push(r);
    }

    // Chunked upserts.
    const CHUNK = 500;
    let upserted = 0;
    for (let i = 0; i < rows.length; i += CHUNK) {
      const slice = rows.slice(i, i + CHUNK).map((r) => ({ ...r, updated_at: new Date().toISOString() }));
      const { error } = await supabase
        .from("securities_universe")
        .upsert(slice, { onConflict: "symbol" });
      if (error) { console.error("upsert error", error); continue; }
      upserted += slice.length;
    }

    // Deactivate anything not in the current pull (older than 8 days).
    const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();
    await supabase
      .from("securities_universe")
      .update({ is_active: false })
      .lt("updated_at", eightDaysAgo);

    return new Response(
      JSON.stringify({ success: true, upserted, total_rows: rows.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("sync-universe error", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});