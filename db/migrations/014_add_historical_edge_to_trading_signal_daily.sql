alter table trading_signal_daily
  add column if not exists historical_edge_fingerprint text,
  add column if not exists historical_edge_direction text not null default 'neutral',
  add column if not exists historical_edge_score numeric,
  add column if not exists markov_state text,
  add column if not exists markov_bull_probability numeric,
  add column if not exists markov_sideways_probability numeric,
  add column if not exists markov_bear_probability numeric,
  add column if not exists markov_edge numeric,
  add column if not exists markov_stickiness numeric,
  add column if not exists markov_sample_size integer not null default 0,
  add column if not exists forward_5d_avg_return numeric,
  add column if not exists forward_5d_win_rate numeric,
  add column if not exists forward_20d_avg_return numeric,
  add column if not exists forward_20d_win_rate numeric,
  add column if not exists forward_sample_size integer not null default 0,
  add column if not exists state_duration_days integer not null default 0,
  add column if not exists state_duration_percentile numeric,
  add column if not exists state_exhaustion_risk boolean not null default false;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'trading_signal_daily_historical_edge_direction_check'
      and conrelid = 'public.trading_signal_daily'::regclass
  ) then
    alter table trading_signal_daily
      add constraint trading_signal_daily_historical_edge_direction_check
      check (historical_edge_direction in ('bullish', 'bearish', 'risk_off', 'neutral'));
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'trading_signal_daily_markov_state_check'
      and conrelid = 'public.trading_signal_daily'::regclass
  ) then
    alter table trading_signal_daily
      add constraint trading_signal_daily_markov_state_check
      check (markov_state in ('bull', 'sideways', 'bear'));
  end if;
end
$$;

create index if not exists idx_trading_signal_daily_historical_edge_direction
  on trading_signal_daily (historical_edge_direction, date desc);

create index if not exists idx_trading_signal_daily_markov_state
  on trading_signal_daily (markov_state, date desc);
