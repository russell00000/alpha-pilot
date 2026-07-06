CREATE OR REPLACE VIEW public.screener_view WITH (security_invoker=on) AS
SELECT u.symbol, u.name, u.exchange, u.asset_type,
  f.sector, f.pe_ratio, f.forward_pe, f.eps, f.dividend_yield, f.revenue_growth,
  f.profit_margins, f.debt_to_equity, f.eps_beat_streak, f.eps_miss_streak,
  f.fcf_growth, f.sector_avg_pe, f.fundamental_score,
  t.price, t.change_pct, t.volume, t.avg_volume, t.market_cap,
  t.rsi_14, t.macd_hist, t.macd_prev_hist, t.sma_50, t.sma_200,
  t.sma_50_prev, t.sma_200_prev, t.volume_score,
  t.fifty_two_week_high, t.fifty_two_week_low, t.technical_score,
  CASE
    WHEN f.fundamental_score IS NULL AND t.technical_score IS NULL THEN NULL
    WHEN f.fundamental_score IS NULL THEN t.technical_score
    WHEN t.technical_score IS NULL THEN f.fundamental_score
    ELSE t.technical_score * 0.4 + f.fundamental_score * 0.6
  END AS combined_score
FROM securities_universe u
LEFT JOIN fundamentals f ON f.symbol = u.symbol
LEFT JOIN technicals t ON t.symbol = u.symbol
WHERE u.is_active = true;