alter table ticker_markov_strategy_daily
  add column if not exists spy_drawdown numeric,
  add column if not exists equal_weight_drawdown numeric;

alter table ticker_markov_strategy_summary
  add column if not exists spy_max_drawdown numeric,
  add column if not exists equal_weight_max_drawdown numeric,
  add column if not exists return_over_max_drawdown numeric,
  add column if not exists excess_vs_spy_over_max_drawdown numeric,
  add column if not exists excess_vs_equal_weight_over_max_drawdown numeric;

create index if not exists idx_ticker_markov_strategy_summary_risk_score
  on ticker_markov_strategy_summary (return_over_max_drawdown desc nulls last);
