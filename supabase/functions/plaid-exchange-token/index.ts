// Exchanges a Plaid public_token for an access_token and persists the linked brokerage.
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

  const { public_token, institution } = await req.json().catch(() => ({}));
  if (!public_token || typeof public_token !== 'string') {
    return new Response(JSON.stringify({ error: 'invalid_input' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const host = `https://${PLAID_ENV}.plaid.com`;
  const exchange = await fetch(`${host}/item/public_token/exchange`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: PLAID_CLIENT_ID, secret: PLAID_SECRET, public_token }),
  });
  const exchangeBody = await exchange.text();
  if (!exchange.ok) {
    console.error(`Plaid exchange failed [${exchange.status}]: ${exchangeBody}`);
    return new Response(JSON.stringify({ error: 'plaid_error', details: exchangeBody }), {
      status: exchange.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  const { access_token, item_id } = JSON.parse(exchangeBody);

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const { data: brokerage, error: bErr } = await admin
    .from('linked_brokerages')
    .insert({
      user_id: user.id,
      institution_name: institution?.name ?? 'Brokerage',
      institution_id: institution?.institution_id ?? null,
    })
    .select()
    .single();
  if (bErr) throw bErr;

  const { error: pErr } = await admin.from('plaid_items').insert({
    brokerage_id: brokerage.id,
    user_id: user.id,
    access_token,
    item_id,
  });
  if (pErr) throw pErr;

  return new Response(JSON.stringify({ brokerage_id: brokerage.id }), {
    status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});