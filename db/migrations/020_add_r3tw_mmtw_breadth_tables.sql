create table if not exists external_breadth_daily (
  date date not null,
  series_key text not null,
  symbol text not null,
  name text not null,
  value numeric not null,
  source text not null,
  source_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (date, series_key)
);

create index if not exists idx_external_breadth_daily_series_date
  on external_breadth_daily (series_key, date desc);

create table if not exists r3tw_mmtw_20dma_breadth_indicator_daily (
  date date not null primary key,
  r3tw_value numeric,
  mmtw_value numeric,
  r3tw_cross_up_20 boolean not null default false,
  mmtw_cross_up_20 boolean not null default false,
  r3tw_mmtw_buy_signal boolean not null default false,
  r3tw_mmtw_signal text not null default 'none',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_r3tw_mmtw_20dma_breadth_indicator_daily_date
  on r3tw_mmtw_20dma_breadth_indicator_daily (date desc);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'r3tw_mmtw_20dma_breadth_indicator_daily_signal_check'
      and conrelid = 'public.r3tw_mmtw_20dma_breadth_indicator_daily'::regclass
  ) then
    alter table r3tw_mmtw_20dma_breadth_indicator_daily
      add constraint r3tw_mmtw_20dma_breadth_indicator_daily_signal_check
      check (r3tw_mmtw_signal in ('none', 'buy_both_cross_above_20'));
  end if;
end
$$;
