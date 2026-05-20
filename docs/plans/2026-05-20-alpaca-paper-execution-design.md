# Alpaca Paper Execution Design

## Goal

Build a safe paper-trading execution layer that treats the existing signal system as the brain and Alpaca as a dumb broker adapter.

V1 must:

- read normalized trading intent from existing signals
- support `SPY` only
- support `paper trading` only
- support `long/cash` only
- default to read-only
- require `ALPACA_TRADING_ENABLED=true` before any order can be sent
- log all intents, decisions, blocked trades, broker requests, and broker results in the database

## Locked Decisions

- Broker scope v1: `Alpaca paper API only`
- Instrument scope v1: `SPY only`
- Position scope v1: `long/cash only`
- Unsupported actions in v1:
  - shorts
  - options
  - live trading
  - AI-generated trades
- Signal source v1: `trading_signal_daily` only
- Source abstraction: Alpaca must not read signal tables directly
- Default mode: `read-only`
- Send gate: `ALPACA_TRADING_ENABLED=true`

## Architecture

The execution system should be layered exactly once and kept broker-agnostic above the broker client:

1. `signal source adapter`
   - reads source-specific rows
   - converts them into normalized `execution_intent` objects

2. `execution_intent`
   - broker-agnostic target instruction
   - describes desired symbol, target state, exposure, timing, source metadata, and rationale

3. `risk checks`
   - validate account mode, symbol, order size, stale signal age, open-order conflicts, and long-only constraints
   - return structured pass/fail results

4. `execution_decision`
   - combines intent + broker state + risk outcomes
   - decides `no_op`, `blocked`, `dry_run`, or `approved_for_send`

5. `broker_order_request`
   - maps approved decisions into a broker-specific request payload
   - still contains no signal or risk logic

6. `Alpaca client`
   - dumb transport only
   - account, positions, open orders, submit order

7. `execution/audit log`
   - persists all intents, decisions, broker requests, broker responses, and sync snapshots

## Separation Of Responsibilities

### Source adapters

Own:

- signal-table reads
- signal interpretation
- mapping source language into normalized target state/exposure
- source-specific block reasons such as `short_signal_not_supported`

Do not own:

- broker payloads
- broker auth
- account inspection
- risk sizing against live broker state

### Execution layer

Own:

- normalized intent handling
- current-position comparison
- order proposal generation
- risk rules
- decision status
- logging

Do not own:

- source-table-specific SQL beyond calling adapters
- Alpaca HTTP details

### Alpaca client

Own:

- `getAccount`
- `getPositions`
- `getOpenOrders`
- `submitOrder`

Do not own:

- signal parsing
- target exposure logic
- symbol allowlists
- stale-signal checks
- long-only rules
- trade enable rules

## Execution Data Flow

The full run flow should be:

1. read latest approved source row
2. convert source row into one or more `execution_intent` objects
3. fetch broker state:
   - account
   - positions
   - open orders
4. run risk rules against each intent
5. build an `execution_decision`
6. if mode is `dry-run`, persist and stop
7. if mode is `paper-execute` and all rules pass and trading is enabled:
   - map decision into broker order request
   - submit order
   - save broker response
8. persist sync snapshots and final results

## V1 Signal Mapping

V1 uses one adapter: `trading_signal_daily`.

The adapter should not expose raw trading-signal semantics to the rest of the engine. It should normalize them.

Suggested mapping:

- `KÖP SPY`
  - target state: `long`
  - target exposure: `100`
- `SÄLJ SPY`
  - target state: `cash`
  - target exposure: `0`
- `GÅ TILL CASH`
  - target state: `cash`
  - target exposure: `0`
- `BEHÅLL`
  - target state: reuse current signal target if valid, otherwise no-op intent
- `SITT STILL`
  - no-op intent
- `GÅ KORT SPY`
  - blocked intent with explicit reason
- `STÄNG KORT`
  - blocked intent with explicit reason

Important V1 simplification:

- because there is no separate signal approval workflow yet, the adapter should treat the latest persisted `trading_signal_daily` row as the latest approved signal
- this is an adapter concern, not an Alpaca concern

## Normalized Intent Shape

Each adapter should return a normalized object close to:

- `source_type`
- `source_table`
- `source_row_key`
- `strategy_code`
- `symbol`
- `asset_class`
- `target_state`
- `target_exposure_pct`
- `action_hint`
- `signal_date`
- `signal_timestamp`
- `reason_summary`
- `adapter_metadata_json`

V1 should use fields that make multi-source expansion easy later:

- `source_type=trading_signal_daily`
- `symbol=SPY`
- `asset_class=us_equity`
- `target_state=long|cash`
- `target_exposure_pct=100|0`

## Risk Rules

Risk rules should live in `execution/risk-rules` and return structured results, not booleans only.

V1 required rules:

- `paper_only_check`
- `trading_enabled_gate`
- `allowed_symbols_check`
- `long_only_check`
- `no_options_check`
- `stale_signal_check`
- `open_order_check`
- `max_order_size_check`
- `max_position_size_check`
- `account_tradeable_check`

Expected outcomes:

- `pass`
- `warn`
- `block`

Rules must emit stable machine-readable codes such as:

- `paper_account_required`
- `trading_disabled`
- `symbol_not_allowed`
- `short_not_supported`
- `options_not_supported`
- `signal_stale`
- `open_order_exists`
- `order_size_exceeded`
- `position_size_exceeded`
- `account_blocked`

## Decision Model

The decision layer should express what happened before any broker call.

Recommended statuses:

