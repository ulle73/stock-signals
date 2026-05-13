create table if not exists market_breadth_ma200_forward_return_empirical_daily (
  benchmark_symbol text not null,
  date date not null,
  ma200_breadth_pct numeric,
  ma200_breadth_bucket text not null,
  ma200_empirical_sample_count_5d integer not null default 0,
  ma200_empirical_sample_count_10d integer not null default 0,
  ma200_empirical_sample_count_1m integer not null default 0,
  ma200_empirical_sample_count_3m integer not null default 0,
  ma200_empirical_sample_count_6m integer not null default 0,
  ma200_empirical_sample_count_12m integer not null default 0,
  ma200_empirical_expected_return_5d numeric,
  ma200_empirical_expected_return_10d numeric,
  ma200_empirical_expected_return_1m numeric,
  ma200_empirical_expected_return_3m numeric,
  ma200_empirical_expected_return_6m numeric,
  ma200_empirical_expected_return_12m numeric,
  ma200_empirical_win_ratio_5d numeric,
  ma200_empirical_win_ratio_10d numeric,
  ma200_empirical_win_ratio_1m numeric,
  ma200_empirical_win_ratio_3m numeric,
  ma200_empirical_win_ratio_6m numeric,
  ma200_empirical_win_ratio_12m numeric,
  ma200_forward_model_version text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (benchmark_symbol, date)
);

create index if not exists idx_market_breadth_ma200_forward_return_empirical_daily_bucket
  on market_breadth_ma200_forward_return_empirical_daily (benchmark_symbol, ma200_breadth_bucket, date desc);
