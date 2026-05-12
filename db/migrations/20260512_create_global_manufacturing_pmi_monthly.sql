create table if not exists global_manufacturing_pmi_monthly (
  country_key text not null,
  country_label text not null,
  period_date date not null,
  value numeric(10, 4) not null,
  source_url text,
  source_snippet text,
  observed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (country_key, period_date)
);

create index if not exists global_manufacturing_pmi_monthly_period_date_idx
  on global_manufacturing_pmi_monthly (period_date desc);
