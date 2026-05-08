create table if not exists swing_signal_daily (
  date date primary key,
  setup text not null,
  decision text not null,
  previous_state text not null,
  target_state text not null,
  active_sector_count integer not null default 0,
  leading_sector_count integer not null default 0,
  improving_sector_count integer not null default 0,
  weakening_sector_count integer not null default 0,
  lagging_sector_count integer not null default 0,
  mixed_sector_count integer not null default 0,
  market_signal text not null,
  market_regime_score numeric,
  reason_summary text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_swing_signal_daily_date
  on swing_signal_daily (date desc);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'swing_signal_daily_setup_check'
      and conrelid = 'public.swing_signal_daily'::regclass
  ) then
    alter table swing_signal_daily
      add constraint swing_signal_daily_setup_check
      check (setup in ('bullish', 'improving', 'weakening', 'bearish_watch', 'risk_off', 'neutral'));
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'swing_signal_daily_decision_check'
      and conrelid = 'public.swing_signal_daily'::regclass
  ) then
    alter table swing_signal_daily
      add constraint swing_signal_daily_decision_check
      check (decision in ('KÖP STARKA SEKTORER', 'BEHÅLL LONGS', 'MINSKA RISK', 'GÅ TILL CASH', 'LONG WATCHLIST', 'SHORT WATCHLIST', 'SITT STILL'));
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'swing_signal_daily_previous_state_check'
      and conrelid = 'public.swing_signal_daily'::regclass
  ) then
    alter table swing_signal_daily
      add constraint swing_signal_daily_previous_state_check
      check (previous_state in ('long', 'cash', 'long_watchlist', 'short_watchlist'));
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'swing_signal_daily_target_state_check'
      and conrelid = 'public.swing_signal_daily'::regclass
  ) then
    alter table swing_signal_daily
      add constraint swing_signal_daily_target_state_check
      check (target_state in ('long', 'cash', 'long_watchlist', 'short_watchlist'));
  end if;
end
$$;
