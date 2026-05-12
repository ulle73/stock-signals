create table if not exists europe_growth_indicators_monthly (
  indicator_key text not null,
  indicator_label text not null,
  period_date date not null,
  value numeric(14, 4) not null,
  source_url text,
  source_snippet text,
  observed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (indicator_key, period_date)
);

create index if not exists europe_growth_indicators_monthly_period_date_idx
  on europe_growth_indicators_monthly (period_date desc);
