CREATE TABLE public.treasury_yield_cache (
  id text PRIMARY KEY,
  rate double precision NOT NULL,
  observation_date date NOT NULL,
  source text NOT NULL,
  refreshed_at timestamptz NOT NULL,
  CONSTRAINT treasury_yield_cache_rate_valid CHECK (rate >= 0 AND rate <= 1)
);
GRANT ALL ON public.treasury_yield_cache TO service_role;
ALTER TABLE public.treasury_yield_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role manages Treasury yield cache" ON public.treasury_yield_cache FOR ALL TO service_role USING (true) WITH CHECK (true);