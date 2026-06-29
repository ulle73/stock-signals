create table if not exists stock_earnings_calendar_daily (
  date date not null,
  ticker text not null,
  yahoo_ticker text not null,
  company_name text,
  earnings_date date,
  confirmed boolean,
  source text not null default 'yahoo_quote_page',
  source_status text not null check (source_status in ('active', 'missing', 'error')),
  source_url text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (date, ticker)
);

create index if not exists idx_stock_earnings_calendar_daily_ticker_date
  on stock_earnings_calendar_daily (ticker, date desc);

create index if not exists idx_stock_earnings_calendar_daily_earnings_date
  on stock_earnings_calendar_daily (earnings_date, date desc);
