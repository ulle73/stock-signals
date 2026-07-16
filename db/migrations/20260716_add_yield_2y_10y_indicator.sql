create table if not exists yield_2y_10y_indicator_daily (
  date date not null primary key,
  two_year numeric,
  ten_year numeric,
  effr numeric,
  smooth_effr_5 numeric,
  prev_effr numeric,
  prev_smooth_effr_5 numeric,
  frr_2_10 numeric,
  is_long boolean not null default false,
  is_short boolean not null default false,
  is_inverted boolean not null default false,
  buy_signal boolean not null default false,
  sell_signal boolean not null default false,
  signal text not null default 'none',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint yield_2y_10y_indicator_daily_signal_check
    check (signal in ('none', 'buy', 'sell', 'inverted'))
);

create index if not exists idx_yield_2y_10y_indicator_daily_date
  on yield_2y_10y_indicator_daily (date desc);
