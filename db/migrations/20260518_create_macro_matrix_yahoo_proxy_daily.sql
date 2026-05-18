create table if not exists macro_matrix_yahoo_proxy_daily (
  symbol text not null,
  date date not null,
  open numeric,
  high numeric,
  low numeric,
  close numeric,
  adj_close numeric,
  volume numeric,
  source text not null default 'yahoo',
  source_url text,
  updated_at timestamptz not null default now(),
  primary key (symbol, date)
);

create index if not exists macro_matrix_yahoo_proxy_daily_date_idx
  on macro_matrix_yahoo_proxy_daily (date desc);
