create table if not exists execution_intents (
  id bigserial primary key,
  source_type text not null,
  source_table text not null,
  source_row_key text not null,
  strategy_code text,
  symbol text not null,
  asset_class text not null,
  intent_status text not null,
  target_state text not null,
  target_exposure_pct numeric,
  action_hint text not null,
  signal_date date not null,
  signal_timestamp timestamptz,
  reason_summary text,
  adapter_metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_execution_intents_source_signal_date
  on execution_intents (source_type, signal_date desc, id desc);

create table if not exists execution_decisions (
  id bigserial primary key,
  intent_id bigint not null references execution_intents (id) on delete cascade,
  broker text not null,
  mode text not null,
  decision_status text not null,
  current_position_qty numeric,
  current_position_market_value numeric,
  current_position_side text,
  current_cash numeric,
  current_equity numeric,
  proposed_order_side text,
  proposed_order_qty numeric,
  proposed_order_notional numeric,
  target_position_notional numeric,
  blocking_codes_json jsonb not null default '[]'::jsonb,
  risk_results_json jsonb not null default '[]'::jsonb,
  decision_metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_execution_decisions_intent_id
  on execution_decisions (intent_id, id desc);

create table if not exists execution_orders (
  id bigserial primary key,
  decision_id bigint not null references execution_decisions (id) on delete cascade,
  broker text not null,
  broker_order_id text,
  symbol text not null,
  side text not null,
  order_type text not null,
  time_in_force text not null,
  qty numeric,
  notional numeric,
  client_order_id text,
  request_json jsonb not null default '{}'::jsonb,
  response_json jsonb not null default '{}'::jsonb,
  broker_status text,
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_execution_orders_broker_order_id
  on execution_orders (broker, broker_order_id)
  where broker_order_id is not null;

create index if not exists idx_execution_orders_decision_id
  on execution_orders (decision_id, id desc);

create table if not exists broker_state_snapshots (
  id bigserial primary key,
  broker text not null,
  snapshot_type text not null,
  symbol text,
  broker_object_id text,
  captured_at timestamptz not null default now(),
  normalized_json jsonb not null default '{}'::jsonb,
  payload_json jsonb not null default '{}'::jsonb
);

create index if not exists idx_broker_state_snapshots_lookup
  on broker_state_snapshots (broker, snapshot_type, captured_at desc);
