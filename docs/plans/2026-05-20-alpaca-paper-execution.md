# Alpaca Paper Execution Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a safe, auditable Alpaca paper-execution engine that reads existing signals through a normalized `execution_intent` layer, applies broker-independent risk rules, and only sends paper orders when explicitly enabled.

**Architecture:** Add dedicated execution tables for intents, decisions, orders, and broker-state snapshots. Keep all signal interpretation in source adapters under `lib/execution/source-adapters`, keep all risk logic in `lib/execution/risk-rules`, keep the order transport logic in a dumb `lib/brokers/alpaca-client.js`, and expose the flow through four scripts: `alpaca:check`, `alpaca:sync`, `alpaca:dry-run`, and `alpaca:paper-execute`.

**Tech Stack:** Node.js, Next.js App Router, Postgres on Neon/Cockroach-compatible SQL migrations, `pg`, Alpaca paper REST API, Node test runner.

---

### Task 1: Add execution schema migration

**Files:**
- Create: `C:\dev\stock-signals\db\migrations\20260520_create_execution_pipeline_tables.sql`
- Test: `C:\dev\stock-signals\scripts\run-migrations.js`

**Step 1: Write the migration**

Create tables:

- `execution_intents`
- `execution_decisions`
- `execution_orders`
- `broker_state_snapshots`

Include:

- stable primary keys
- `created_at`/`updated_at` timestamps where relevant
- foreign keys:
  - `execution_decisions.intent_id -> execution_intents.id`
  - `execution_orders.decision_id -> execution_decisions.id`
- JSON columns for metadata, risk results, broker payloads, and snapshots
- indexes for:
  - latest intent lookup by `source_type`, `signal_date desc`
  - latest decision lookup by `intent_id`
  - broker order lookup by `broker_order_id`
  - broker snapshot lookup by `broker`, `snapshot_type`, `captured_at desc`

**Step 2: Run migrations**

Run:

```powershell
npm run db:migrate
```

Expected:

- migration applies cleanly
- rerunning is a no-op

**Step 3: Sanity-check resulting schema**

Verify:

- foreign keys exist
- JSON columns match repository payload shapes
- names are generic enough for future non-Alpaca brokers

**Step 4: Commit**

```bash
git add db/migrations/20260520_create_execution_pipeline_tables.sql
git commit -m "feat: add execution pipeline schema"
```

### Task 2: Add execution repositories and persistence tests

**Files:**
- Create: `C:\dev\stock-signals\lib\repositories\execution.js`
- Create: `C:\dev\stock-signals\lib\repositories\broker-state.js`
- Create: `C:\dev\stock-signals\tests\execution-upserts.test.js`
- Create: `C:\dev\stock-signals\tests\broker-state-upserts.test.js`

**Step 1: Write the failing tests**

Cover repository helpers for:

- inserting `execution_intents`
- inserting `execution_decisions`
- inserting `execution_orders`
- inserting `broker_state_snapshots`
- querying latest source-backed intent candidates if needed
- querying pending/recent execution orders by `broker_order_id`

Run:

```powershell
node --test tests\execution-upserts.test.js tests\broker-state-upserts.test.js
```

Expected:

- FAIL because repository files do not exist yet

**Step 2: Implement minimal repositories**

Follow the repo’s existing chunked-upsert/insert style from:

- `lib/repositories/trading-signals.js`
- `lib/repositories/backtests.js`

Prefer:

- append-only inserts for intents and decisions
- insert/update by broker order id for `execution_orders`
- append-only inserts for snapshots

**Step 3: Run tests**

Run:

```powershell
node --test tests\execution-upserts.test.js tests\broker-state-upserts.test.js
```

Expected:

- PASS

**Step 4: Commit**

```bash
git add lib/repositories/execution.js lib/repositories/broker-state.js tests/execution-upserts.test.js tests/broker-state-upserts.test.js
git commit -m "feat: add execution repositories"
```

### Task 3: Add execution config helpers and env defaults

