# Alpaca Paper Execution Status

## What is built

The repo now has a first safe Alpaca paper execution layer with these boundaries:

- `lib/execution/source-adapters/trading-signal-adapter.js`
- `lib/execution/config.js`
- `lib/execution/risk-rules.js`
- `lib/execution/decision-engine.js`
- `lib/execution/order-mapper.js`
- `lib/execution/alpaca-state.js`
- `lib/execution/run-execution-pipeline.js`
- `lib/brokers/alpaca-client.js`
- `lib/repositories/execution.js`
- `lib/repositories/broker-state.js`

Database support exists via:

- `db/migrations/20260520_create_execution_pipeline_tables.sql`

Operational scripts exist:

- `npm run alpaca:check`
- `npm run alpaca:sync`
- `npm run alpaca:dry-run`
- `npm run alpaca:paper-execute`

README and `.env.example` were updated for the new flow and guardrails.

## V1 behavior

- source adapter: `trading_signal_daily` only
- symbol: `SPY` only
- mode: `paper` only
- exposure model: `long/cash` only
- default: read-only
- send gate: `ALPACA_TRADING_ENABLED=true`

Blocked and logged in V1:

- short signals
- options / non-equity assets
- stale signals
- disallowed symbols
- conflicting open orders
- oversize orders / positions
- non-paper endpoint

## Important notes for the next AI

- Do not move signal interpretation into `lib/brokers/alpaca-client.js`.
- Do not add risk logic inside the broker client.
- Keep new signal sources as adapters that emit normalized intents.
- If multi-ticker support is added later, extend:
  1. adapters
  2. risk rules
  3. order mapper
  4. README/env defaults

## Good next steps

1. Add an adapter for `position_signal_daily`.
2. Add richer order reconciliation in `alpaca:sync` once broker-side order history is needed.
3. Add dashboard/admin visibility for:
   - latest intent
   - latest blocked reason
   - latest sent order
4. Add broker abstraction for another paper broker only after the intent/decision model proves stable.
