do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'benchmark_daily_prices'
      and column_name = 'symbol'
  ) and not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'benchmark_daily_prices'
      and column_name = 'ticker'
  ) then
    alter table benchmark_daily_prices rename column symbol to ticker;
  end if;
end
$$;

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'benchmark_daily_prices_symbol_date_key'
      and conrelid = 'public.benchmark_daily_prices'::regclass
  ) and not exists (
    select 1
    from pg_constraint
    where conname = 'benchmark_daily_prices_ticker_date_key'
      and conrelid = 'public.benchmark_daily_prices'::regclass
  ) then
    alter table benchmark_daily_prices
      rename constraint benchmark_daily_prices_symbol_date_key to benchmark_daily_prices_ticker_date_key;
  end if;
end
$$;

drop index if exists idx_benchmark_daily_prices_symbol_date;
drop index if exists idx_market_signal_daily_date;

alter table backtest_runs
  add column if not exists out_of_market_mode text,
  add column if not exists rule_source text,
  add column if not exists params_json jsonb;

update backtest_runs as br
set out_of_market_mode = coalesce(br.out_of_market_mode, sd.out_of_market_mode),
    rule_source = coalesce(br.rule_source, sd.rule_source),
    params_json = coalesce(br.params_json, sd.params_json)
from strategy_definitions as sd
where br.strategy_id = sd.id
  and (
    br.out_of_market_mode is null
    or br.rule_source is null
    or br.params_json is null
  );

alter table backtest_runs
  alter column out_of_market_mode set not null,
  alter column rule_source set not null,
  alter column params_json set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'market_signal_daily_divergence_status_check'
      and conrelid = 'public.market_signal_daily'::regclass
  ) then
    alter table market_signal_daily
      add constraint market_signal_daily_divergence_status_check
      check (divergence_status in ('none', 'bearish_warning', 'bearish_warning_strong', 'bullish_divergence'));
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'market_signal_daily_short_divergence_status_check'
      and conrelid = 'public.market_signal_daily'::regclass
  ) then
    alter table market_signal_daily
      add constraint market_signal_daily_short_divergence_status_check
      check (short_divergence_status in ('none', 'short_negative', 'short_positive'));
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'strategy_definitions_execution_model_check'
      and conrelid = 'public.strategy_definitions'::regclass
  ) then
    alter table strategy_definitions
      add constraint strategy_definitions_execution_model_check
      check (execution_model in ('next_open'));
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'strategy_definitions_out_of_market_mode_check'
      and conrelid = 'public.strategy_definitions'::regclass
  ) then
    alter table strategy_definitions
      add constraint strategy_definitions_out_of_market_mode_check
      check (out_of_market_mode in ('cash'));
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'strategy_definitions_universe_mode_check'
      and conrelid = 'public.strategy_definitions'::regclass
  ) then
    alter table strategy_definitions
      add constraint strategy_definitions_universe_mode_check
      check (universe_mode in ('current_constituents', 'point_in_time'));
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'backtest_runs_status_check'
      and conrelid = 'public.backtest_runs'::regclass
  ) then
    alter table backtest_runs
      add constraint backtest_runs_status_check
      check (status in ('running', 'success', 'failure'));
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'backtest_runs_execution_model_check'
      and conrelid = 'public.backtest_runs'::regclass
  ) then
    alter table backtest_runs
      add constraint backtest_runs_execution_model_check
      check (execution_model in ('next_open'));
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'backtest_runs_out_of_market_mode_check'
      and conrelid = 'public.backtest_runs'::regclass
  ) then
    alter table backtest_runs
      add constraint backtest_runs_out_of_market_mode_check
      check (out_of_market_mode in ('cash'));
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'backtest_runs_universe_mode_check'
      and conrelid = 'public.backtest_runs'::regclass
  ) then
    alter table backtest_runs
      add constraint backtest_runs_universe_mode_check
      check (universe_mode in ('current_constituents', 'point_in_time'));
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'strategy_positions_daily_target_state_check'
      and conrelid = 'public.strategy_positions_daily'::regclass
  ) then
    alter table strategy_positions_daily
      add constraint strategy_positions_daily_target_state_check
      check (target_state in ('long', 'cash'));
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'strategy_positions_daily_applied_state_check'
      and conrelid = 'public.strategy_positions_daily'::regclass
  ) then
    alter table strategy_positions_daily
      add constraint strategy_positions_daily_applied_state_check
      check (applied_state in ('long', 'cash'));
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'strategy_positions_daily_trade_action_check'
      and conrelid = 'public.strategy_positions_daily'::regclass
  ) then
    alter table strategy_positions_daily
      add constraint strategy_positions_daily_trade_action_check
      check (trade_action is null or trade_action in ('enter', 'exit', 'hold', 'stay_out'));
  end if;
end
$$;
