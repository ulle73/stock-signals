create table if not exists swing_watchlist_daily (
  date date not null,
  bias text not null,
  rank_in_bias integer not null,
  ticker text not null,
  sector text not null,
  sector_signal text not null,
  swing_setup text not null,
  swing_decision text not null,
  watchlist_score numeric not null,
  indicator_price numeric not null,
  daily_return_pct numeric,
  relative_volume20 numeric,
  pct_from_52w_high numeric,
  pct_from_52w_low numeric,
  distance_from_sma50_pct numeric,
  distance_from_sma200_pct numeric,
  reason_summary text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (date, bias, rank_in_bias)
);

create index if not exists idx_swing_watchlist_daily_date
  on swing_watchlist_daily (date desc);

create index if not exists idx_swing_watchlist_daily_date_bias
  on swing_watchlist_daily (date desc, bias, rank_in_bias asc);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'swing_watchlist_daily_bias_check'
      and conrelid = 'public.swing_watchlist_daily'::regclass
  ) then
    alter table swing_watchlist_daily
      add constraint swing_watchlist_daily_bias_check
      check (bias in ('long', 'short'));
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'swing_watchlist_daily_sector_signal_check'
      and conrelid = 'public.swing_watchlist_daily'::regclass
  ) then
    alter table swing_watchlist_daily
      add constraint swing_watchlist_daily_sector_signal_check
      check (sector_signal in ('leading', 'improving', 'weakening', 'lagging', 'mixed'));
  end if;
end
$$;
