create table if not exists signal_study_results (
  id text primary key,
  slug text not null,
  study_name text not null,
  study_type text not null,
  return_instrument text not null,
  signal_instrument text,
  config_path text,
  payload_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_signal_study_results_slug_created_at
  on signal_study_results (slug, created_at desc);
