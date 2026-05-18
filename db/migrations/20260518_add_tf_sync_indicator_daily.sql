create table if not exists tf_sync_indicator_daily (
  id bigserial primary key,
  ticker text not null,
  date date not null,
  intraday_60m_candle_at timestamptz,
  tf_sync_weekly_open numeric,
  tf_sync_weekly_close numeric,
  tf_sync_daily_green boolean not null default false,
  tf_sync_daily_red boolean not null default false,
  tf_sync_weekly_green boolean not null default false,
  tf_sync_weekly_red boolean not null default false,
  tf_sync_intraday_green boolean not null default false,
  tf_sync_intraday_red boolean not null default false,
  tf_sync_buy_condition boolean not null default false,
  tf_sync_sell_condition boolean not null default false,
  tf_sync_buy_signal boolean not null default false,
  tf_sync_sell_signal boolean not null default false,
  tf_sync_buy_active boolean not null default false,
  tf_sync_sell_active boolean not null default false,
  tf_sync_signal text not null default 'none',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (ticker, date)
);

create index if not exists idx_tf_sync_indicator_daily_ticker_date
  on tf_sync_indicator_daily (ticker, date desc);

create index if not exists idx_tf_sync_indicator_daily_date
  on tf_sync_indicator_daily (date desc);
