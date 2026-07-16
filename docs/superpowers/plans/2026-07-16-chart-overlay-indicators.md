# Chart Overlay Indicators Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add TF Sync, PLCE/PUT-volume extremes, CVOL call-volume extremes, and the 2Y+10Y yield state indicator to the professional chart as independently revertible overlay layers.

**Architecture:** Extend the existing `/api/chart-data` contract with stored ticker-specific and market-wide daily signal fields. Each indicator owns a pure marker/anchor transformation module under `lib/chart/`, while `financial-chart.js` only creates invisible anchor series, attaches markers, and controls visibility. Market-wide overlays are joined by date in the server repository; the 2Y+10Y indicator gets a deterministic stored calculation layer before it is exposed to the chart.

**Tech Stack:** Next.js 16, React, Node test runner, PostgreSQL, TradingView Lightweight Charts 5.2, GitHub Actions.

## Global Constraints

- Work only on `codex/chart-overlay-indicators-v1`.
- Production commit order is fixed: TF Sync, PLCE, CVOL, 2Y+10Y.
- One production commit and push per indicator; no production commit may contain two indicators.
- Reuse stored signals; do not recalculate TF Sync, PLCE, or CVOL in the browser.
- 2Y+10Y state logic must be calculated deterministically server-side and stored or produced by a repository layer, never only in React.
- No entries, stops, targets, position sizing, or advice.
- Marker series must have no title, price line, last-value badge, or crosshair dot.
- Markers must use deterministic price anchors and never touch candles.
- Missing optional indicator data must not break price, MA, volume, or RYD OBV rendering.
- Every production commit must pass focused tests, the full Node test suite, and `npm run build` before the next indicator begins.

---

### Task 1: TF Sync top-lane markers

**Files:**
- Create: `lib/chart/tf-sync-markers.js`
- Create: `tests/chart-tf-sync-markers.test.js`
- Modify: `lib/repositories/chart-data.js`
- Modify: `lib/chart/normalize-chart-data.js`
- Modify: `lib/chart/series-registry.js`
- Modify: `app/chart/chart-toolbar.js`
- Modify: `app/chart/chart-workspace.js`
- Modify: `app/chart/financial-chart.js`
- Modify: `app/chart/crosshair-legend.js`
- Modify: `tests/chart-data-normalization.test.js`
- Modify: `tests/chart-series-registry.test.js`

**Interfaces:**
- Consumes stored `tf_sync_buy_signal`, `tf_sync_sell_signal`, `tf_sync_buy_active`, `tf_sync_sell_active`, and `tf_sync_signal` from `stock_daily_indicators`.
- Produces `buildTfSyncAnchorData(bars)`, `buildTfSyncMarkers(bars)`, and registry key `tfSync`.
- Chart workspace tracks `visibleSignals`, defaulting to `['tfSync']`.

- [ ] **Step 1: Write failing pure-helper tests.**

Test that a buy signal produces a green downward triangle, a sell signal produces a red downward triangle, both use a top-lane anchor above the candle high, invalid/missing rows are skipped, and the anchor gap is deterministic from candle range with a close-percentage fallback.

- [ ] **Step 2: Run focused test and confirm RED.**

Run: `node --test tests/chart-tf-sync-markers.test.js`
Expected: FAIL because `lib/chart/tf-sync-markers.js` does not exist.

- [ ] **Step 3: Implement pure TF Sync marker helpers.**

Use a top-lane anchor formula:

```js
const range = Math.max(0, high - low);
const fallback = Math.abs(close) * 0.015;
const gap = Math.max(range * 0.9, fallback, 0.01);
anchor = high + gap * 3.2;
```

Markers:

```js
buy  -> { position: 'aboveBar', shape: 'arrowDown', color: '#55ff55' }
sell -> { position: 'aboveBar', shape: 'arrowDown', color: '#ff3b3b' }
```

- [ ] **Step 4: Extend SQL and normalization with stored TF Sync fields.**

Select fields from the existing `stock_daily_indicators` join. Normalize booleans strictly and normalize signal values to `buy | sell | buy_active | sell_active | none`.

- [ ] **Step 5: Add registry and toolbar signal control.**

Add:

```js
SIGNAL_KEYS = ['tfSync']
DEFAULT_VISIBLE_SIGNALS = ['tfSync']
CHART_SERIES.tfSync = { key: 'tfSync', label: 'TF Sync', kind: 'markers', pane: 0, color: '#55ff55' }
```

Add a `Signaler` toolbar group independent from MA overlays and lower-pane indicators.

- [ ] **Step 6: Render an invisible pane-0 anchor series and attach markers.**

The series must use transparent color, no price line, no title, no last value, no crosshair marker, and visibility controlled by `visibleSignals`.

- [ ] **Step 7: Extend crosshair legend with event-only TF Sync copy.**

Only on signal dates display `TF Sync: Grön` or `TF Sync: Röd`.

