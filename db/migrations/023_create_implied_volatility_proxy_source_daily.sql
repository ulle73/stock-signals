create table if not exists implied_volatility_proxy_source_daily (
  date date not null,
  asset_key text not null,
  asset_name text not null,
  asset_type text,
  source_symbol text not null,
  implied_volatility_symbol text not null,
  close numeric,
  adj_close numeric,
  volume numeric,
  implied_volatility numeric,
  source_status text not null default 'active',
  price_source text not null default 'yahoo',
  implied_volatility_source text not null default 'yahoo_cboe_proxy',
  price_source_url text,
  implied_volatility_source_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (date, asset_key)
);

create index if not exists implied_volatility_proxy_source_daily_asset_date_idx
  on implied_volatility_proxy_source_daily (asset_key, date);