**Files:**
- Create: `C:\dev\stock-signals\lib\execution\config.js`
- Modify: `C:\dev\stock-signals\.env.example`
- Create: `C:\dev\stock-signals\tests\execution-config.test.js`

**Step 1: Write the failing test**

Cover:

- default `ALPACA_TRADING_ENABLED=false`
- parsing `EXECUTION_ALLOWED_SYMBOLS`
- numeric parsing of max order, max position, signal age
- rejecting invalid numeric values

Run:

```powershell
node --test tests\execution-config.test.js
```

Expected:

- FAIL because config helper does not exist

**Step 2: Implement config helper**

Expose helpers such as:

- `getExecutionConfig(env = process.env)`
- `isTradingEnabled(env = process.env)`

Keep rules generic where possible:

- `EXECUTION_ALLOWED_SYMBOLS`
- `EXECUTION_MAX_ORDER_NOTIONAL_USD`
- `EXECUTION_MAX_POSITION_NOTIONAL_USD`
- `EXECUTION_MAX_SIGNAL_AGE_DAYS`

Keep broker transport envs separate:

- `ALPACA_API_BASE_URL`
- `ALPACA_API_KEY`
- `ALPACA_API_SECRET`
- `ALPACA_TRADING_ENABLED`

**Step 3: Update `.env.example`**

Add blank/default-safe keys for all required execution envs.

**Step 4: Run test**

Run:

```powershell
node --test tests\execution-config.test.js
```

Expected:

- PASS

**Step 5: Commit**

```bash
git add lib/execution/config.js .env.example tests/execution-config.test.js
git commit -m "feat: add execution config parsing"
```

### Task 4: Build the dumb Alpaca client and transport tests

**Files:**
- Create: `C:\dev\stock-signals\lib\brokers\alpaca-client.js`
- Create: `C:\dev\stock-signals\tests\alpaca-client.test.js`

**Step 1: Write the failing test**

Cover:

- request paths for:
  - `getAccount`
  - `getPositions`
  - `getOpenOrders`
  - `submitOrder`
- required auth headers
- no credentials printed in thrown errors
- paper endpoint preservation from env config

Run:

```powershell
node --test tests\alpaca-client.test.js
```

Expected:

- FAIL because client file does not exist

**Step 2: Implement minimal client**

Use `fetch` available in Node runtime.

The client should expose only:

- `createAlpacaClient(config)`
- `getAccount()`
- `getPositions()`
- `getOpenOrders()`
- `submitOrder(orderRequest)`

Do not put any signal mapping, symbol restrictions, or risk checks in this file.

**Step 3: Run test**

Run:

```powershell
node --test tests\alpaca-client.test.js
```

Expected:

- PASS

**Step 4: Commit**

```bash
git add lib/brokers/alpaca-client.js tests/alpaca-client.test.js
git commit -m "feat: add dumb alpaca broker client"
```

### Task 5: Build the normalized trading-signal source adapter

**Files:**
- Create: `C:\dev\stock-signals\lib\execution\source-adapters\trading-signal-adapter.js`
- Modify: `C:\dev\stock-signals\lib\repositories\trading-signals.js`
- Create: `C:\dev\stock-signals\tests\trading-signal-adapter.test.js`

**Step 1: Write the failing test**

Cover adapter behavior for:

- `KÖP SPY -> long 100`
- `SÄLJ SPY -> cash 0`
- `GÅ TILL CASH -> cash 0`
- `BEHÅLL -> no state change intent or stable target`
- `SITT STILL -> no-op intent`
- `GÅ KORT SPY -> blocked intent metadata`
- `STÄNG KORT -> blocked intent metadata`

Also cover that:

- `symbol` is always normalized to `SPY`
- `source_type` is `trading_signal_daily`
- the adapter treats the latest stored row as approved in V1

Run:

```powershell
node --test tests\trading-signal-adapter.test.js
```

Expected:

- FAIL because adapter file does not exist

**Step 2: Extend repository reads**

Add a repository helper for fetching the latest trading signal row, likely something like:

- `getLatestTradingSignalRow()`

Avoid changing signal-generation behavior.

**Step 3: Implement adapter**

