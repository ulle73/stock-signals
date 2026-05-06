# Signal And Backtest Foundation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build verified `SPY` benchmark ingestion, daily divergence signal storage, and a reproducible `long/cash` backtest foundation that can compare single rules and combined rules against `SPY` buy-and-hold.

**Architecture:** Add a separate daily benchmark table for `SPY`, keep market signals in a one-row-per-date table, and keep backtest runs, positions, and equity curves in separate audit tables. Compute divergence signals from breadth plus `SP500`/`VIXCLS`, then execute strategies on `SPY` with next-open fills using adjusted-scale return math.

**Tech Stack:** Node.js, Next.js App Router, Postgres on Neon, `pg`, Yahoo Finance daily chart data, FRED daily series, GitHub Actions, Node test runner.

---

### Task 1: Add benchmark and backtest schema migrations

**Files:**
- Create: `C:\dev\stock-signals\db\migrations\006_benchmark_daily_prices.sql`
- Create: `C:\dev\stock-signals\db\migrations\007_signal_and_backtest_tables.sql`
- Test: `C:\dev\stock-signals\scripts\run-migrations.js`

**Step 1: Write the migration files**

Create `006_benchmark_daily_prices.sql` with:

- `benchmark_daily_prices`
- unique `(ticker, date)`
- non-null OHLCV + `adj_close`

Create `007_signal_and_backtest_tables.sql` with:

- `market_signal_daily`
- `strategy_definitions`
- `backtest_runs`
- `strategy_positions_daily`
- `strategy_equity_daily`

**Step 2: Run migrations on a disposable local/prod-safe branch database**

Run:

```powershell
npm run db:migrate
```

Expected:

- both migrations apply cleanly
- rerunning `npm run db:migrate` does nothing

**Step 3: Inspect resulting tables**

Run a direct query or Neon table view to confirm column names and unique keys are exactly as designed.

**Step 4: Commit**

```bash
git add db/migrations/006_benchmark_daily_prices.sql db/migrations/007_signal_and_backtest_tables.sql
git commit -m "feat: add benchmark and backtest schema"
```

### Task 2: Add benchmark repository and upsert tests

**Files:**
- Create: `C:\dev\stock-signals\lib\repositories\benchmark-prices.js`
- Create: `C:\dev\stock-signals\tests\benchmark-upserts.test.js`

**Step 1: Write the failing test**

Cover:

- building multi-row upsert SQL for `benchmark_daily_prices`
- stable parameter ordering
- conflict target `(ticker, date)`
- updating `open/high/low/close/adj_close/volume/source/updated_at`

Run:

```powershell
node --test tests\benchmark-upserts.test.js
```

Expected:

- FAIL because repository file does not exist yet

**Step 2: Write minimal implementation**

Implement:

- `buildBenchmarkPriceUpsertStatements(rows, options?)`
- `upsertBenchmarkDailyPrices(client, rows, options?)`

Follow the same chunked-upsert pattern already used in `prices.js` and `breadth.js`.

**Step 3: Run test to verify it passes**

Run:

```powershell
node --test tests\benchmark-upserts.test.js
```

Expected:

- PASS

**Step 4: Commit**

```bash
git add lib/repositories/benchmark-prices.js tests/benchmark-upserts.test.js
git commit -m "feat: add benchmark price upserts"
```

### Task 3: Extend Yahoo source logic for benchmark fetch and verify source shape

**Files:**
- Modify: `C:\dev\stock-signals\lib\sources\yahoo.js`
- Modify: `C:\dev\stock-signals\tests\yahoo-url.test.js`
- Create: `C:\dev\stock-signals\tests\benchmark-yahoo-parse.test.js`

**Step 1: Write the failing tests**

Cover:

- `SPY` URL generation with daily interval
- parsing benchmark OHLCV rows including `adj_close`
- consistent date normalization

Run:

```powershell
node --test tests\yahoo-url.test.js tests\benchmark-yahoo-parse.test.js
```

Expected:

- FAIL on benchmark-specific coverage

**Step 2: Implement minimal source support**

Refactor `yahoo.js` so the same parsing path can power:

- stock fetches
- benchmark fetches

Do not fork a second parser if a parameterized one keeps the code clean.

**Step 3: Run tests**

Run:

```powershell
node --test tests\yahoo-url.test.js tests\benchmark-yahoo-parse.test.js
```

Expected:

- PASS

