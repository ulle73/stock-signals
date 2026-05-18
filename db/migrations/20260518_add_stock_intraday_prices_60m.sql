create table if not exists stock_intraday_prices_60m (
  id bigserial primary key,
  ticker text not null,
  candle_at timestamptz not null,
  session_date date not null,
  open numeric,
  high numeric,
  low numeric,
  close numeric,
  adj_close numeric,
  volume bigint,
  source text not null default 'yahoo_60m',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (ticker, candle_at)
);

create index if not exists idx_stock_intraday_prices_60m_ticker_candle
  on stock_intraday_prices_60m (ticker, candle_at desc);

create index if not exists idx_stock_intraday_prices_60m_session_date
  on stock_intraday_prices_60m (session_date desc);