Return a normalized intent object or a structured no-op/blocked intent payload that the decision engine can still persist.

**Step 4: Run test**

Run:

```powershell
node --test tests\trading-signal-adapter.test.js
```

Expected:

- PASS

**Step 5: Commit**

```bash
git add lib/execution/source-adapters/trading-signal-adapter.js lib/repositories/trading-signals.js tests/trading-signal-adapter.test.js
git commit -m "feat: add trading signal execution adapter"
```

### Task 6: Build risk rules and decision engine

**Files:**
- Create: `C:\dev\stock-signals\lib\execution\risk-rules.js`
- Create: `C:\dev\stock-signals\lib\execution\decision-engine.js`
- Create: `C:\dev\stock-signals\tests\execution-risk-rules.test.js`
- Create: `C:\dev\stock-signals\tests\execution-decision-engine.test.js`

**Step 1: Write the failing tests**

Cover:

- paper-only check blocks non-paper base URL or non-paper account context
- trading-disabled check blocks send mode when `ALPACA_TRADING_ENABLED` is not true
- allowed symbol blocks anything outside `SPY`
- long-only blocks short intents
- options check blocks non-equity intents
- stale signal blocks old dates
- open order check blocks when an existing SPY open order exists
- max order notional blocks oversized proposed orders
- max position notional blocks oversized resulting positions
- read-only mode produces `dry_run` not `approved_for_send`
- supported no-op intent produces `no_op`

Run:

```powershell
node --test tests\execution-risk-rules.test.js tests\execution-decision-engine.test.js
```

Expected:

- FAIL because files do not exist

**Step 2: Implement pure risk rules**

Each rule should return a structured object with fields like:

- `rule`
- `status`
- `code`
- `message`

Do not call Alpaca from the rules. Rules consume already-fetched broker state.

**Step 3: Implement decision engine**

Inputs:

- normalized intent
- broker state
- mode: `check|sync|dry_run|paper_execute`
- execution config

Outputs:

- `decision_status`
- proposed side/qty/notional
- block codes
- full risk result set

**Step 4: Run tests**

Run:

```powershell
node --test tests\execution-risk-rules.test.js tests\execution-decision-engine.test.js
```

Expected:

- PASS

**Step 5: Commit**

```bash
git add lib/execution/risk-rules.js lib/execution/decision-engine.js tests/execution-risk-rules.test.js tests/execution-decision-engine.test.js
git commit -m "feat: add execution risk rules and decisions"
```

### Task 7: Build broker order mapper

**Files:**
- Create: `C:\dev\stock-signals\lib\execution\order-mapper.js`
- Create: `C:\dev\stock-signals\tests\execution-order-mapper.test.js`

**Step 1: Write the failing test**

Cover:

- long target above current position => buy request
- cash target below current position => sell request
- `SPY` only mapping in V1
- market order payload shape for Alpaca
- no mapping for blocked/no-op decisions

Run:

```powershell
node --test tests\execution-order-mapper.test.js
```

Expected:

- FAIL because mapper file does not exist

**Step 2: Implement mapper**

Keep this file transport-ready but broker-agnostic in interface:

- input: approved execution decision
- output: normalized broker order request object

Then adapt that object to Alpaca payload fields in one place.

**Step 3: Run test**

Run:

```powershell
node --test tests\execution-order-mapper.test.js
```

Expected:

- PASS

**Step 4: Commit**

```bash
git add lib/execution/order-mapper.js tests/execution-order-mapper.test.js
git commit -m "feat: add execution order mapper"
```

### Task 8: Build the end-to-end execution pipeline service

**Files:**
- Create: `C:\dev\stock-signals\lib\execution\run-execution-pipeline.js`
- Create: `C:\dev\stock-signals\tests\run-execution-pipeline.test.js`

**Step 1: Write the failing test**

Cover pipeline behavior for:

- latest signal -> intent -> decision -> persisted dry run
- blocked short signal still persisted as intent + blocked decision
- approved paper-execute sends order through injected broker client
- submitted order persists request/response in `execution_orders`
- read-only mode never calls `submitOrder`

