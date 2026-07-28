
CREATE TABLE public.linked_brokerages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  institution_name text NOT NULL,
  institution_id text,
  status text NOT NULL DEFAULT 'active',
  last_sync_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.linked_brokerages TO authenticated;
GRANT ALL ON public.linked_brokerages TO service_role;
ALTER TABLE public.linked_brokerages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own linked_brokerages" ON public.linked_brokerages FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE TRIGGER trg_linked_brokerages_upd BEFORE UPDATE ON public.linked_brokerages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.plaid_items (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  brokerage_id uuid NOT NULL REFERENCES public.linked_brokerages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  access_token text NOT NULL,
  item_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.plaid_items TO service_role;
ALTER TABLE public.plaid_items ENABLE ROW LEVEL SECURITY;
-- No policies for authenticated: client cannot read access tokens; only service_role (edge functions) can.

CREATE TABLE public.brokerage_holdings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  brokerage_id uuid NOT NULL REFERENCES public.linked_brokerages(id) ON DELETE CASCADE,
  symbol text NOT NULL,
  name text,
  quantity numeric NOT NULL DEFAULT 0,
  cost_basis numeric,
  market_value numeric,
  currency text DEFAULT 'USD',
  asset_class text,
  sector text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX brokerage_holdings_user_idx ON public.brokerage_holdings(user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.brokerage_holdings TO authenticated;
GRANT ALL ON public.brokerage_holdings TO service_role;
ALTER TABLE public.brokerage_holdings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own brokerage_holdings" ON public.brokerage_holdings FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