- `no_op`
- `blocked`
- `dry_run`
- `approved_for_send`
- `sent`
- `broker_rejected`
- `accepted`
- `filled`

`execution_decision` should include:

- normalized target
- current broker position context
- proposed delta
- decision status
- blocking reasons
- dry-run flag
- broker name
- mode

## Broker Order Mapping

The broker order mapper should convert a normalized approved decision into an Alpaca-specific payload.

V1 can stay simple:

- symbol: `SPY`
- side:
  - buy when current exposure < target exposure
  - sell when current exposure > target exposure
- order type: `market`
- time in force: `day`
- quantity or notional:
  - choose one consistent representation in V1 and keep it inside the mapper

The mapper must never decide whether a trade is allowed. It only translates an approved decision.

## Database Model

V1 should use dedicated execution tables, not overload `trading_signal_daily` or `data_fetch_runs`.

### 1. `execution_intents`

Purpose:

- persist normalized adapter output

Suggested columns:

- `id`
- `created_at`
- `source_type`
- `source_table`
- `source_row_key`
- `strategy_code`
- `symbol`
- `asset_class`
- `target_state`
- `target_exposure_pct`
- `action_hint`
- `signal_date`
- `reason_summary`
- `adapter_metadata_json`

### 2. `execution_decisions`

Purpose:

- persist the result of intent evaluation and risk checks even when no order is sent

Suggested columns:

- `id`
- `intent_id`
- `broker`
- `mode`
- `decision_status`
- `current_position_qty`
- `current_position_market_value`
- `current_position_side`
- `current_cash`
- `proposed_order_side`
- `proposed_order_qty`
- `proposed_order_notional`
- `blocking_codes_json`
- `risk_results_json`
- `decision_metadata_json`
- `created_at`

### 3. `execution_orders`

Purpose:

- persist broker request/response pairs and later reconciliation updates

Suggested columns:

- `id`
- `decision_id`
- `broker`
- `broker_order_id`
- `symbol`
- `side`
- `order_type`
- `time_in_force`
- `qty`
- `notional`
- `client_order_id`
- `request_json`
- `response_json`
- `broker_status`
- `submitted_at`
- `updated_at`

### 4. `broker_state_snapshots`

Purpose:

- persist account, position, and open-order state from `alpaca:check` and `alpaca:sync`

Suggested columns:

- `id`
- `broker`
- `snapshot_type`
- `symbol`
- `broker_object_id`
- `captured_at`
- `normalized_json`
- `payload_json`

This keeps V1 flexible without locking the schema too early for non-order sync objects.

## Files And Boundaries

Recommended structure:

- `lib/brokers/alpaca-client.js`
- `lib/execution/source-adapters/trading-signal-adapter.js`
- `lib/execution/risk-rules/*.js`
- `lib/execution/build-intent.js` or `intent-types.js`
- `lib/execution/decision-engine.js`
- `lib/execution/order-mapper.js`
- `lib/execution/run-execution-pipeline.js`
- `lib/repositories/execution.js`
- `lib/repositories/broker-state.js`
- `scripts/alpaca-check.js`
- `scripts/alpaca-sync.js`
- `scripts/alpaca-dry-run.js`
- `scripts/alpaca-paper-execute.js`

Above `lib/brokers/`, everything should stay broker-agnostic.

## Environment Design

Keep broker transport settings under `ALPACA_*` and generic execution/risk settings under `EXECUTION_*`.

Required v1 envs:

- `ALPACA_API_BASE_URL`
- `ALPACA_API_KEY`
- `ALPACA_API_SECRET`
- `ALPACA_TRADING_ENABLED`
- `EXECUTION_ALLOWED_SYMBOLS`
- `EXECUTION_MAX_ORDER_NOTIONAL_USD`
- `EXECUTION_MAX_POSITION_NOTIONAL_USD`
- `EXECUTION_MAX_SIGNAL_AGE_DAYS`

Notes:

- `ALPACA_TRADING_ENABLED` defaults to `false`
- paper execution must still separately verify that the endpoint/account is paper-only

## Script Responsibilities

### `alpaca:check`

- validate env presence
- fetch account, positions, open orders
- persist broker snapshots
- never send orders

### `alpaca:sync`

- fetch account, positions, open orders
- update broker snapshot tables
- reconcile any previously sent execution orders by broker order id if available

### `alpaca:dry-run`

- run full adapter -> intent -> risk -> decision flow
- persist intents and decisions
- build broker order request preview
- never call `submitOrder`

### `alpaca:paper-execute`

- run full pipeline
- only submit if:
  - mode is paper-execute
  - account is paper
  - symbol/risk rules pass
  - no conflicting open order exists
  - `ALPACA_TRADING_ENABLED=true`
- persist request and response

## Extensibility Path

This design should allow future additions without changing the Alpaca client:

- new source adapters:
  - `position_signal_daily`
  - `swing_signal_daily`
  - `swing_watchlist_daily`
- multi-intent batches per run
- multi-ticker support via allowed-symbol config + adapter outputs
- multiple strategies emitting normalized intents
- additional broker implementations under `lib/brokers/`

The stable contract should be:

- adapters output intents
- risk rules evaluate intents
- decision engine approves or blocks
- order mapper translates approved decisions
- broker client transports requests

## Recommended V1 Delivery Order

1. schema + repositories
2. dumb Alpaca client
3. trading-signal adapter
4. risk rules + decision engine
5. dry-run pipeline
6. paper-execute pipeline with hard gate
7. sync/check scripts
8. README and operator docs
