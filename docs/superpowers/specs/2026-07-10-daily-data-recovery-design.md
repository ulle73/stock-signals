# Daily data recovery

## Goal

Keep the daily signal pipeline automatic without repeatedly querying Yahoo when stored source data is already current. A failed or incomplete end-of-day source refresh must be retried later automatically. A downstream-calculation gap must be repaired from stored data and must never trigger another full Yahoo fetch.

## Constraints and evidence

- The current `Fetch Daily Market Data` workflow is scheduled four times per US trading day. Every scheduled trigger starts a GitHub Actions run, even if the refresh gate later skips its data work.
- On 2026-07-09, a successful source refresh stored 2026-07-08 prices, but the next gate found `market_signal_daily` still dated 2026-07-07. The current all-or-nothing gate therefore started a second full source fetch even though raw prices and SPY were current.
- On the failed 2026-07-09 run, Yahoo returned 429 for the first batch of five ticker requests and then for all 507 ticker requests, SPY, and all IV-proxy assets. `fetch:daily` recorded this as `partial_success`, allowing the pipeline to continue until the IV script failed hard.
- GitHub-hosted runners have dynamic, shared egress IPs. Yahoo access is therefore external and inherently retryable, not guaranteed.
- The existing data-fetch pipeline remains the source of truth. No raw-table, provider, or indicator-rule rewrite is in scope.

## Design

### 1. Primary and recovery windows

Keep the existing post-close window as the primary run. Treat the three later windows as recovery checks rather than equivalent full refreshes.

| Window | Existing UTC schedule | Purpose |
| --- | --- | --- |
| Primary | `53 21 * * 1-5` | Fetch the new US end-of-day data and run the full downstream pipeline. |
| Recovery 1 | `23 23 * * 1-5` | Retry only if the primary left raw data incomplete; otherwise repair only derived data if needed. |
| Recovery 2 | `23 3 * * 2-6` | Repeat the same state-aware recovery after a longer cooldown. |
| Recovery 3 | `43 12 * * 2-6` | Final automated recovery before the next US session. |

The checks still appear in GitHub Actions because GitHub Actions scheduling is time-based. In a healthy system they perform only the short database gate; they do not call Yahoo. This preserves automatic recovery without holding a runner asleep or creating an external scheduler.

### 2. Replace the boolean gate with explicit execution modes

`check:daily-refresh-needed` will continue to determine the expected US market date, but will return one of these modes instead of only `refresh_skip`:

- `skip`: raw source data has complete coverage and all required derived outputs are current.
- `fetch_and_calculate`: the expected raw price/benchmark data is absent, stale, or incomplete. Run the complete existing fetch and calculation path.
- `calculate_only`: raw price and benchmark data are complete, but market/position derived outputs are stale. Run the existing calculation jobs only; make no Yahoo/FRED/OCC/FINRA/Barchart request.
- `defer`: a `fetch_daily` run is already marked running. Do not duplicate it; let the next recovery window reassess state.

Raw-source readiness must require all of the following for the expected market date:

- `stock_daily_prices` is current and its ticker count equals the active constituent count. This matches the existing data-quality definition of full daily-price coverage.
- `benchmark_daily_prices` contains current SPY data.

Derived readiness is then evaluated separately for `market_signal_daily` and `position_signal_daily`. It must not influence whether source data is fetched again.

### 3. Failure semantics and Yahoo rate-limit handling

The primary source job must fail, rather than report `partial_success`, when core price coverage or SPY is incomplete for the expected date. Downstream signals, backtests, paper execution, and pruning must not run from an incomplete core dataset.

For a Yahoo 429 response:

1. Detect it as a retryable provider-rate-limit failure.
2. Stop dispatching further ticker work for that source run instead of sending the remaining universe into a known block.
3. Persist the failure reason and completed/failed counts in `data_fetch_runs`.
4. Exit the source job as failed. A later recovery window creates a fresh runner and reassesses freshness before attempting another fetch.

The design intentionally avoids a long in-run sleep/retry loop. That would consume Actions minutes and normally preserve the same runner/IP that Yahoo rejected. The spaced recovery windows supply the cooldown and a new runner.

The same shared Yahoo failure classification should be used by the IV-proxy and macro-proxy fetch steps so a provider block is visible as one controlled failure instead of hundreds of independent errors.

### 4. Workflow routing

- `fetch-and-calculate-daily` runs only for `fetch_and_calculate`.
- `calculate-derived-signals` runs for `fetch_and_calculate` and `calculate_only`; its dependency conditions must allow the calculate-only path when the fetch job is intentionally skipped.
- Backtests, paper strategies, and history pruning run only after the derived calculations have completed successfully for either eligible mode.
- `skip` and `defer` finish after the gate and write a clear log summary describing why no source request was made.

The existing concurrency group remains in place so two recovery windows cannot fetch concurrently.

### 5. Observability

Each gate run will log and expose in the job summary:

- expected market date;
- execution mode and reason;
- latest raw, benchmark, market-signal, and position-signal dates;
- active-ticker count and stored-ticker count for the expected date;
- whether a recovery was needed because of source incompleteness or derived-data staleness.

Each provider-rate-limit failure records a machine-readable failure type, HTTP status when available, and the number of requests suppressed by the circuit breaker. Secrets and response bodies are never logged.

## Verification

- Unit-test the execution-mode decision for complete data, stale raw data, incomplete ticker coverage, stale derived data, and an already-running fetch.
- Unit-test that a 429 stops new Yahoo ticker dispatch and produces a retryable failure result.
- Exercise workflow conditions with a dry-run/mocked gate output for `fetch_and_calculate`, `calculate_only`, `skip`, and `defer`.
- Run the affected unit tests and inspect the workflow YAML to verify that calculate-only cannot invoke any fetch command.
- Trigger a controlled manual run against the existing stored data and confirm the job summary reports the selected mode and coverage.

## Out of scope

- Replacing Yahoo Finance or adding a paid backup data provider.
- Changing raw data schemas, existing indicator rules, Telegram behavior, or backtest strategy rules.
- Claiming that Yahoo availability can be guaranteed. This design guarantees automatic detection and bounded recovery attempts; a true data-availability guarantee requires a permitted provider with contractual reliability.
