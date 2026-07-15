# RYD OBV Chart Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the existing RYD OBV Z-score histogram, signals, threshold guides, and optional raw OBV line as a third synchronized pane in the professional chart workspace.

**Architecture:** Extend the existing chart API payload with stored RYD fields, normalize them alongside price bars, and keep all RYD-specific presentation transformations in a pure helper module. The Lightweight Charts client adds a third pane, attaches markers and price lines to the Z-score histogram, and exposes raw OBV through an independent left price scale.

**Tech Stack:** Next.js 16, React, Node test runner, PostgreSQL, TradingView Lightweight Charts 5.2.

## Global Constraints

- Work only on `codex/professional-chart-v1`.
- Reuse stored RYD OBV values; do not recalculate the indicator in the UI or repository.
- Do not modify the data-fetch pipeline, migrations, thresholds, signal rules, portfolio logic, or recommendation logic.
- Z-score is visible by default; raw OBV is off by default.
- Missing RYD data must not break price, volume, or MA rendering.
- Match the supplied TradingView histogram colors and signal-arrow direction.

---

### Task 1: Pure RYD chart transformations

**Files:**
- Create: `tests/chart-ryd-obv-panel.test.js`
- Create: `lib/chart/ryd-obv-series.js`

**Interfaces:**
- Consumes chart bars containing `time`, `ryd_obv`, `ryd_obv_zscore_80`, `ryd_obv_buy_signal`, and `ryd_obv_sell_signal`.
- Produces `RYD_OBV_LEVELS`, `getRydObvZscoreColor(value)`, `buildRydObvHistogramData(bars)`, `buildRawObvLineData(bars)`, and `buildRydObvMarkers(bars)`.

- [ ] **Step 1: Write failing tests for thresholds, colors, data gaps, raw line values, and markers.**
- [ ] **Step 2: Run `node --test tests/chart-ryd-obv-panel.test.js` and confirm imports/functions fail.**
- [ ] **Step 3: Implement the pure helper module with exact boundary behavior.**
- [ ] **Step 4: Run the focused test and confirm it passes.**
- [ ] **Step 5: Commit the helper and tests.**

### Task 2: Extend the server chart contract

**Files:**
- Modify: `lib/repositories/chart-data.js`
- Modify: `lib/chart/normalize-chart-data.js`
- Modify: `tests/chart-data-normalization.test.js`

**Interfaces:**
- SQL returns RYD values as text/boolean fields from `stock_daily_indicators`.
- Normalized bars expose finite numbers, booleans, and `buy | sell | none` signal values.

- [ ] **Step 1: Add failing normalization assertions for RYD fields and warmup nulls.**
- [ ] **Step 2: Run the chart normalization tests and confirm failure.**
- [ ] **Step 3: Add the five RYD columns to the existing parameterized chart query.**
- [ ] **Step 4: Normalize finite numbers, strict booleans, and allowed signal values.**
- [ ] **Step 5: Run focused tests and commit.**

### Task 3: Register indicator series and toolbar controls

**Files:**
- Modify: `lib/chart/series-registry.js`
- Modify: `app/chart/chart-toolbar.js`
- Modify: `app/chart/chart-workspace.js`
- Modify: `tests/chart-series-registry.test.js`

**Interfaces:**
- Registry adds `rydObvZscore` on pane 2 and `rydObvRaw` on pane 2.
- Workspace tracks `visibleIndicators`, defaulting to `['rydObvZscore']`.
- Toolbar receives availability and toggle callbacks independently from MA overlays.

- [ ] **Step 1: Add failing registry/default tests.**
- [ ] **Step 2: Implement registry definitions and defaults.**
- [ ] **Step 3: Add `Indikatorer` controls with disabled states for missing data.**
- [ ] **Step 4: Pass indicator visibility into `FinancialChart`.**
- [ ] **Step 5: Run focused tests and commit.**

### Task 4: Render the RYD pane

**Files:**
- Modify: `lib/chart/chart-theme.js`
- Modify: `app/chart/financial-chart.js`
- Modify: `app/chart/crosshair-legend.js`
- Modify: `app/chart/chart.css`

**Interfaces:**
- Z-score histogram uses the pure helper data and right price scale.
- Raw OBV line uses `priceScaleId: 'left'` and follows the raw visibility toggle.
- `createSeriesMarkers` attaches stored signals to the Z-score series.
- `createTextWatermark` adds the pane title.
- Z-score series owns horizontal price lines at `0`, `±1.25`, `±2.70`, and `±6.0`.

- [ ] **Step 1: Add Lightweight Charts 5.2 imports and theme option factories.**
- [ ] **Step 2: Create pane-2 histogram and optional raw line.**
- [ ] **Step 3: Attach threshold price lines, signal markers, and pane title.**
- [ ] **Step 4: Include RYD values in crosshair state and legend copy.**
- [ ] **Step 5: Set responsive pane heights and left-scale visibility.**
- [ ] **Step 6: Commit the UI integration.**

### Task 5: Verification and PR update

**Files:**
- Temporarily create then remove: `.github/workflows/professional-chart-branch-ci.yml`
- Update PR #3 description.

- [ ] **Step 1: Run chart-focused tests in GitHub Actions.**
- [ ] **Step 2: Run the full Node test suite.**
- [ ] **Step 3: Run `npm run build`.**
- [ ] **Step 4: Inspect the Vercel preview/runtime status.**
- [ ] **Step 5: Remove the temporary CI workflow without changing application code.**
- [ ] **Step 6: Update draft PR #3 with RYD scope and verification evidence.**
