
-- 1) securities_universe: full US-listed symbol master
CREATE TABLE IF NOT EXISTS public.securities_universe (
  symbol      text PRIMARY KEY,
  name        text NOT NULL,
  exchange    text,
  asset_type  text NOT NULL DEFAULT 'stock',
  is_active   boolean NOT NULL DEFAULT true,
  updated_at  timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.securities_universe TO anon, authenticated;
GRANT ALL ON public.securities_universe TO service_role;
ALTER TABLE public.securities_universe ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read universe" ON public.securities_universe FOR SELECT TO anon, authenticated USING (true);

-- 2) technicals: nightly-computed price + indicators
CREATE TABLE IF NOT EXISTS public.technicals (
  symbol          text PRIMARY KEY,
  price           numeric,
  change_pct      numeric,
  volume          bigint,
  avg_volume      bigint,
  market_cap      numeric,
  rsi_14          numeric,
  macd_hist       numeric,
  macd_prev_hist  numeric,
  sma_50          numeric,
  sma_200         numeric,
  fifty_two_week_high numeric,
  fifty_two_week_low  numeric,
  technical_score numeric,
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS technicals_market_cap_idx ON public.technicals (market_cap DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS technicals_change_pct_idx ON public.technicals (change_pct DESC NULLS LAST);
GRANT SELECT ON public.technicals TO anon, authenticated;
GRANT ALL ON public.technicals TO service_role;
ALTER TABLE public.technicals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read technicals" ON public.technicals FOR SELECT TO anon, authenticated USING (true);

-- 3) fundamentals: add precomputed score + eps for display
ALTER TABLE public.fundamentals
  ADD COLUMN IF NOT EXISTS fundamental_score numeric,
  ADD COLUMN IF NOT EXISTS eps numeric,
  ADD COLUMN IF NOT EXISTS forward_pe numeric,
  ADD COLUMN IF NOT EXISTS dividend_yield numeric;

-- 4) screener_view: single joined read surface for the Screener
CREATE OR REPLACE VIEW public.screener_view AS
SELECT
  u.symbol,
  u.name,
  u.exchange,
  u.asset_type,
  f.sector,
  f.pe_ratio,
  f.forward_pe,
  f.eps,
  f.dividend_yield,
  f.revenue_growth,
  f.profit_margins,
  f.debt_to_equity,
  f.eps_beat_streak,
  f.eps_miss_streak,
  f.fundamental_score,
  t.price,
  t.change_pct,
  t.volume,
  t.avg_volume,
  t.market_cap,
  t.rsi_14,
  t.macd_hist,
  t.macd_prev_hist,
  t.sma_50,
  t.sma_200,
  t.fifty_two_week_high,
  t.fifty_two_week_low,
  t.technical_score,
  -- Combined score for server-side sorting: fund weighted 60%, tech 40%.
  -- Nulls treated as 0 so partially-covered names still sort sensibly.
  (COALESCE(t.technical_score, 0) * 0.4 + COALESCE(f.fundamental_score, 0) * 0.6) AS combined_score
FROM public.securities_universe u
LEFT JOIN public.fundamentals f ON f.symbol = u.symbol
LEFT JOIN public.technicals t ON t.symbol = u.symbol
WHERE u.is_active = true;

GRANT SELECT ON public.screener_view TO anon, authenticated;