**Step 4: Manual source-shape sanity check**

Fetch a small recent `SPY` sample and confirm each row includes:

- `date`
- `open`
- `high`
- `low`
- `close`
- `adj_close`
- `volume`

**Step 5: Commit**

```bash
git add lib/sources/yahoo.js tests/yahoo-url.test.js tests/benchmark-yahoo-parse.test.js
git commit -m "feat: support benchmark yahoo parsing"
```

### Task 4: Fetch and store `SPY` during `fetch:daily`, then verify against public sources

**Files:**
- Modify: `C:\dev\stock-signals\scripts\fetch-daily.js`
- Modify: `C:\dev\stock-signals\lib\repositories\fetch-runs.js`
- Modify: `C:\dev\stock-signals\README.md`

**Step 1: Write the failing integration test**

Create:

- `C:\dev\stock-signals\tests\fetch-benchmark-flow.test.js`

Cover:

- benchmark fetch is invoked for `SPY`
- rows are upserted into `benchmark_daily_prices`
- fetch-run metadata records benchmark success/failure counts

Run:

```powershell
node --test tests\fetch-benchmark-flow.test.js
```

Expected:

- FAIL

**Step 2: Implement minimal fetch integration**

Add a benchmark step to `fetch-daily.js`:

- fetch `SPY` daily bars
- upsert into `benchmark_daily_prices`
- include benchmark counts in run metadata

Reuse existing stale-run guard patterns.

**Step 3: Run test**

Run:

```powershell
node --test tests\fetch-benchmark-flow.test.js
```

Expected:

- PASS

**Step 4: Run a real small fetch**

Run:

```powershell
$env:NODE_ENV="production"
$env:FETCH_TICKER_LIMIT="1"
npm run fetch:daily
```

Expected:

- success run
- benchmark rows inserted for `SPY`

**Step 5: Verify against external references**

Check the latest inserted `SPY` row against:

