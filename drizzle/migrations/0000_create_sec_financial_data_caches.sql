CREATE TABLE public.sec_company_facts_cache (
  cik text PRIMARY KEY CHECK (cik ~ '^[0-9]{10}$'),
  raw_response jsonb NOT NULL,
  fetched_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.sec_company_facts_cache TO service_role;
ALTER TABLE public.sec_company_facts_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role manages SEC company cache" ON public.sec_company_facts_cache FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE TABLE public.sec_ticker_cache (
  id text PRIMARY KEY,
  raw_response jsonb NOT NULL,
  fetched_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.sec_ticker_cache TO service_role;
ALTER TABLE public.sec_ticker_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role manages SEC ticker cache" ON public.sec_ticker_cache FOR ALL TO service_role USING (true) WITH CHECK (true);