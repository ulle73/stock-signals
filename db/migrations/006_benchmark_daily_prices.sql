create table if not exists benchmark_daily_prices (
  ticker text not null,
  date date not null,
  open numeric not null,
  high numeric not null,
  low numeric not null,
  close numeric not null,
  adj_close numeric not null,
  volume bigint not null,
  source text not null default 'yahoo',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (ticker, date)
);

create index if not exists idx_benchmark_daily_prices_date
  on benchmark_daily_prices (date desc);
