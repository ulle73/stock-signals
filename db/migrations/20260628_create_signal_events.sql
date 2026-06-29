create table if not exists signal_events (
  id bigserial primary key,
  event_date date not null,
  asset_key text not null,
  ticker text,
  signal_key text not null,
  signal_name text not null,
  signal_type text not null,
  timeframe text not null,
  direction text,
  severity text,
  category text,
  channel_key text,
  status text not null default 'pending',
  source_table text not null,
  source_payload jsonb not null default '{}'::jsonb,
  sent_at timestamptz,
  expired_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_date, asset_key, signal_key)
);

create index if not exists idx_signal_events_status_event_date
  on signal_events (status, event_date desc, id desc);

create index if not exists idx_signal_events_channel_status
  on signal_events (channel_key, status, event_date desc, id desc);

create index if not exists idx_signal_events_signal_key_date
  on signal_events (signal_key, event_date desc);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'signal_events_status_check'
      and conrelid = 'public.signal_events'::regclass
  ) then
    alter table signal_events
      add constraint signal_events_status_check
      check (status in ('pending', 'sent', 'expired', 'cancelled'));
  end if;
end $$;
