
ALTER TABLE public.fundamentals
  ADD COLUMN IF NOT EXISTS fcf_growth numeric,
  ADD COLUMN IF NOT EXISTS sector_avg_pe numeric;

ALTER TABLE public.technicals
  ADD COLUMN IF NOT EXISTS sma_50_prev numeric,
  ADD COLUMN IF NOT EXISTS sma_200_prev numeric,
  ADD COLUMN IF NOT EXISTS volume_score numeric;

-- Rebuild screener_view to expose the new columns and keep combined_score in sync.
DROP VIEW IF EXISTS public.screener_view;
CREATE VIEW public.screener_view
WITH (security_invoker = on) AS
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
  f.fcf_growth,
  f.sector_avg_pe,
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
  t.sma_50_prev,
  t.sma_200_prev,
  t.volume_score,
  t.fifty_two_week_high,
  t.fifty_two_week_low,
  t.technical_score,
  COALESCE(t.technical_score, 0::numeric) * 0.4
    + COALESCE(f.fundamental_score, 0::numeric) * 0.6 AS combined_score
FROM public.securities_universe u
LEFT JOIN public.fundamentals f ON f.symbol = u.symbol
LEFT JOIN public.technicals t ON t.symbol = u.symbol
WHERE u.is_active = true;

GRANT SELECT ON public.screener_view TO anon, authenticated;
