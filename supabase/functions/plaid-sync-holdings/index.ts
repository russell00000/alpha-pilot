// Pulls investment holdings from Plaid for every linked brokerage of the signed-in user
// and upserts them into brokerage_holdings.
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const PLAID_CLIENT_ID = Deno.env.get('PLAID_CLIENT_ID');
  const PLAID_SECRET = Deno.env.get('PLAID_SECRET');
  const PLAID_ENV = Deno.env.get('PLAID_ENV') ?? 'sandbox';
  if (!PLAID_CLIENT_ID || !PLAID_SECRET) {
    return new Response(JSON.stringify({ error: 'plaid_not_configured' }), {
      status: 501, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const authHeader = req.headers.get('Authorization') ?? '';
  const userClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );
  const { data: items, error: iErr } = await admin
    .from('plaid_items')
    .select('brokerage_id, access_token')
    .eq('user_id', user.id);
  if (iErr) throw iErr;

  const host = `https://${PLAID_ENV}.plaid.com`;
  let totalHoldings = 0;

  for (const it of items ?? []) {
    const resp = await fetch(`${host}/investments/holdings/get`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: PLAID_CLIENT_ID,
        secret: PLAID_SECRET,
        access_token: it.access_token,
      }),
    });
    if (!resp.ok) {
      console.error(`holdings/get failed [${resp.status}]: ${await resp.text()}`);
      continue;
    }
    const data = await resp.json();
    const securities = new Map<string, any>();
    for (const s of data.securities ?? []) securities.set(s.security_id, s);

    // Wipe old holdings for this brokerage then insert fresh
    await admin.from('brokerage_holdings').delete().eq('brokerage_id', it.brokerage_id);

    const rows = (data.holdings ?? []).map((h: any) => {
      const sec = securities.get(h.security_id) ?? {};
      return {
        user_id: user.id,
        brokerage_id: it.brokerage_id,
        symbol: sec.ticker_symbol ?? sec.name ?? 'UNKNOWN',
        name: sec.name ?? null,
        quantity: Number(h.quantity ?? 0),
        cost_basis: h.cost_basis != null ? Number(h.cost_basis) : null,
        market_value: h.institution_value != null ? Number(h.institution_value) : null,
        currency: h.iso_currency_code ?? 'USD',
        asset_class: sec.type ?? null,
        sector: null,
      };
    });
    if (rows.length) {
      const { error: hErr } = await admin.from('brokerage_holdings').insert(rows);
      if (hErr) throw hErr;
      totalHoldings += rows.length;
    }

    await admin
      .from('linked_brokerages')
      .update({ last_sync_at: new Date().toISOString() })
      .eq('id', it.brokerage_id);
  }

  return new Response(JSON.stringify({ holdings: totalHoldings }), {
    status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});