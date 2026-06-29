create table if not exists signal_data_quality_daily (
  date date not null,
  gate_key text not null,
  status text not null check (status in ('pass', 'warn', 'block')),
  reason_code text not null,
  summary text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (date, gate_key)
);

create index if not exists idx_signal_data_quality_daily_status_date
  on signal_data_quality_daily (status, date desc);

create index if not exists idx_signal_data_quality_daily_gate_date
  on signal_data_quality_daily (gate_key, date desc);
