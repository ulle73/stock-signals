-- Stock Signals — initial data foundation schema
-- Phase 1 only: raw data storage and fetch logging.

create table if not exists sp500_constituents (
  id bigserial primary key,
  ticker text not null unique,
  yahoo_ticker text not null,
  company_name text,
  sector text,
  industry text,
  is_active boolean not null default true,
  source text not null default 'wikipedia',
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_sp500_constituents_active
  on sp500_constituents (is_active);

create index if not exists idx_sp500_constituents_yahoo_ticker
  on sp500_constituents (yahoo_ticker);

create table if not exists stock_daily_prices (
  id bigserial primary key,
  ticker text not null,
  date date not null,
  open numeric,
  high numeric,
  low numeric,
  close numeric,
  adj_close numeric,
  volume bigint,
  source text not null default 'yahoo',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (ticker, date)
);

create index if not exists idx_stock_daily_prices_date
  on stock_daily_prices (date);

create index if not exists idx_stock_daily_prices_ticker_date
  on stock_daily_prices (ticker, date desc);

create table if not exists market_series_daily (
  id bigserial primary key,
  series_id text not null,
  date date not null,
  value numeric,
  source text not null default 'fred',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (series_id, date)
);

create index if not exists idx_market_series_daily_series_date
  on market_series_daily (series_id, date desc);

create table if not exists data_fetch_runs (
  id bigserial primary key,
  job_name text not null,
  status text not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  total_items integer,
  successful_items integer,
  failed_items integer,
  error_message text,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_data_fetch_runs_job_started
  on data_fetch_runs (job_name, started_at desc);
