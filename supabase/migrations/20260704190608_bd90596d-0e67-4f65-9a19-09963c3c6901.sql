
CREATE TABLE public.fundamentals (
  symbol TEXT PRIMARY KEY,
  sector TEXT,
  pe_ratio NUMERIC,
  revenue_growth NUMERIC,
  profit_margins NUMERIC,
  debt_to_equity NUMERIC,
  eps_beat_streak INTEGER DEFAULT 0,
  eps_miss_streak INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.fundamentals TO anon, authenticated;
GRANT ALL ON public.fundamentals TO service_role;

ALTER TABLE public.fundamentals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Fundamentals are public read"
  ON public.fundamentals FOR SELECT
  USING (true);

CREATE INDEX idx_fundamentals_sector ON public.fundamentals(sector);
