CREATE TABLE public.sec_company_profile_cache (
  cik TEXT PRIMARY KEY,
  raw_response JSONB NOT NULL,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.sec_company_profile_cache TO service_role;
ALTER TABLE public.sec_company_profile_cache ENABLE ROW LEVEL SECURITY;