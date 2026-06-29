create table if not exists regime_gated_breakout_daily (
  date date not null,
  ticker text not null,
  company_name text,
  sector text,
  market_signal text,
  market_regime_score numeric,
  sector_signal text,
  breakout_20d_high numeric,
  indicator_price numeric,
  relative_volume20 numeric,
  rs_63d_vs_spy numeric,
  rs_rank_63d integer,
  rs_percentile_63d numeric,
  data_quality_status text not null check (data_quality_status in ('pass', 'warn', 'block')),
  regime_confirmed boolean not null default false,
  sector_confirmed boolean not null default false,
  volume_confirmed boolean not null default false,
  rs_confirmed boolean not null default false,
  qualifies boolean not null default false,
  decision text not null check (decision in ('trigger', 'blocked')),
  setup_score integer not null default 0,
  reason_summary text not null,
  row_values jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (date, ticker)
);

create index if not exists idx_regime_gated_breakout_daily_decision_date
  on regime_gated_breakout_daily (decision, date desc);

create index if not exists idx_regime_gated_breakout_daily_ticker_date
  on regime_gated_breakout_daily (ticker, date desc);
