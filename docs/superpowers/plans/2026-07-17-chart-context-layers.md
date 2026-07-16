# Professional Chart Context Layers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add clean GEX/DEX levels, relative-strength context, breadth context, stock-volatility context and earnings context to `/chart` while preserving the existing chart behavior.

**Architecture:** Extend the existing chart repository with isolated optional queries and return normalized top-level context objects. Keep calculations in pure server/chart helpers, render only three default GEX/DEX step lines plus compact earnings markers, and put all non-price context in one responsive strip above the chart.

**Tech Stack:** Next.js 16, React 19, Node.js ESM, PostgreSQL, Lightweight Charts 5.2, Node test runner.

## Global Constraints

- No new npm packages.
- No changes to existing trading signals, thresholds, portfolio logic or backend calculations unrelated to these context layers.
- Optional sources must fail open and must never make core OHLC chart data return HTTP 500.
- GEX/DEX history must begin at the first real snapshot and must never project current levels backward.
- Default visible chart context is Call Wall, Put Wall, Gamma Flip and earnings markers.
- DEX Support, DEX Resistance and Vol Trigger are hidden behind `Fler nivåer`.
- Relative strength, breadth, volatility and options status render in a compact strip, not extra panes.

---

### Task 1: Shared context models and pure classifiers

**Files:**
- Create: `lib/chart/chart-context.js`
- Test: `tests/chart-context.test.js`

**Interfaces:**
- Produces: `buildRelativeStrengthContext(rows)`, `buildBreadthContext({ sectorRows, marketRows })`, `buildVolatilityContext(rows)`, `buildEarningsContext(rows, barDates, latestDate)`, `normalizeGexDexSnapshots(rows)`.

- [ ] Write failing tests for RS direction, breadth two-percentage-point thresholds, Wilder ATR14/percentile regimes, earnings deduplication, and GEX snapshot date collapsing.
- [ ] Run `node --test tests/chart-context.test.js` and confirm failure.
- [ ] Implement the pure helper module with deterministic null handling and no database access.
- [ ] Run the focused test and confirm pass.
- [ ] Commit as `feat(chart): add context classification helpers`.

### Task 2: Optional chart repository context queries

**Files:**
- Modify: `lib/repositories/chart-data.js`
- Modify: `lib/chart/normalize-chart-data.js`
- Test: `tests/chart-data-context-sources.test.js`

**Interfaces:**
- Consumes the pure helpers from Task 1.
- Produces top-level payload fields `gexDexSnapshots`, `relativeStrengthContext`, `breadthContext`, `volatilityContext`, `earningsEvents`, and `nextEarnings`.

- [ ] Write a source-regression test that requires each optional query to be isolated and caught independently.
- [ ] Run the focused test and confirm failure.
- [ ] Add optional query helpers for GEX/DEX, relative strength, sector/market breadth, independent OHLC volatility lookback and earnings.
- [ ] Merge normalized optional results into the final payload without changing the bar schema.
- [ ] Run focused tests and existing chart repository tests.
- [ ] Commit as `feat(chart): expose optional decision context data`.

### Task 3: Historical GEX/DEX step lines

**Files:**
- Create: `lib/chart/gex-dex-levels.js`
- Modify: `app/chart/financial-chart.js`
- Modify: `app/chart/chart-toolbar.js`
- Modify: `app/chart/chart-workspace.js`
- Modify: `lib/chart/series-registry.js`
- Test: `tests/chart-gex-dex-levels.test.js`

**Interfaces:**
- Produces `buildGexDexLevelData(snapshots, latestBarDate)` with series for `callWall`, `putWall`, `gammaFlip`, `dexResistance`, `dexSupport`, and `volTrigger`.

- [ ] Write failing tests proving no backward projection, date-collapsed snapshots, step continuity and latest-date extension.
- [ ] Run focused test and confirm failure.
- [ ] Add main and optional level controls with defaults `GEX/DEX=true`, `Fler nivåer=false`.
- [ ] Render Lightweight Charts step lines with restrained colors, right-axis last-value labels and stale styling.
- [ ] Run focused chart tests.
- [ ] Commit as `feat(chart): add historical GEX DEX levels`.

### Task 4: Compact context strip

**Files:**
- Create: `app/chart/chart-context-strip.js`
- Modify: `app/chart/chart-workspace.js`
- Modify: `app/globals.css`
- Test: `tests/chart-context-strip.test.js`

**Interfaces:**
- Consumes top-level payload context objects.
- Produces four compact semantic cards: Relative Strength, Breadth, Volatility and Options Positioning.

- [ ] Write a structural test requiring the four cards, chosen primary values and native tooltip details.
- [ ] Run test and confirm failure.
- [ ] Implement responsive cards with compact typography, directional glyphs and neutral missing-data states.
- [ ] Add styles that remain one row on wide screens and scroll/wrap cleanly on narrow screens.
- [ ] Run focused tests.
- [ ] Commit as `feat(chart): add compact decision context strip`.

### Task 5: Earnings markers and upcoming report context

**Files:**
- Create: `lib/chart/earnings-markers.js`
- Modify: `app/chart/financial-chart.js`
- Modify: `app/chart/chart-toolbar.js`
- Modify: `app/chart/chart-workspace.js`
- Test: `tests/chart-earnings-markers.test.js`

**Interfaces:**
- Produces `buildEarningsAnchorData(bars, earningsEvents)` and `buildEarningsMarkers(earningsEvents)`.

- [ ] Write failing tests that only real bar dates receive markers and future events do not create chart points.
- [ ] Run focused test and confirm failure.
- [ ] Render compact amber `E` markers below price and add a default-on `Rapporter` control.
- [ ] Surface nearest upcoming date and confirmation state in the context strip without future candles.
- [ ] Run focused tests.
- [ ] Commit as `feat(chart): add earnings markers and next report context`.

### Task 6: Integration verification

**Files:**
- Create temporarily: `.github/workflows/chart-context-layers-ci.yml`
- Remove after successful verification.

- [ ] Run all focused context tests.
- [ ] Run the complete Node test suite.
- [ ] Run `npm run build`.
- [ ] Verify a Vercel preview reaches READY and inspect runtime errors.
- [ ] Remove the temporary branch CI file after success.
- [ ] Open a draft pull request with data availability, defaults, activation and rollback details.