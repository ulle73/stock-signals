create table if not exists sector_signal_daily (
  date date not null,
  sector text not null,
  active_ticker_count integer not null default 0,
  pct_above_sma50 numeric,
  pct_above_sma50_14d_change numeric,
  pct_above_sma200 numeric,
  pct_above_sma200_14d_change numeric,
  ad_net integer not null default 0,
  ad_net_14d_change numeric,
  new_highs_52w integer not null default 0,
  new_lows_52w integer not null default 0,
  sector_regime_score numeric,
  signal text not null,
  reason_summary text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (date, sector)
);

create index if not exists idx_sector_signal_daily_date
  on sector_signal_daily (date desc);

create index if not exists idx_sector_signal_daily_sector_date
  on sector_signal_daily (sector, date desc);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'sector_signal_daily_signal_check'
      and conrelid = 'public.sector_signal_daily'::regclass
  ) then
    alter table sector_signal_daily
      add constraint sector_signal_daily_signal_check
      check (signal in ('leading', 'improving', 'weakening', 'lagging', 'mixed'));
  end if;
end
$$;
