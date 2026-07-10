# Daily Data Recovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the scheduled daily pipeline retry incomplete raw data automatically without re-fetching Yahoo data when only derived signal rows are stale.

**Architecture:** The refresh gate returns an execution mode (`skip`, `fetch_and_calculate`, `calculate_only`, or `defer`) based on raw-data freshness/coverage separately from derived-signal freshness. The workflow routes each mode to the smallest valid job path. Yahoo 429 responses become typed, retryable failures and open a per-run circuit breaker so the runner stops issuing known-doomed ticker requests; later scheduled recovery windows retry on a fresh runner.

**Tech Stack:** Node.js 22 ESM, Node built-in test runner, PostgreSQL via existing repositories, GitHub Actions YAML.

## Global Constraints

- Preserve the existing raw price tables, fetch sources, indicators, signal rules, backtests, and Telegram behavior.
- Retain the four existing UTC schedule windows; recovery windows may start a gate but may not call Yahoo unless raw data is stale or incomplete.
- Treat full active-universe price coverage and current SPY data as required source readiness.
- Never run derived calculations, backtests, paper strategies, or pruning after a failed source-refresh path.
- Use `adj_close ?? close` only where existing indicator code already does so; this task adds no indicator calculation.
- Log no secrets, response bodies, or database URLs.

---

### Task 1: Introduce explicit refresh execution modes

**Files:**
- Modify: `lib/utils/daily-refresh-check.js:3-69`
- Modify: `scripts/check-daily-refresh-needed.js:10-55`
- Modify: `tests/daily-refresh-check.test.js`

**Interfaces:**
- Produces `DAILY_REFRESH_EXECUTION_MODES` with string values `skip`, `fetch_and_calculate`, `calculate_only`, and `defer`.
- `buildDailyRefreshDecision(options)` accepts `priceTickerCountForExpectedDate`, `activeTickerCount`, and optional `expectedLatestMarketDate`; it returns `{ executionMode, refreshNeeded, rawDataNeeded, derivedCalculationNeeded, staleTargets, sourceStaleTargets, derivedStaleTargets, reason }`.
- `check:daily-refresh-needed` writes `execution_mode`, `refresh_skip`, expected date, coverage counts, and reason to `GITHUB_OUTPUT`.

- [ ] **Step 1: Write failing execution-mode tests**

Add these tests to `tests/daily-refresh-check.test.js`:

```js
import { DAILY_REFRESH_EXECUTION_MODES, buildDailyRefreshDecision } from '../lib/utils/daily-refresh-check.js';

test('requests source fetch when expected-date ticker coverage is incomplete', () => {
  const decision = buildDailyRefreshDecision({
    latestPriceDate: '2026-06-16',
    latestBenchmarkDate: '2026-06-16',
    latestMarketSignalDate: '2026-06-16',
    latestPositionSignalDate: '2026-06-16',
    priceTickerCountForExpectedDate: 506,
    activeTickerCount: 507,
    now: afterCloseNow,
  });

  assert.equal(decision.executionMode, DAILY_REFRESH_EXECUTION_MODES.FETCH_AND_CALCULATE);
  assert.equal(decision.rawDataNeeded, true);
});

test('requests calculations only when raw data is current but market signals are stale', () => {
  const decision = buildDailyRefreshDecision({
    latestPriceDate: '2026-06-16', latestBenchmarkDate: '2026-06-16',
    latestMarketSignalDate: '2026-06-15', latestPositionSignalDate: '2026-06-16',
    priceTickerCountForExpectedDate: 507, activeTickerCount: 507, now: afterCloseNow,
  });

  assert.equal(decision.executionMode, DAILY_REFRESH_EXECUTION_MODES.CALCULATE_ONLY);
  assert.equal(decision.rawDataNeeded, false);
  assert.equal(decision.derivedCalculationNeeded, true);
});
```

- [ ] **Step 2: Verify the tests fail for the missing execution-mode API**

Run: `node --test tests/daily-refresh-check.test.js`

Expected: FAIL because `DAILY_REFRESH_EXECUTION_MODES` and `executionMode` do not yet exist.

- [ ] **Step 3: Implement the pure decision logic**

In `lib/utils/daily-refresh-check.js`, define the exported mode constant and partition targets into source and derived groups. Source targets are current daily prices, full `priceTickerCountForExpectedDate === activeTickerCount`, and current SPY; derived targets are current market and position signal rows. Compute the first applicable mode in this order: `defer` for a running source fetch, `fetch_and_calculate` for any stale/incomplete source target, `calculate_only` for stale derived targets, otherwise `skip`. Keep `refreshNeeded` true only for the two executable modes.