- [ ] **Step 8: Run focused tests, full suite, and production build.**

Run:

```bash
node --test tests/chart-tf-sync-markers.test.js tests/chart-data-normalization.test.js tests/chart-series-registry.test.js
node --test tests/*.test.js
npm run build
```

Expected: all PASS.

- [ ] **Step 9: Commit exactly the TF Sync vertical slice.**

Commit message:

```text
feat(chart): add TF Sync markers
```

---

### Task 2: PLCE / PUT volume extreme markers

**Files:**
- Create: `lib/chart/plce-volume-markers.js`
- Create: `tests/chart-plce-volume-markers.test.js`
- Modify: `lib/repositories/chart-data.js`
- Modify: `lib/chart/normalize-chart-data.js`
- Modify: `lib/chart/series-registry.js`
- Modify: `app/chart/chart-workspace.js`
- Modify: `app/chart/financial-chart.js`
- Modify: `app/chart/crosshair-legend.js`
- Modify: `tests/chart-data-normalization.test.js`
- Modify: `tests/chart-series-registry.test.js`

**Interfaces:**
- Consumes stored `plce_threshold_value`, `plce_threshold_buy_signal`, and `plce_threshold_signal` from the existing daily indicator row.
- Produces `buildPlceAnchorData(bars)`, `buildPlceMarkers(bars)`, and registry key `plceVolumeExtreme`.

- [ ] **Step 1: Write failing tests for market-wide PLCE marker presentation.**

Test one large blue upward triangle below the candle, guaranteed gap, no marker without the stored boolean, and no duplicate marker.

- [ ] **Step 2: Run focused test and confirm RED.**

Run: `node --test tests/chart-plce-volume-markers.test.js`
Expected: missing module failure.

- [ ] **Step 3: Implement pure anchor and marker helpers.**

Use below-price tier 1:

```js
anchor = low - Math.max(range * 0.8, Math.abs(close) * 0.012, 0.01);
marker = { position: 'belowBar', shape: 'arrowUp', color: '#0004ff', size: 2 };
```

- [ ] **Step 4: Extend chart data and normalization.**

Preserve finite threshold values and strict stored booleans. Missing values produce no marker.

- [ ] **Step 5: Register `plceVolumeExtreme` and enable it by default.**

Toolbar label: `PUT volym extrem`.

- [ ] **Step 6: Render a dedicated invisible anchor series.**

It must be independently toggleable and occupy pane 0.

- [ ] **Step 7: Add event-only legend copy.**

Display `PUT volym extrem` only on matching dates.

- [ ] **Step 8: Run focused tests, full suite, and build.**

- [ ] **Step 9: Commit exactly the PLCE vertical slice.**

Commit message:

```text
feat(chart): add PLCE volume-extreme markers
```

---

### Task 3: CVOL call-volume extreme markers

**Files:**
- Create: `lib/chart/cvol-markers.js`
- Create: `tests/chart-cvol-markers.test.js`
- Modify: `lib/repositories/chart-data.js`
- Modify: `lib/chart/normalize-chart-data.js`
- Modify: `lib/chart/series-registry.js`
- Modify: `app/chart/chart-workspace.js`
- Modify: `app/chart/financial-chart.js`
- Modify: `app/chart/crosshair-legend.js`
- Modify: `tests/chart-data-normalization.test.js`
- Modify: `tests/chart-series-registry.test.js`

**Interfaces:**
- Consumes date-level rows from `cvol_call_volume_indicator_daily` (or the actual repository table name confirmed during implementation): `cvol_sell_signal_1`, `cvol_sell_signal_2`, `cvol_sell_signal_3`, and `cvol_signal`.
- Produces one marker per date via `buildCvolAnchorData(bars)` and `buildCvolMarkers(bars)`.

- [ ] **Step 1: Inspect the actual CVOL repository/migration table and lock the join.**

The SQL must use the repository's current table and date column. Do not create a duplicate table.

- [ ] **Step 2: Write failing tests.**

Test blue downward marker above candle; multiple stored booleans collapse to one marker; `multiple_sell_signals` uses the larger marker size; no signal yields no marker.

- [ ] **Step 3: Run focused test and confirm RED.**

- [ ] **Step 4: Implement pure helper module.**

Use above-price tier 1:

```js
anchor = high + Math.max(range * 0.85, Math.abs(close) * 0.012, 0.01);
marker = { position: 'aboveBar', shape: 'arrowDown', color: '#0004ff', size: multiple ? 2 : 1 };
```

- [ ] **Step 5: Add an isolated date join in `chart-data.js`.**

Join market-wide CVOL data by chart date without changing ticker price semantics. If the optional CVOL table is unavailable, log a warning and return chart bars without CVOL instead of failing the endpoint.

- [ ] **Step 6: Normalize CVOL fields and register `cvolExtreme`.**

Toolbar label: `CVOL extrem`; visible by default when data exists.

- [ ] **Step 7: Render dedicated marker series and legend event.**

