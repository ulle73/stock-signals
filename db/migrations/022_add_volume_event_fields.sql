alter table stock_daily_indicators
  add column if not exists volume_z20 numeric,
  add column if not exists trend_20d_pct numeric,
  add column if not exists range_pct numeric,
  add column if not exists body_pct numeric,
  add column if not exists volume_event text not null default 'normal',
  add column if not exists volume_event_tone text not null default 'neutral';
