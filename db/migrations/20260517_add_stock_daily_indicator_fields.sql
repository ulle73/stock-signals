alter table stock_daily_indicators
  add column if not exists price_zscore_20 numeric,
  add column if not exists price_zscore_avg_20 numeric,
  add column if not exists ibs_value numeric,
  add column if not exists rsi14 numeric,
  add column if not exists macd_v numeric,
  add column if not exists breakout_20d_high numeric,
  add column if not exists breakout_20d_low numeric,
  add column if not exists plce_threshold_value numeric,
  add column if not exists price_zscore_buy_signal boolean not null default false,
  add column if not exists price_zscore_sell_signal boolean not null default false,
  add column if not exists ibs_rsi_buy_signal boolean not null default false,
  add column if not exists macd_v_buy_signal boolean not null default false,
  add column if not exists macd_v_sell_signal boolean not null default false,
  add column if not exists macd_v_active boolean not null default false,
  add column if not exists breakout_20d_buy_signal boolean not null default false,
  add column if not exists breakout_20d_sell_signal boolean not null default false,
  add column if not exists plce_threshold_buy_signal boolean not null default false,
  add column if not exists price_zscore_signal text not null default 'none',
  add column if not exists ibs_rsi_signal text not null default 'none',
  add column if not exists macd_v_signal text not null default 'none',
  add column if not exists breakout_20d_signal text not null default 'none',
  add column if not exists plce_threshold_signal text not null default 'none';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'stock_daily_indicators_price_zscore_signal_check'
      and conrelid = 'public.stock_daily_indicators'::regclass
  ) then
    alter table stock_daily_indicators
      add constraint stock_daily_indicators_price_zscore_signal_check
      check (price_zscore_signal in ('buy', 'sell', 'none'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'stock_daily_indicators_ibs_rsi_signal_check'
      and conrelid = 'public.stock_daily_indicators'::regclass
  ) then
    alter table stock_daily_indicators
      add constraint stock_daily_indicators_ibs_rsi_signal_check
      check (ibs_rsi_signal in ('buy', 'none'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'stock_daily_indicators_macd_v_signal_check'
      and conrelid = 'public.stock_daily_indicators'::regclass
  ) then
    alter table stock_daily_indicators
      add constraint stock_daily_indicators_macd_v_signal_check
      check (macd_v_signal in ('buy', 'sell', 'active', 'none'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'stock_daily_indicators_breakout_20d_signal_check'
      and conrelid = 'public.stock_daily_indicators'::regclass
  ) then
    alter table stock_daily_indicators
      add constraint stock_daily_indicators_breakout_20d_signal_check
      check (breakout_20d_signal in ('buy', 'sell', 'none'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'stock_daily_indicators_plce_threshold_signal_check'
      and conrelid = 'public.stock_daily_indicators'::regclass
  ) then
    alter table stock_daily_indicators
      add constraint stock_daily_indicators_plce_threshold_signal_check
      check (plce_threshold_signal in ('buy', 'none'));
  end if;
end
$$;
