create table if not exists gex_dex_signal_snapshots (
  snapshot_id bigint primary key references gex_dex_source_snapshots(id) on delete cascade,
  ticker text not null,
  gamma_regime text not null check (gamma_regime in ('positive', 'negative', 'unknown')),
  spot_to_gamma_flip_atr numeric,
  spot_to_call_wall_atr numeric,
  spot_to_put_wall_atr numeric,
  inside_walls boolean not null default false,
  near_gamma_flip boolean not null default false,
  above_call_wall boolean not null default false,
  below_put_wall boolean not null default false,
  gex_dex_confluence boolean not null default false,
  gex_dex_signal text not null check (gex_dex_signal in ('range', 'flip_risk', 'expansion', 'neutral', 'unknown')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_gex_dex_signal_snapshots_ticker_signal
  on gex_dex_signal_snapshots (ticker, gex_dex_signal, updated_at desc);
