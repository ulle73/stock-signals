alter table position_signal_daily
  add column if not exists raw_signal text,
  add column if not exists raw_decision text,
  add column if not exists raw_target_equity_weight_pct numeric,
  add column if not exists raw_target_cash_weight_pct numeric,
  add column if not exists persistence_direction text default 'none',
  add column if not exists persistence_streak_days integer default 0,
  add column if not exists persistence_required_days integer default 0;

update position_signal_daily
set
  raw_signal = coalesce(raw_signal, signal),
  raw_decision = coalesce(raw_decision, decision),
  raw_target_equity_weight_pct = coalesce(raw_target_equity_weight_pct, target_equity_weight_pct),
  raw_target_cash_weight_pct = coalesce(raw_target_cash_weight_pct, target_cash_weight_pct),
  persistence_direction = coalesce(persistence_direction, 'none'),
  persistence_streak_days = coalesce(persistence_streak_days, 0),
  persistence_required_days = coalesce(persistence_required_days, 0)
where
  raw_signal is null
  or raw_decision is null
  or raw_target_equity_weight_pct is null
  or raw_target_cash_weight_pct is null
  or persistence_direction is null
  or persistence_streak_days is null
  or persistence_required_days is null;

alter table position_signal_daily
  alter column raw_signal set not null,
  alter column raw_decision set not null,
  alter column raw_target_equity_weight_pct set not null,
  alter column raw_target_cash_weight_pct set not null,
  alter column persistence_direction set not null,
  alter column persistence_streak_days set not null,
  alter column persistence_required_days set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'position_signal_daily_raw_signal_check'
      and conrelid = 'public.position_signal_daily'::regclass
  ) then
    alter table position_signal_daily
      add constraint position_signal_daily_raw_signal_check
      check (raw_signal in ('risk_on', 'risk_caution', 'risk_off'));
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'position_signal_daily_persistence_direction_check'
      and conrelid = 'public.position_signal_daily'::regclass
  ) then
    alter table position_signal_daily
      add constraint position_signal_daily_persistence_direction_check
      check (persistence_direction in ('none', 'reduction', 'increase', 'hard_risk_off'));
  end if;
end
$$;
