create table if not exists gex_dex_source_snapshots (
  id bigserial primary key,
  ticker text not null,
  source_timestamp timestamptz not null,
  source_url text not null,
  source_status text not null default 'active' check (source_status in ('active', 'stale')),
  data_quality text,
  from_cache boolean not null default false,
  stale boolean not null default false,
  multi_expiry boolean not null default false,
  spot_price numeric,
  spot_change numeric,
  spot_change_pct numeric,
  call_wall numeric,
  put_wall numeric,
  gamma_flip numeric,
  net_gex numeric,
  net_dex numeric,
  dealer_positioning text,
  market_regime text,
  dex_resistance numeric,
  dex_support numeric,
  atr_14 numeric,
  atr_pct numeric,
  key_levels jsonb not null default '{}'::jsonb,
  raw_payload jsonb not null default '{}'::jsonb,
  fetched_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (ticker, source_timestamp)
);

create index if not exists idx_gex_dex_source_snapshots_ticker_timestamp
  on gex_dex_source_snapshots (ticker, source_timestamp desc);

create table if not exists gex_dex_strike_snapshots (
  snapshot_id bigint not null references gex_dex_source_snapshots(id) on delete cascade,
  strike numeric not null,
  call_gex numeric,
  put_gex numeric,
  net_gex numeric,
  call_dex numeric,
  put_dex numeric,
  net_dex numeric,
  expiry_count numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (snapshot_id, strike)
);

create index if not exists idx_gex_dex_strike_snapshots_snapshot
  on gex_dex_strike_snapshots (snapshot_id, strike);
