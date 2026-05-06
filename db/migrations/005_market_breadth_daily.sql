create table if not exists market_breadth_daily (
  id bigserial primary key,
  date date not null unique,
  active_ticker_count integer not null,
  advancers integer not null,
  decliners integer not null,
  unchanged integer not null,
  valid_sma20_count integer not null,
  above_sma20_count integer not null,
  pct_above_sma20 numeric,
  valid_sma50_count integer not null,
  above_sma50_count integer not null,
  pct_above_sma50 numeric,
  valid_sma200_count integer not null,
  above_sma200_count integer not null,
  pct_above_sma200 numeric,
  valid_52w_count integer not null,
  new_highs_52w integer not null,
  new_lows_52w integer not null,
  is_valid_signal_date boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_market_breadth_daily_date
  on market_breadth_daily (date desc);
