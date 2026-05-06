alter table stock_daily_indicators
  add column if not exists daily_return_pct numeric,
  add column if not exists avg_volume20 numeric,
  add column if not exists relative_volume20 numeric,
  add column if not exists pct_from_52w_high numeric,
  add column if not exists pct_from_52w_low numeric;
