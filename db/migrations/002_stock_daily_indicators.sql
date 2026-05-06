create table if not exists stock_daily_indicators (
  id bigserial primary key,
  ticker text not null,
  date date not null,
  indicator_price numeric not null,
  price_basis text not null default 'adj_close_or_close',
  sma20 numeric,
  sma50 numeric,
  sma200 numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (ticker, date)
);

create index if not exists idx_stock_daily_indicators_ticker_date
  on stock_daily_indicators (ticker, date desc);

create index if not exists idx_stock_daily_indicators_date
  on stock_daily_indicators (date desc);
