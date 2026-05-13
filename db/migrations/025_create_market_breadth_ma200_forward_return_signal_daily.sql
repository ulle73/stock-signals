create table if not exists market_breadth_ma200_forward_return_signal_daily (
  date date not null primary key,
  ma200_breadth_pct numeric,
  ma200_breadth_bucket text not null,
  ma200_breadth_5d_change numeric,
  ma200_breadth_10d_change numeric,
  ma200_breadth_20d_change numeric,
  ma200_breadth_50d_change numeric,
  ma200_breadth_signal text not null,
  ma200_breadth_action text not null,
  ma200_breadth_confidence text not null,
  ma200_breadth_warning text,
  ma200_expected_return_5d numeric,
  ma200_expected_return_10d numeric,
  ma200_expected_return_1m numeric,
  ma200_expected_return_3m numeric,
  ma200_expected_return_6m numeric,
  ma200_expected_return_12m numeric,
  ma200_win_ratio_5d numeric,
  ma200_win_ratio_10d numeric,
  ma200_win_ratio_1m numeric,
  ma200_win_ratio_3m numeric,
  ma200_win_ratio_6m numeric,
  ma200_win_ratio_12m numeric,
  ma200_forward_model_version text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_market_breadth_ma200_forward_return_signal_daily_bucket
  on market_breadth_ma200_forward_return_signal_daily (ma200_breadth_bucket, date desc);
