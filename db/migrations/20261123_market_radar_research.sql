-- Isolated research/reporting state. Never connected to trade execution.
create table if not exists market_radar_daily (
  date date primary key,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists market_radar_delivery (
  id text primary key,
  discord_message_id text,
  updated_at timestamptz not null default now()
);
create table if not exists market_radar_alerts (
  id text primary key,
  event_date date not null,
  event_type text not null,
  payload jsonb not null,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_market_radar_alerts_pending
  on market_radar_alerts (event_date desc) where sent_at is null;
