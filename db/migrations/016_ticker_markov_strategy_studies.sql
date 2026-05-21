create table if not exists ticker_markov_strategy_daily (
  strategy_name text not null,
  date date not null,
  rebalance_date date,
  rebalance_frequency text not null,
  holding_days integer not null,
  side text not null,
  ticker_count integer not null default 0,
  tickers jsonb not null default '[]'::jsonb,
  gross_return numeric,
  spread_cost numeric not null default 0,
  portfolio_return numeric,
  cumulative_return numeric,
  spy_return numeric,
  spy_cumulative_return numeric,
  equal_weight_return numeric,
  equal_weight_cumulative_return numeric,
  excess_vs_spy numeric,
  excess_vs_equal_weight numeric,
  drawdown numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (strategy_name, date)
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'ticker_markov_strategy_daily_side_check'
      and conrelid = 'public.ticker_markov_strategy_daily'::regclass
  ) then
    alter table ticker_markov_strategy_daily
      add constraint ticker_markov_strategy_daily_side_check
      check (side in ('long', 'short', 'long_short', 'cash'));
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'ticker_markov_strategy_daily_rebalance_check'
      and conrelid = 'public.ticker_markov_strategy_daily'::regclass
  ) then
    alter table ticker_markov_strategy_daily
      add constraint ticker_markov_strategy_daily_rebalance_check
      check (rebalance_frequency in ('daily', 'weekly'));
  end if;
end
$$;

create index if not exists idx_ticker_markov_strategy_daily_date
  on ticker_markov_strategy_daily (date desc);

create index if not exists idx_ticker_markov_strategy_daily_strategy_date
  on ticker_markov_strategy_daily (strategy_name, date desc);

create table if not exists ticker_markov_strategy_summary (
  strategy_name text primary key,
  rebalance_frequency text not null,
  holding_days integer not null,
  side text not null,
  spread_bps numeric not null default 10,
  start_date date,
  end_date date,
  trading_days integer not null default 0,
  total_return numeric,
  spy_total_return numeric,
  equal_weight_total_return numeric,
  excess_vs_spy numeric,
  excess_vs_equal_weight numeric,
  max_drawdown numeric,
  win_rate numeric,
  avg_daily_return numeric,
  volatility_daily numeric,
  avg_ticker_count numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_ticker_markov_strategy_summary_total_return
  on ticker_markov_strategy_summary (total_return desc);
