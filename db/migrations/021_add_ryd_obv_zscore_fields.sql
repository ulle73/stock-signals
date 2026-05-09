alter table stock_daily_indicators
  add column if not exists ryd_obv numeric,
  add column if not exists ryd_obv_zscore_80 numeric,
  add column if not exists ryd_obv_buy_signal boolean not null default false,
  add column if not exists ryd_obv_sell_signal boolean not null default false,
  add column if not exists ryd_obv_signal text not null default 'none';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'stock_daily_indicators_ryd_obv_signal_check'
      and conrelid = 'public.stock_daily_indicators'::regclass
  ) then
    alter table stock_daily_indicators
      add constraint stock_daily_indicators_ryd_obv_signal_check
      check (ryd_obv_signal in ('buy', 'sell', 'none'));
  end if;
end
$$;