Use dependency injection for:

- source adapter
- repositories
- broker client

Run:

```powershell
node --test tests\run-execution-pipeline.test.js
```

Expected:

- FAIL because pipeline file does not exist

**Step 2: Implement pipeline**

The service should:

- load source data
- normalize to intent(s)
- persist intent(s)
- fetch broker state
- persist snapshots if configured by the caller
- evaluate decisions
- persist decisions
- optionally map + send broker orders
- persist broker order rows

**Step 3: Run test**

Run:

```powershell
node --test tests\run-execution-pipeline.test.js
```

Expected:

- PASS

**Step 4: Commit**

```bash
git add lib/execution/run-execution-pipeline.js tests/run-execution-pipeline.test.js
git commit -m "feat: add execution pipeline service"
```

### Task 9: Add operational scripts and script integration tests

**Files:**
- Create: `C:\dev\stock-signals\scripts\alpaca-check.js`
- Create: `C:\dev\stock-signals\scripts\alpaca-sync.js`
- Create: `C:\dev\stock-signals\scripts\alpaca-dry-run.js`
- Create: `C:\dev\stock-signals\scripts\alpaca-paper-execute.js`
- Modify: `C:\dev\stock-signals\package.json`
- Create: `C:\dev\stock-signals\tests\alpaca-scripts.test.js`

**Step 1: Write the failing test**

Cover:

- package scripts exist:
  - `alpaca:check`
  - `alpaca:sync`
  - `alpaca:dry-run`
  - `alpaca:paper-execute`
- `alpaca:check` never submits an order
- `alpaca:sync` persists snapshots
- `alpaca:dry-run` persists intent + decision but does not submit
- `alpaca:paper-execute` requires `ALPACA_TRADING_ENABLED=true`

Run:

```powershell
node --test tests\alpaca-scripts.test.js
```

Expected:

- FAIL because scripts do not exist yet

**Step 2: Implement scripts**

Mirror the repo’s existing script pattern:

- call `ensureEnvLoaded()`
- use `startFetchRun` / `finishFetchRun` for run-level envelope logging
- use `closePool()` in `finally`
- keep console output concise and credential-safe

Suggested job names:

- `alpaca_check`
- `alpaca_sync`
- `alpaca_dry_run`
- `alpaca_paper_execute`

**Step 3: Update `package.json`**

Add:

- `"alpaca:check": "node scripts/alpaca-check.js"`
- `"alpaca:sync": "node scripts/alpaca-sync.js"`
- `"alpaca:dry-run": "node scripts/alpaca-dry-run.js"`
- `"alpaca:paper-execute": "node scripts/alpaca-paper-execute.js"`

**Step 4: Run test**

Run:

```powershell
node --test tests\alpaca-scripts.test.js
```

Expected:

- PASS

**Step 5: Commit**

```bash
git add scripts/alpaca-check.js scripts/alpaca-sync.js scripts/alpaca-dry-run.js scripts/alpaca-paper-execute.js package.json tests/alpaca-scripts.test.js
git commit -m "feat: add alpaca execution scripts"
```

### Task 10: Add reconciliation/sync behavior for broker order state

**Files:**
- Modify: `C:\dev\stock-signals\lib\repositories\execution.js`
- Modify: `C:\dev\stock-signals\lib\execution\run-execution-pipeline.js`
- Modify: `C:\dev\stock-signals\scripts\alpaca-sync.js`
- Create: `C:\dev\stock-signals\tests\alpaca-sync-reconciliation.test.js`

**Step 1: Write the failing test**

Cover:

- previously stored order with `broker_order_id`
- sync refreshes status from broker open-order list or lookup response shape
- latest response is persisted into `execution_orders.response_json`

Run:

```powershell
node --test tests\alpaca-sync-reconciliation.test.js
```

Expected:

- FAIL because reconciliation path is missing

**Step 2: Implement minimal reconciliation**

For V1, keep this minimal:

- sync account, positions, open orders
- update any matching `execution_orders` rows by `broker_order_id`

