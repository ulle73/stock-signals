create table if not exists market_signal_daily (
  date date not null unique,
  spx_close numeric not null,
  spx_3d_change numeric,
  spx_14d_change numeric,
  pct_above_50 numeric not null,
  pct_above_50_3d_change numeric,
  pct_above_50_14d_change numeric,
  pct_above_200 numeric not null,
  pct_above_200_14d_change numeric,
  ad_line numeric not null,
  ad_line_14d_change numeric,
  new_highs integer not null,
  new_lows integer not null,
  vix numeric not null,
  market_regime_score numeric,
  signal text,
  divergence_status text not null default 'none',
  short_divergence_status text not null default 'none',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_market_signal_daily_date
  on market_signal_daily (date desc);

create table if not exists strategy_definitions (
  id bigserial primary key,
  code text not null unique,
  name text not null,
  description text,
  benchmark_symbol text not null,
  execution_model text not null,
  out_of_market_mode text not null,
  transaction_cost_bps integer not null,
  universe_mode text not null,
  point_in_time_supported boolean not null default false,
  rule_source text not null,
  params_json jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_strategy_definitions_active
  on strategy_definitions (is_active);

create table if not exists backtest_runs (
  id bigserial primary key,
  strategy_id bigint not null references strategy_definitions (id),
  status text not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  code_version text,
  signal_data_end_date date,
  benchmark_symbol text not null,
  execution_model text not null,
  transaction_cost_bps integer not null,
  universe_mode text not null,
  point_in_time_supported boolean not null default false,
  notes text,
  cagr numeric,
  max_drawdown numeric,
  sharpe numeric,
  sortino numeric,
  calmar numeric,
  turnover numeric,
  time_in_market_pct numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_backtest_runs_strategy_started
  on backtest_runs (strategy_id, started_at desc);

create index if not exists idx_backtest_runs_status_started
  on backtest_runs (status, started_at desc);

create table if not exists strategy_positions_daily (
  run_id bigint not null references backtest_runs (id) on delete cascade,
  date date not null,
  signal_date date,
  effective_trade_date date,
  target_state text not null,
  applied_state text not null,
  trade_action text,
  reason_code text,
  created_at timestamptz not null default now(),
  unique (run_id, date)
);

create index if not exists idx_strategy_positions_daily_date
  on strategy_positions_daily (date desc);

create table if not exists strategy_equity_daily (
  run_id bigint not null references backtest_runs (id) on delete cascade,
  date date not null,
  start_equity numeric not null,
  end_equity numeric not null,
  strategy_return_pct numeric not null,
  benchmark_return_pct numeric not null,
  cash_weight numeric not null,
  equity_weight numeric not null,
  transaction_cost_pct numeric not null default 0,
  transaction_cost_amount numeric not null default 0,
  drawdown_pct numeric not null,
  is_in_market boolean not null,
  created_at timestamptz not null default now(),
  unique (run_id, date)
);

create index if not exists idx_strategy_equity_daily_date
  on strategy_equity_daily (date desc);
