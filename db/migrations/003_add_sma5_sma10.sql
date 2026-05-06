alter table stock_daily_indicators
  add column if not exists sma5 numeric,
  add column if not exists sma10 numeric;
