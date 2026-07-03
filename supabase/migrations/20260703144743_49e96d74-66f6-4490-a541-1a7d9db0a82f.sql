
CREATE TABLE public.securities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  symbol TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  sector TEXT,
  exchange TEXT,
  ipo_date DATE,
  source TEXT NOT NULL DEFAULT 'finnhub',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_securities_symbol ON public.securities (symbol);
CREATE INDEX idx_securities_ipo_date ON public.securities (ipo_date DESC);

GRANT SELECT ON public.securities TO anon, authenticated;
GRANT ALL ON public.securities TO service_role;

ALTER TABLE public.securities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read securities"
  ON public.securities FOR SELECT
  USING (true);

CREATE TRIGGER update_securities_updated_at
  BEFORE UPDATE ON public.securities
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