- [ ] **Step 8: Run focused tests, full suite, and build.**

- [ ] **Step 9: Commit exactly the CVOL vertical slice.**

Commit message:

```text
feat(chart): add CVOL call-volume markers
```

---

### Task 4: 2Y + 10Y yield state and markers

**Files:**
- Create: `lib/indicators/yield-2y-10y.js`
- Create: `lib/chart/yield-2y-10y-markers.js`
- Create: `lib/repositories/yield-2y-10y-indicator.js`
- Create: `tests/yield-2y-10y-indicator.test.js`
- Create: `tests/chart-yield-2y-10y-markers.test.js`
- Create or modify migration: use the next repository migration number for `yield_2y_10y_indicator_daily`
- Modify the existing daily macro calculation/fetch orchestration at the smallest integration point
- Modify: `lib/repositories/chart-data.js`
- Modify: `lib/chart/normalize-chart-data.js`
- Modify: `lib/chart/series-registry.js`
- Modify: `app/chart/chart-workspace.js`
- Modify: `app/chart/financial-chart.js`
- Modify: `app/chart/crosshair-legend.js`
- Modify relevant repository/upsert tests

**Interfaces:**
- Consumes daily DGS2, DGS10, and FEDFUNDS (or verified approved equivalent) values sorted ascending by date.
- Produces stored rows with `date`, `two_year`, `ten_year`, `effr`, `frr_2_10`, `is_long`, `is_short`, `is_inverted`, `buy_signal`, `sell_signal`, and `signal`.
- Produces chart helpers `buildYieldAnchorData(bars)` and `buildYieldMarkers(bars)`.

- [ ] **Step 1: Verify exact stored market-series table, series IDs, and refresh path.**

Use existing FRED rows where possible. Only add missing source configuration if a required series is not already refreshed.

- [ ] **Step 2: Write failing deterministic state-machine tests.**

Cover:

```text
FRR2_10 = (5 * tenYear - twoYear) / (4 * tenYear)
inverted when FRR2_10 < 1
buy when !isLong && FRR2_10 > 1.10 && smoothEFFR < EFFR && prevSmoothEFFR >= prevEFFR
sell when !isShort && isInverted && FRR2_10 > 1.005
```

Use sorted rows and prove state persistence across non-signal dates.

- [ ] **Step 3: Implement the pure state machine.**

Use a five-row simple moving average for current EFFR and the Pine-equivalent prior shifted series. Fail closed on missing/non-finite required inputs.

- [ ] **Step 4: Add migration and repository upsert/read functions.**

Unique key: `date`. Preserve source values and state fields. Parameterize all SQL.

- [ ] **Step 5: Integrate calculation after required macro rows are available.**

The integration must be idempotent and must not change unrelated fetch behavior.

- [ ] **Step 6: Write failing marker tests.**

Buy: very large white upward triangle below candles on tier 2. Sell: very large white downward triangle above candles on tier 2. Both must have greater gap than PLCE/CVOL.

- [ ] **Step 7: Implement chart marker helpers.**

Use tier 2 offsets:

```js
buyAnchor = low - Math.max(range * 1.8, Math.abs(close) * 0.025, 0.02);
sellAnchor = high + Math.max(range * 1.8, Math.abs(close) * 0.025, 0.02);
marker color = '#ffffff'; marker size = 3;
```

- [ ] **Step 8: Join stored daily yield signals into chart data.**

The layer is market-wide and appears on all ticker charts by matching date.

- [ ] **Step 9: Register `yield2y10y`, render its anchor series, and add event-only legend copy.**

Toolbar label: `2Y + 10Y`; visible by default when data exists.

- [ ] **Step 10: Run focused tests, full suite, migration contract tests, and build.**

- [ ] **Step 11: Commit exactly the 2Y+10Y vertical slice.**

Commit message:

```text
feat(chart): add 2Y 10Y yield markers
```

---

### Task 5: Final branch verification and PR

**Files:**
- Temporarily create then remove a branch-only CI workflow if no existing workflow runs tests/build for this branch.
- Update or create a draft PR from `codex/chart-overlay-indicators-v1` to `main`.

- [ ] **Step 1: Verify commit isolation.**

Confirm the four production commits exist in the required order and each diff contains only its own indicator vertical slice.

- [ ] **Step 2: Run the complete test suite and production build on final branch head.**

```bash
node --test tests/*.test.js
npm run build
```

- [ ] **Step 3: Verify chart API payload with a real ticker/date range.**

Confirm ticker-specific TF Sync and date-level PLCE/CVOL/yield fields return without breaking existing RYD data.

- [ ] **Step 4: Check deployment/runtime logs.**

No new chart endpoint errors or SQL relation errors are acceptable.

- [ ] **Step 5: Remove temporary CI workflow and ensure application code is unchanged after the final green verification commit.**

- [ ] **Step 6: Open/update draft PR with commit-by-commit rollback instructions.**