- [Yahoo Finance historical data help](https://help.yahoo.com/kb/finance-app-for-ios/download-historical-data-yahoo-finance-sln2311.html)
- [State Street SPDR S&P 500 ETF Trust](https://www.ssga.com/us/en/intermediary/etfs/state-street-spdr-sp-500-etf-trust-spy)

Verification checklist:

- latest `close`
- latest `high`
- latest `low`
- latest `volume`

Document the exact checked date in the commit message body or local notes.

**Step 6: Commit**

```bash
git add scripts/fetch-daily.js lib/repositories/fetch-runs.js README.md tests/fetch-benchmark-flow.test.js
git commit -m "feat: fetch and store spy benchmark prices"
```

### Task 5: Add divergence utilities and signal-table repository

**Files:**
- Create: `C:\dev\stock-signals\lib\utils\divergence-signals.js`
- Create: `C:\dev\stock-signals\lib\repositories\market-signals.js`
- Create: `C:\dev\stock-signals\tests\divergence-signals.test.js`
- Create: `C:\dev\stock-signals\tests\market-signals-upserts.test.js`

**Step 1: Write the failing tests**

Cover in `divergence-signals.test.js`:

- bearish warning
- bearish strong warning
- bullish divergence
- short negative divergence
- short positive divergence
- no-signal cases

Cover in `market-signals-upserts.test.js`:

- multi-row upsert SQL
- conflict target `date`
- nullable `market_regime_score` and `signal`

Run:

```powershell
node --test tests\divergence-signals.test.js tests\market-signals-upserts.test.js
```

Expected:

- FAIL

**Step 2: Implement minimal utilities**

Implement:

- rolling helpers for 3-day and 14-day lookbacks
- A/D line accumulation
- divergence classification helpers
- signal-table upsert builder + writer

Keep `market_regime_score` and `signal` pass-through/nullable for now.

**Step 3: Run tests**

Run:

```powershell
node --test tests\divergence-signals.test.js tests\market-signals-upserts.test.js
```

Expected:

- PASS

**Step 4: Commit**

```bash
git add lib/utils/divergence-signals.js lib/repositories/market-signals.js tests/divergence-signals.test.js tests/market-signals-upserts.test.js
git commit -m "feat: add divergence signal logic"
```

### Task 6: Build `calculate:signals` and verify market rows

**Files:**
- Create: `C:\dev\stock-signals\scripts\calculate-signals.js`
- Modify: `C:\dev\stock-signals\package.json`
- Create: `C:\dev\stock-signals\tests\calculate-signals.test.js`

**Step 1: Write the failing integration test**

Cover:

- join breadth + `SP500` + `VIXCLS`
- skip dates missing required inputs
- write one row per valid date
- compute `spx_3d_change`, `spx_14d_change`
- compute `pct_above_50_3d_change`, `pct_above_50_14d_change`
- compute `pct_above_200_14d_change`
- compute `ad_line` and `ad_line_14d_change`
- set divergence statuses

Run:

```powershell
node --test tests\calculate-signals.test.js
```

Expected:

- FAIL

**Step 2: Implement minimal script**

Add `calculate-signals.js` and `package.json` script:

- `calculate:signals`

The script should:

- fail stale running signal jobs if needed
- load market breadth rows
- load FRED `SP500` and `VIXCLS`
- build `market_signal_daily`
- write a run summary to `data_fetch_runs` or a dedicated run log if introduced

**Step 3: Run test**

Run:

```powershell
node --test tests\calculate-signals.test.js
```

Expected:

- PASS

**Step 4: Run a real signal calculation**

Run:

```powershell
$env:NODE_ENV="production"
npm run calculate:signals
```

Expected:

- success
- `market_signal_daily` populated up to the latest valid breadth date

**Step 5: Spot-check real rows**

Use SQL to confirm:

- `spx_close` matches `market_series_daily` for `SP500`
- `vix` matches `market_series_daily` for `VIXCLS`
- A/D line changes match the underlying breadth arithmetic

**Step 6: Commit**

```bash
git add scripts/calculate-signals.js package.json tests/calculate-signals.test.js
git commit -m "feat: calculate daily market signals"
```

### Task 7: Add backtest math helpers with entry/exit edge-case tests

**Files:**
- Create: `C:\dev\stock-signals\lib\utils\backtest-math.js`
- Create: `C:\dev\stock-signals\tests\backtest-math.test.js`

**Step 1: Write the failing test**

Cover:

- derive `adj_open`
- `long -> long`
- `cash -> long`
- `long -> cash`
- `cash -> cash`
- cost subtraction on entry and exit
- no divide-by-zero when `close = 0` or missing values

Run:

```powershell
node --test tests\backtest-math.test.js
```

Expected:

- FAIL

**Step 2: Implement minimal math helpers**

Implement pure functions only:

- `deriveAdjustedOpen(bar)`
- `calculateDailyStrategyReturn(previousState, nextState, previousBar, currentBar, transactionCostBps)`
- `calculateDrawdown(equitySeries)`

**Step 3: Run test**

Run:

```powershell
node --test tests\backtest-math.test.js
```

Expected:

- PASS

**Step 4: Commit**

```bash
git add lib/utils/backtest-math.js tests/backtest-math.test.js
git commit -m "feat: add backtest math helpers"
```

### Task 8: Add backtest repository and strategy seeds

**Files:**
- Create: `C:\dev\stock-signals\lib\repositories\backtests.js`
- Create: `C:\dev\stock-signals\tests\backtest-upserts.test.js`
- Create: `C:\dev\stock-signals\scripts\seed-strategies.js`
- Modify: `C:\dev\stock-signals\package.json`

**Step 1: Write the failing tests**

Cover:

- insert/update strategy definitions
- insert `backtest_runs`
- insert `strategy_positions_daily`
- insert `strategy_equity_daily`
- preserve `(run_id, date)` uniqueness

Run:

```powershell
node --test tests\backtest-upserts.test.js
```

Expected:

- FAIL

**Step 2: Implement repository and seed script**

Seed at least:

- `buy_and_hold_spy`
- `bearish_divergence_cash_v1`
- `bullish_divergence_context_v1`
- `pct_above_50_threshold_v1`

Add package script:

- `seed:strategies`

**Step 3: Run tests**

Run:

```powershell
node --test tests\backtest-upserts.test.js
```

Expected:

- PASS

**Step 4: Seed real rows**

Run:

```powershell
$env:NODE_ENV="production"
npm run seed:strategies
```

Expected:

- strategy definitions inserted/upserted cleanly

**Step 5: Commit**

```bash
git add lib/repositories/backtests.js scripts/seed-strategies.js package.json tests/backtest-upserts.test.js
git commit -m "feat: add strategy definition and backtest storage"
```

### Task 9: Build `backtest:daily` and verify against `SPY` buy-and-hold

**Files:**
- Create: `C:\dev\stock-signals\scripts\backtest-daily.js`
- Create: `C:\dev\stock-signals\tests\backtest-daily.test.js`
- Modify: `C:\dev\stock-signals\package.json`

**Step 1: Write the failing integration test**

Cover:

- strategy reads `market_signal_daily`
- execution starts on next trading day open
- `buy_and_hold_spy` stays long after first eligible date
- cash strategy shows `0%` on flat cash days
- transaction cost only applies on transitions
- `strategy_equity_daily` and `strategy_positions_daily` row counts line up with the benchmark series

Run:

```powershell
node --test tests\backtest-daily.test.js
```

Expected:

- FAIL

**Step 2: Implement minimal runner**

Add package script:

- `backtest:daily`

The runner should:

- load strategy definitions
- load matching signal rows
- load `SPY` benchmark bars
- create a `backtest_runs` row
- materialize positions and equity rows
- calculate summary metrics:
  - `cagr`
  - `max_drawdown`
  - `sharpe`
  - `sortino`
  - `calmar`
  - `turnover`
  - `time_in_market_pct`

**Step 3: Run tests**

Run:

```powershell
node --test tests\backtest-daily.test.js
```

Expected:

- PASS

**Step 4: Run a real backtest**

Run:

```powershell
$env:NODE_ENV="production"
npm run backtest:daily
```

Expected:

- one or more `backtest_runs` with `success`
- populated positions and equity rows

**Step 5: Verify benchmark sanity**

Check that:

- `buy_and_hold_spy` daily return path matches `SPY adj_close` path except for the initial entry cost
- strategy and benchmark dates are aligned

**Step 6: Commit**

```bash
git add scripts/backtest-daily.js package.json tests/backtest-daily.test.js
git commit -m "feat: add daily backtest runner"
```

### Task 10: Wire workflow, document commands, and run full verification

**Files:**
- Modify: `C:\dev\stock-signals\.github\workflows\fetch-daily.yml`
- Modify: `C:\dev\stock-signals\README.md`

**Step 1: Update workflow**

Add, in order:

- `npm run fetch:daily`
- `npm run calculate:daily`
- `npm run calculate:signals`
- `npm run seed:strategies` if definitions are not static
- `npm run backtest:daily`

**Step 2: Update docs**

Document:

- new tables
- new scripts
- verification workflow
- current limitations:
  - `current_constituents`
  - `point_in_time_supported = false`
  - no intraday yet

**Step 3: Run the focused automated test suite**

Run:

```powershell
node --test tests\benchmark-upserts.test.js tests\benchmark-yahoo-parse.test.js tests\fetch-benchmark-flow.test.js tests\divergence-signals.test.js tests\market-signals-upserts.test.js tests\calculate-signals.test.js tests\backtest-math.test.js tests\backtest-upserts.test.js tests\backtest-daily.test.js
```

Expected:

- PASS

**Step 4: Run build**

Run:

```powershell
npm run build
```

Expected:

- PASS

**Step 5: Run end-to-end production-like verification**

Run:

```powershell
$env:NODE_ENV="production"
$env:FETCH_TICKER_LIMIT="5"
npm run fetch:daily
npm run calculate:daily
npm run calculate:signals
npm run seed:strategies
npm run backtest:daily
```

Expected:

- all commands succeed
- `SPY` rows exist
- `market_signal_daily` is populated
- at least one `backtest_runs` row is `success`

**Step 6: External data verification**

For the most recent `SPY` day used in the run, compare DB values against:

- [Yahoo Finance historical data help](https://help.yahoo.com/kb/finance-app-for-ios/download-historical-data-yahoo-finance-sln2311.html)
- [State Street SPDR S&P 500 ETF Trust](https://www.ssga.com/us/en/intermediary/etfs/state-street-spdr-sp-500-etf-trust-spy)

Record:

- checked date
- close
- high
- low
- volume
- whether the DB row matched exactly

**Step 7: Commit**

```bash
git add .github/workflows/fetch-daily.yml README.md
git commit -m "docs: wire signal and backtest daily workflow"
```

Plan complete and saved to `docs/plans/2026-05-06-signal-backtest-foundation.md`. Two execution options:

**1. Subagent-Driven (this session)** - I dispatch fresh subagent per task, review between tasks, fast iteration

**2. Parallel Session (separate)** - Open new session with executing-plans, batch execution with checkpoints

Which approach?