Do not add fill/event streaming yet.

**Step 3: Run test**

Run:

```powershell
node --test tests\alpaca-sync-reconciliation.test.js
```

Expected:

- PASS

**Step 4: Commit**

```bash
git add lib/repositories/execution.js lib/execution/run-execution-pipeline.js scripts/alpaca-sync.js tests/alpaca-sync-reconciliation.test.js
git commit -m "feat: reconcile alpaca sync order state"
```

### Task 11: Update README and operator docs

**Files:**
- Modify: `C:\dev\stock-signals\README.md`
- Modify: `C:\dev\stock-signals\docs\plans\2026-05-20-alpaca-paper-execution-design.md`

**Step 1: Update README**

Document:

- required env vars
- read-only default behavior
- what `alpaca:check` does
- what `alpaca:sync` does
- what `alpaca:dry-run` does
- what `alpaca:paper-execute` does
- that `ALPACA_TRADING_ENABLED=true` is mandatory before send
- that V1 only supports `SPY`, `paper`, `long/cash`

Include example commands:

```powershell
npm run alpaca:check
npm run alpaca:sync
npm run alpaca:dry-run
$env:ALPACA_TRADING_ENABLED="true"
npm run alpaca:paper-execute
```

**Step 2: Verify docs do not leak secrets**

Check:

- no copied API keys
- no command examples that echo credentials

**Step 3: Commit**

```bash
git add README.md docs/plans/2026-05-20-alpaca-paper-execution-design.md
git commit -m "docs: add alpaca execution operator guide"
```

### Task 12: Run the focused verification suite

**Files:**
- Test: `C:\dev\stock-signals\tests\execution-config.test.js`
- Test: `C:\dev\stock-signals\tests\alpaca-client.test.js`
- Test: `C:\dev\stock-signals\tests\trading-signal-adapter.test.js`
- Test: `C:\dev\stock-signals\tests\execution-risk-rules.test.js`
- Test: `C:\dev\stock-signals\tests\execution-decision-engine.test.js`
- Test: `C:\dev\stock-signals\tests\execution-order-mapper.test.js`
- Test: `C:\dev\stock-signals\tests\run-execution-pipeline.test.js`
- Test: `C:\dev\stock-signals\tests\execution-upserts.test.js`
- Test: `C:\dev\stock-signals\tests\broker-state-upserts.test.js`
- Test: `C:\dev\stock-signals\tests\alpaca-scripts.test.js`
- Test: `C:\dev\stock-signals\tests\alpaca-sync-reconciliation.test.js`

**Step 1: Run all new focused tests**

Run:

```powershell
node --test tests\execution-config.test.js tests\alpaca-client.test.js tests\trading-signal-adapter.test.js tests\execution-risk-rules.test.js tests\execution-decision-engine.test.js tests\execution-order-mapper.test.js tests\run-execution-pipeline.test.js tests\execution-upserts.test.js tests\broker-state-upserts.test.js tests\alpaca-scripts.test.js tests\alpaca-sync-reconciliation.test.js
```

Expected:

- PASS

**Step 2: Run a smoke flow against the real paper account in read-only mode**

Run:

```powershell
npm run alpaca:check
npm run alpaca:dry-run
```

Expected:

- account/positions/open orders read successfully
- intent and decision rows persist
- no orders are sent

**Step 3: Run a guarded paper execution only if explicitly intended**

Run:

```powershell
$env:ALPACA_TRADING_ENABLED="true"
npm run alpaca:paper-execute
```

Expected:

- one broker order at most
- order only for `SPY`
- no short, no option, no live behavior

**Step 4: Commit**

```bash
git add .
git commit -m "feat: add alpaca paper execution engine"
```

## Notes For The Next AI

- Do not move signal interpretation into the broker client.
- Do not read `trading_signal_daily` directly from scripts once the adapter exists.
- Keep `execution_intent` broker-agnostic even if V1 is Alpaca-only.
- Prefer `append-only` audit data for intents and decisions.
- If multi-ticker support is added later, extend adapters first, then risk rules, then order mapping.