- [ ] **Step 4: Pass actual coverage to the gate script**

In `scripts/check-daily-refresh-needed.js`, obtain the expected market date with `getExpectedLatestUsEquityMarketDate`, query the active constituent count and the distinct stored ticker count for that exact date, then pass both counts and the expected date into `buildDailyRefreshDecision`. Add output lines:

```js
writeOutput('execution_mode', decision.executionMode);
writeOutput('price_ticker_count', snapshot.priceTickerCountForExpectedDate ?? '');
writeOutput('active_ticker_count', snapshot.activeTickerCount ?? '');
```

Preserve `refresh_skip` for existing workflow compatibility, deriving it from `decision.refreshNeeded`.

- [ ] **Step 5: Verify the gate tests pass**

Run: `node --test tests/daily-refresh-check.test.js`

Expected: PASS, including current-data skip, stale raw data fetch, incomplete coverage fetch, stale-derived calculate-only, and running-fetch defer behavior.

- [ ] **Step 6: Commit the gate behavior**

```bash
git add lib/utils/daily-refresh-check.js scripts/check-daily-refresh-needed.js tests/daily-refresh-check.test.js
git commit -m "feat: classify daily refresh execution modes"
```

### Task 2: Stop Yahoo work after a rate-limit response

**Files:**
- Modify: `lib/sources/yahoo.js:86-100`
- Create: `lib/utils/yahoo-fetch-circuit.js`
- Modify: `scripts/fetch-daily.js:44-103,161-238`
- Modify: `scripts/fetch-implied-volatility-proxy.js:26-112`
- Modify: `scripts/fetch-macro-matrix-yahoo-proxy.js:34-110`
- Create: `tests/yahoo-rate-limit.test.js`

**Interfaces:**
- `YahooRateLimitError` is exported by `lib/sources/yahoo.js`, has `code === 'YAHOO_RATE_LIMIT'`, `status === 429`, `ticker`, and optional `retryAfter`.
- `isYahooRateLimitError(error)` and `createYahooFetchCircuit()` are exported by `lib/utils/yahoo-fetch-circuit.js`.
- The circuit exposes `{ isOpen(), open(error), suppressedCount }` and stops new item assignment after the first rate-limit error.

- [ ] **Step 1: Write failing Yahoo 429 and circuit-breaker tests**

Create `tests/yahoo-rate-limit.test.js` with a mocked `globalThis.fetch` that returns `new Response('', { status: 429, statusText: 'Too Many Requests', headers: { 'retry-after': '60' } })`. Assert that `fetchYahooDailyCandles('SPY')` rejects with `YahooRateLimitError`, code `YAHOO_RATE_LIMIT`, ticker `SPY`, and retry-after `60`. Add a second test that opens a fresh circuit and asserts later items are not assigned after the first `YahooRateLimitError`.

- [ ] **Step 2: Verify the tests fail**

Run: `node --test tests/yahoo-rate-limit.test.js`

Expected: FAIL because the typed error and circuit helper do not exist.

- [ ] **Step 3: Implement the typed provider error and circuit helper**

Make `fetchYahooDailyCandles` throw `YahooRateLimitError` only for HTTP 429; preserve the existing generic error for every other non-OK response. Implement the circuit helper without retries or sleeps. It must count items withheld after it is opened and leave already in-flight items to finish.

- [ ] **Step 4: Apply the circuit to each daily Yahoo source path**

Replace `fetch-daily.js`'s local concurrency recursion with the circuit-aware helper. On a 429, stop assigning subsequent ticker fetches, skip the SPY request, persist a `failure` fetch run with `errorMessage`, failed/successful/suppressed counts, and throw so the workflow stops before downstream jobs.

In the IV-proxy and macro-proxy scripts, detect the same typed error, stop their remaining Yahoo loop/chunk, finish their fetch run as `failure`, and rethrow. Continue existing partial-success behavior only for non-rate-limit, per-item failures.

- [ ] **Step 5: Verify targeted tests pass**

Run: `node --test tests/yahoo-rate-limit.test.js tests/yahoo-url.test.js tests/fetch-benchmark-flow.test.js`

Expected: PASS. The 429 test proves the first error opens the circuit; existing URL and benchmark behavior remains unchanged.

- [ ] **Step 6: Commit the provider-failure behavior**

