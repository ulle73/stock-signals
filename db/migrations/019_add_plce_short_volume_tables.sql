create table if not exists finra_daily_short_volume (
  date date not null,
  symbol text not null,
  short_volume numeric,
  short_exempt_volume numeric,
  total_volume numeric,
  market text,
  source text not null,
  source_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (date, symbol)
);

create index if not exists idx_finra_daily_short_volume_symbol_date
  on finra_daily_short_volume (symbol, date desc);

create table if not exists plce_short_volume_indicator_daily (
  date date not null primary key,
  plce_short_volume numeric,
  plce_short_exempt_volume numeric,
  plce_total_volume numeric,
  plce_short_volume_market text,
  plce_short_volume_zscore_50 numeric,
  plce_short_volume_zscore_20 numeric,
  plce_short_volume_price_condition boolean not null default false,
  plce_short_volume_buy_signal_50 boolean not null default false,
  plce_short_volume_buy_signal_20 boolean not null default false,
  plce_short_volume_extreme_signal boolean not null default false,
  plce_short_volume_signal text not null default 'none',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_plce_short_volume_indicator_daily_date
  on plce_short_volume_indicator_daily (date desc);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'plce_short_volume_indicator_daily_signal_check'
      and conrelid = 'public.plce_short_volume_indicator_daily'::regclass
  ) then
    alter table plce_short_volume_indicator_daily
      add constraint plce_short_volume_indicator_daily_signal_check
      check (plce_short_volume_signal in ('none', 'buy_z50_gt_3', 'buy_z20_gt_3', 'extreme_gt_3000000', 'multiple_buy_signals'));
  end if;
end
$$;
