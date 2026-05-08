create table if not exists trading_signal_daily (
  date date primary key,
  setup text not null,
  decision text not null,
  previous_state text not null,
  target_state text not null,
  trigger_count integer not null default 0,
  market_regime_score numeric,
  reason_summary text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_trading_signal_daily_date
  on trading_signal_daily (date desc);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'trading_signal_daily_setup_check'
      and conrelid = 'public.trading_signal_daily'::regclass
  ) then
    alter table trading_signal_daily
      add constraint trading_signal_daily_setup_check
      check (setup in ('bullish', 'bearish', 'risk_off', 'neutral'));
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'trading_signal_daily_decision_check'
      and conrelid = 'public.trading_signal_daily'::regclass
  ) then
    alter table trading_signal_daily
      add constraint trading_signal_daily_decision_check
      check (decision in ('KÖP SPY', 'SÄLJ SPY', 'GÅ KORT SPY', 'STÄNG KORT', 'BEHÅLL', 'GÅ TILL CASH', 'SITT STILL'));
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'trading_signal_daily_previous_state_check'
      and conrelid = 'public.trading_signal_daily'::regclass
  ) then
    alter table trading_signal_daily
      add constraint trading_signal_daily_previous_state_check
      check (previous_state in ('long', 'cash', 'short'));
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'trading_signal_daily_target_state_check'
      and conrelid = 'public.trading_signal_daily'::regclass
  ) then
    alter table trading_signal_daily
      add constraint trading_signal_daily_target_state_check
      check (target_state in ('long', 'cash', 'short'));
  end if;
end
$$;