```bash
git add lib/sources/yahoo.js lib/utils/yahoo-fetch-circuit.js scripts/fetch-daily.js scripts/fetch-implied-volatility-proxy.js scripts/fetch-macro-matrix-yahoo-proxy.js tests/yahoo-rate-limit.test.js
git commit -m "fix: stop daily Yahoo fetches after rate limits"
```

### Task 3: Route workflow jobs by execution mode

**Files:**
- Modify: `.github/workflows/fetch-daily.yml:52-332`
- Create: `tests/fetch-daily-workflow.test.js`

**Interfaces:**
- `check-refresh-needed` exposes `execution_mode`, `price_ticker_count`, and `active_ticker_count` as job outputs.
- A full source job runs only when `execution_mode == 'fetch_and_calculate'`.
- Derived jobs run when the mode is `fetch_and_calculate` with a successful source job, or `calculate_only` without any source job.

- [ ] **Step 1: Write failing workflow-contract tests**

Create `tests/fetch-daily-workflow.test.js` that reads `.github/workflows/fetch-daily.yml` and asserts it contains the `execution_mode` output, a fetch-job condition for `fetch_and_calculate`, a derived-job condition that accepts `calculate_only`, and no fetch command in the calculate-only branch. Keep the assertions textual so no YAML dependency is added.

- [ ] **Step 2: Verify the workflow-contract test fails**

Run: `node --test tests/fetch-daily-workflow.test.js`

Expected: FAIL because the workflow only uses `refresh_skip`.

- [ ] **Step 3: Route the YAML jobs**

Expose the new gate outputs. Set `fetch-and-calculate-daily` to run only for `fetch_and_calculate`. Set `calculate-derived-signals` to `if: always()` and allow either a successful fetch-and-calculate path or a calculate-only path. Gate backtests, paper strategies, and pruning on a successful derived job and an executable mode. Keep each source-fetch command exclusively inside `fetch-and-calculate-daily`.

For forced `workflow_dispatch`, output `execution_mode=fetch_and_calculate` along with the existing forced values. Add the mode, counts, and reason to the log-refresh-decision step and `$GITHUB_STEP_SUMMARY`.

- [ ] **Step 4: Verify workflow routing**

Run: `node --test tests/fetch-daily-workflow.test.js tests/daily-refresh-check.test.js`

Expected: PASS. A stale signal can select `calculate_only`; YAML then has no eligible Yahoo-fetch job for that mode.

- [ ] **Step 5: Commit workflow recovery routing**

```bash
git add .github/workflows/fetch-daily.yml tests/fetch-daily-workflow.test.js
git commit -m "feat: run targeted daily data recovery"
```

### Task 4: Document and verify the operational behavior

**Files:**
- Modify: `README.md`
- Modify: `docs/superpowers/specs/2026-07-10-daily-data-recovery-design.md` only if implementation intentionally differs from the approved design

- [ ] **Step 1: Add a concise operations note**

Add a README section stating that the first post-close schedule is the primary refresh; later schedule windows are automatic recovery checks; stale raw data triggers a source retry; stale derived data triggers calculations only; a Yahoo 429 is retried in a later recovery window rather than immediately hammering the provider.

- [ ] **Step 2: Run the complete relevant test suite**

Run: `node --test tests/daily-refresh-check.test.js tests/yahoo-rate-limit.test.js tests/yahoo-url.test.js tests/fetch-benchmark-flow.test.js tests/fetch-daily-workflow.test.js`

Expected: PASS with no test failures.

- [ ] **Step 3: Validate the final diff and CodeGraph impact**

Run:

```bash
git diff origin/main...HEAD --check
codegraph sync
codegraph impact buildDailyRefreshDecision
codegraph impact fetchYahooDailyCandles
```

Expected: only the gate, daily Yahoo source handling, workflow, focused tests, README, and approved design/plan documentation are affected.

- [ ] **Step 4: Commit documentation and verification updates**

```bash
git add README.md docs/superpowers/specs/2026-07-10-daily-data-recovery-design.md
git commit -m "docs: explain automatic daily data recovery"
```

## Plan self-review

- Spec coverage: Tasks 1 and 3 implement source-versus-derived routing; Task 2 implements controlled Yahoo rate-limit failure; Task 4 documents and verifies the user-visible schedule behavior.
- Placeholder scan: no deferred implementation markers or generic error-handling instructions remain; each task names files, interfaces, commands, and expected results.
- Interface consistency: the workflow consumes the `execution_mode` output produced by Task 1; Task 2 uses the typed Yahoo error exported by the source layer; later jobs rely on Task 3's derived-job result.
