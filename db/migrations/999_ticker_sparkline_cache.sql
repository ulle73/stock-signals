-- Cache pre-rendered ticker sparklines so the board can render charts without per-ticker DB reads.

create table if not exists ticker_sparkline_cache (
  ticker text primary key,
  as_of_date date not null,
  days integer not null default 50,
  sparkline_path text not null,
  close_first numeric,
  close_last numeric,
  return_pct numeric,
  min_close numeric,
  max_close numeric,
  points_json jsonb not null default '[]'::jsonb,
  marker_slots_json jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

create index if not exists idx_ticker_sparkline_cache_as_of_date
  on ticker_sparkline_cache (as_of_date desc);
