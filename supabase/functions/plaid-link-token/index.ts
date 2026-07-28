// Creates a Plaid Link token. Returns 501 if Plaid keys aren't configured yet
// so the UI can show a helpful "keys needed" state without crashing.
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const PLAID_CLIENT_ID = Deno.env.get('PLAID_CLIENT_ID');
  const PLAID_SECRET = Deno.env.get('PLAID_SECRET');
  const PLAID_ENV = Deno.env.get('PLAID_ENV') ?? 'sandbox';

  if (!PLAID_CLIENT_ID || !PLAID_SECRET) {
    return new Response(
      JSON.stringify({
        error: 'plaid_not_configured',
        message:
          'Plaid credentials are not set. Add PLAID_CLIENT_ID and PLAID_SECRET in Cloud secrets to enable brokerage linking.',
      }),
      { status: 501, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  // Auth
  const authHeader = req.headers.get('Authorization') ?? '';
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const host = `https://${PLAID_ENV}.plaid.com`;
  const resp = await fetch(`${host}/link/token/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: PLAID_CLIENT_ID,
      secret: PLAID_SECRET,
      client_name: 'Vantage Portfolio Solutions',
      language: 'en',
      country_codes: ['US'],
      user: { client_user_id: user.id },
      products: ['investments'],
    }),
  });

  const body = await resp.text();
  if (!resp.ok) {
    console.error(`Plaid link/token/create failed [${resp.status}]: ${body}`);
    return new Response(JSON.stringify({ error: 'plaid_error', status: resp.status, details: body }), {
      status: resp.status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  return new Response(body, {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});