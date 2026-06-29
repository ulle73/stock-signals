create table if not exists stock_relative_strength_daily (
  ticker text not null,
  date date not null,
  benchmark_ticker text not null default 'SPY',
  rs_21d_vs_spy numeric,
  rs_63d_vs_spy numeric,
  rs_126d_vs_spy numeric,
  rs_rank_21d integer,
  rs_rank_63d integer,
  rs_rank_126d integer,
  rs_percentile_21d numeric,
  rs_percentile_63d numeric,
  rs_percentile_126d numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (ticker, date)
);

create index if not exists idx_stock_relative_strength_daily_date
  on stock_relative_strength_daily (date desc);

create index if not exists idx_stock_relative_strength_daily_ticker_date
  on stock_relative_strength_daily (ticker, date desc);

create index if not exists idx_stock_relative_strength_daily_date_rank_21d
  on stock_relative_strength_daily (date desc, rs_rank_21d asc);
