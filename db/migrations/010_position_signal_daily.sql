create table if not exists position_signal_daily (
  date date primary key,
  signal text not null,
  decision text not null,
  target_equity_weight_pct numeric not null,
  target_cash_weight_pct numeric not null,
  market_signal text,
  market_regime_score numeric,
  caution_count integer not null default 0,
  hard_risk_off_count integer not null default 0,
  reason_summary text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_position_signal_daily_date
  on position_signal_daily (date desc);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'position_signal_daily_signal_check'
      and conrelid = 'public.position_signal_daily'::regclass
  ) then
    alter table position_signal_daily
      add constraint position_signal_daily_signal_check
      check (signal in ('risk_on', 'risk_caution', 'risk_off'));
  end if;
end
$$;

alter table strategy_positions_daily
  add column if not exists target_equity_weight numeric,
  add column if not exists applied_equity_weight numeric;

update strategy_positions_daily
set target_equity_weight = case when target_state = 'long' then 1 else 0 end
where target_equity_weight is null;

update strategy_positions_daily
set applied_equity_weight = case when applied_state = 'long' then 1 else 0 end
where applied_equity_weight is null;

alter table strategy_positions_daily
  alter column target_equity_weight set not null,
  alter column applied_equity_weight set not null;

alter table strategy_positions_daily
  alter column target_equity_weight set default 0,
  alter column applied_equity_weight set default 0;

alter table strategy_positions_daily
  drop constraint if exists strategy_positions_daily_trade_action_check;

alter table strategy_positions_daily
  add constraint strategy_positions_daily_trade_action_check
  check (trade_action is null or trade_action in ('enter', 'exit', 'hold', 'stay_out', 'rebalance'));
