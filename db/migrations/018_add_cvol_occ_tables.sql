create table if not exists occ_daily_volume_totals (
  report_date date not null,
  exchange text not null,
  calls numeric,
  puts numeric,
  ratio numeric,
  volume numeric,
  market_share numeric,
  source text not null,
  source_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (report_date, exchange)
);

create index if not exists idx_occ_daily_volume_totals_exchange_date
  on occ_daily_volume_totals (exchange, report_date desc);

create table if not exists cvol_call_volume_indicator_daily (
  date date not null primary key,
  cvol_calls numeric,
  cvol_puts numeric,
  cvol_ratio numeric,
  cvol_total_volume numeric,
  cvol_market_share numeric,
  cvol_zscore_20 numeric,
  cvol_zscore_15 numeric,
  cvol_zscore_10 numeric,
  cvol_price_condition boolean not null default false,
  cvol_sell_signal_1 boolean not null default false,
  cvol_sell_signal_2 boolean not null default false,
  cvol_sell_signal_3 boolean not null default false,
  cvol_signal text not null default 'none',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_cvol_call_volume_indicator_daily_date
  on cvol_call_volume_indicator_daily (date desc);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'cvol_call_volume_indicator_daily_signal_check'
      and conrelid = 'public.cvol_call_volume_indicator_daily'::regclass
  ) then
    alter table cvol_call_volume_indicator_daily
      add constraint cvol_call_volume_indicator_daily_signal_check
      check (cvol_signal in ('none', 'sell_z20_gt_1_5', 'sell_z15_gt_2_5', 'sell_z10_gt_3', 'multiple_sell_signals'));
  end if;
end
$$;
