# Professional Chart V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a dedicated, production-grade `/chart` workspace with daily candlesticks, volume, SMA5/10/20/50/200, ticker and period controls, URL persistence, and a chart foundation that can later accept GEX/DEX levels and separate indicator panes.

**Architecture:** A parameterized repository query returns chart-specific rows, a deterministic normalizer creates a stable frontend contract, and an API route serves that contract. A client workspace owns URL/control state while `FinancialChart` exclusively owns the Lightweight Charts lifecycle, series creation, crosshair handling, resizing, and cleanup. Series metadata and visual configuration remain centralized so future layers do not require rewriting page or chart lifecycle code.

**Tech Stack:** Next.js 16 App Router, React 19, Node.js 22, PostgreSQL, TradingView Lightweight Charts 5.2.0, `node:test`, existing global CSS system.

## Global Constraints

- Work only on branch `codex/professional-chart-v1`.
- Do not change indicator calculations, thresholds, database schema, portfolio logic, market signals, or existing dashboard behavior.
- V1 includes only daily OHLC candles, volume, SMA5, SMA10, SMA20, SMA50, and SMA200.
- Do not add financial advice, buy/sell labels, entries, stops, targets, or portfolio recommendations.
- Default visible overlays are SMA20, SMA50, and SMA200; SMA5 and SMA10 are off.
- The selected ticker and period must remain bookmarkable via `/chart?ticker=AAPL&period=1Y`.
- Supported periods are exactly `3M`, `6M`, `1Y`, `2Y`, and `ALL`.
- Lightweight Charts code must execute only in a client component.
- The public chart page must contain TradingView attribution.
- Missing moving-average values must remain gaps; never interpolate them.
- All SQL must be parameterized and server-side row counts must be capped.

---

## File Map

### Create

- `lib/chart/chart-periods.js` — validates periods and computes query start dates.
- `lib/chart/normalize-chart-data.js` — converts database rows to the stable chart contract.
- `lib/chart/series-registry.js` — central metadata for price, volume, and moving-average layers.
- `lib/chart/chart-theme.js` — central Lightweight Charts visual options.
- `lib/repositories/chart-data.js` — parameterized chart history query.
- `app/api/chart-data/route.js` — validated JSON endpoint for ticker and period.
- `app/chart/page.js` — server route shell, constituent list, and initial selection.
- `app/chart/chart-workspace.js` — client state, fetching, URL controls, loading/error states.
- `app/chart/chart-toolbar.js` — ticker, period, moving-average toggles, and reset action.
- `app/chart/crosshair-legend.js` — semantic and visual OHLC/volume/MA legend.
- `app/chart/financial-chart.js` — Lightweight Charts lifecycle boundary.
- `app/chart/chart.css` — isolated professional chart workspace styling.
- `tests/chart-periods.test.js` — period validation and start-date tests.
- `tests/chart-data-normalization.test.js` — deterministic row normalization tests.
- `tests/chart-series-registry.test.js` — registry keys/default visibility tests.

### Modify

- `package.json` — add `lightweight-charts` 5.2.0 and chart-focused test scripts.
- `package-lock.json` — lock `lightweight-charts` 5.2.0 and `fancy-canvas` 2.1.0.
- `app/dashboard-top-nav.js` — add a real `/chart` navigation link.
- `app/layout.js` — import `app/chart/chart.css` globally or keep page-specific import in `app/chart/page.js`; use one approach only.

---

### Task 1: Period validation and stable chart normalization

**Files:**
- Create: `lib/chart/chart-periods.js`
- Create: `lib/chart/normalize-chart-data.js`
- Create: `tests/chart-periods.test.js`
- Create: `tests/chart-data-normalization.test.js`

**Interfaces:**
- Produces: `normalizeChartPeriod(value) -> '3M' | '6M' | '1Y' | '2Y' | 'ALL'`.
- Produces: `getChartStartDate(period, latestDate) -> string | null`.
- Produces: `normalizeChartRows({ ticker, company, period, rows }) -> ChartPayload`.
- `ChartPayload.bars` is ascending and contains finite OHLC values, non-negative volume, and optional numeric MA fields.

- [ ] **Step 1: Write period tests**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { getChartStartDate, normalizeChartPeriod } from '../lib/chart/chart-periods.js';

test('normalizeChartPeriod accepts supported values and falls back to 1Y', () => {
  assert.equal(normalizeChartPeriod('3m'), '3M');
  assert.equal(normalizeChartPeriod('ALL'), 'ALL');
  assert.equal(normalizeChartPeriod('bad'), '1Y');
  assert.equal(normalizeChartPeriod(undefined), '1Y');
});

test('getChartStartDate returns deterministic UTC calendar boundaries', () => {
  assert.equal(getChartStartDate('3M', '2026-07-10'), '2026-04-10');
  assert.equal(getChartStartDate('6M', '2026-07-10'), '2026-01-10');
  assert.equal(getChartStartDate('1Y', '2026-07-10'), '2025-07-10');
  assert.equal(getChartStartDate('2Y', '2026-07-10'), '2024-07-10');
  assert.equal(getChartStartDate('ALL', '2026-07-10'), null);
});
```

- [ ] **Step 2: Run period tests and verify failure**

Run: `node --test tests/chart-periods.test.js`

Expected: FAIL because `lib/chart/chart-periods.js` does not exist.

- [ ] **Step 3: Implement period helpers**

```js
export const CHART_PERIODS = Object.freeze(['3M', '6M', '1Y', '2Y', 'ALL']);

const MONTHS_BY_PERIOD = Object.freeze({
  '3M': 3,
  '6M': 6,
  '1Y': 12,
  '2Y': 24,
});

export function normalizeChartPeriod(value) {
  const normalized = String(value ?? '').trim().toUpperCase();
  return CHART_PERIODS.includes(normalized) ? normalized : '1Y';
}

export function getChartStartDate(period, latestDate) {
  const normalizedPeriod = normalizeChartPeriod(period);
  if (normalizedPeriod === 'ALL' || !latestDate) return null;

  const [year, month, day] = String(latestDate).split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCMonth(date.getUTCMonth() - MONTHS_BY_PERIOD[normalizedPeriod]);
  return date.toISOString().slice(0, 10);
}
```

- [ ] **Step 4: Write normalization tests**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeChartRows } from '../lib/chart/normalize-chart-data.js';

const company = {
  ticker: 'AAPL',
  company_name: 'Apple Inc.',
  sector: 'Information Technology',
};

test('normalizeChartRows sorts ascending and removes duplicate dates deterministically', () => {
  const payload = normalizeChartRows({
    ticker: 'AAPL',
    company,
    period: '1Y',
    rows: [
      { date: '2026-07-10', open: '210', high: '214', low: '209', close: '213', volume: '10', sma20: '205' },
      { date: '2026-07-09', open: '208', high: '211', low: '207', close: '210', volume: '9', sma20: null },
      { date: '2026-07-10', open: '210', high: '215', low: '209', close: '214', volume: '11', sma20: '206' },
    ],
  });

  assert.deepEqual(payload.bars, [
    { time: '2026-07-09', open: 208, high: 211, low: 207, close: 210, volume: 9 },
    { time: '2026-07-10', open: 210, high: 215, low: 209, close: 214, volume: 11, sma20: 206 },
  ]);
  assert.equal(payload.latestDate, '2026-07-10');
  assert.equal(payload.latestPrice, 214);
  assert.equal(payload.previousClose, 210);
});

test('normalizeChartRows rejects invalid OHLC rows but preserves zero and optional MA gaps', () => {
  const payload = normalizeChartRows({
    ticker: 'AAPL',
    company,
    period: '3M',
    rows: [
      { date: '2026-07-08', open: '0', high: '1', low: '0', close: '0.5', volume: '-2', sma5: '' },
      { date: '2026-07-09', open: 'bad', high: '2', low: '1', close: '1.5', volume: '5' },
    ],
  });

  assert.deepEqual(payload.bars, [
    { time: '2026-07-08', open: 0, high: 1, low: 0, close: 0.5, volume: 0 },
  ]);
});
```

- [ ] **Step 5: Run normalization tests and verify failure**

Run: `node --test tests/chart-data-normalization.test.js`

Expected: FAIL because `normalizeChartRows` does not exist.

- [ ] **Step 6: Implement deterministic normalization**

```js
const MOVING_AVERAGE_KEYS = Object.freeze(['sma5', 'sma10', 'sma20', 'sma50', 'sma200']);

function finiteNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function normalizedBar(row) {
  const open = finiteNumber(row.open);
  const high = finiteNumber(row.high);
  const low = finiteNumber(row.low);
  const close = finiteNumber(row.adj_close ?? row.close);
  if (!row.date || [open, high, low, close].some((value) => value === null)) return null;

  const bar = {
    time: String(row.date),
    open,
    high,
    low,
    close,
    volume: Math.max(0, finiteNumber(row.volume) ?? 0),
  };

  for (const key of MOVING_AVERAGE_KEYS) {
    const value = finiteNumber(row[key]);
    if (value !== null) bar[key] = value;
  }

  return bar;
}

export function normalizeChartRows({ ticker, company, period, rows = [] }) {
  const byDate = new Map();
  for (const row of rows) {
    const bar = normalizedBar(row);
    if (bar) byDate.set(bar.time, bar);
  }

  const bars = [...byDate.values()].sort((left, right) => left.time.localeCompare(right.time));
  const latest = bars.at(-1) ?? null;
  const previous = bars.at(-2) ?? null;

  return {
    ticker,
    companyName: company?.company_name ?? ticker,
    sector: company?.sector ?? null,
    currency: 'USD',
    period,
    latestDate: latest?.time ?? null,
    latestPrice: latest?.close ?? null,
    previousClose: previous?.close ?? null,
    bars,
  };
}
```

- [ ] **Step 7: Run task tests**

Run: `node --test tests/chart-periods.test.js tests/chart-data-normalization.test.js`

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add lib/chart/chart-periods.js lib/chart/normalize-chart-data.js tests/chart-periods.test.js tests/chart-data-normalization.test.js
git commit -m "feat: normalize professional chart data"
```

---

### Task 2: Chart repository and API endpoint

**Files:**
- Create: `lib/repositories/chart-data.js`
- Create: `app/api/chart-data/route.js`
- Test: `tests/chart-periods.test.js`
- Modify: `lib/chart/chart-periods.js`

**Interfaces:**
- Consumes: `normalizeChartPeriod`, `getChartStartDate`, `normalizeChartRows`.
- Produces: `getChartData({ ticker, period, maxRows }) -> Promise<ChartPayload>`.
- Produces: `GET(request) -> NextResponse<ChartPayload | error>`.

- [ ] **Step 1: Add ticker validation tests**

```js
import { normalizeChartTicker } from '../lib/chart/chart-periods.js';

test('normalizeChartTicker accepts safe listed symbols and rejects malformed input', () => {
  assert.equal(normalizeChartTicker(' brk.b '), 'BRK.B');
  assert.equal(normalizeChartTicker('AAPL'), 'AAPL');
  assert.equal(normalizeChartTicker('../AAPL'), null);
  assert.equal(normalizeChartTicker(''), null);
});
```

- [ ] **Step 2: Implement ticker validation**

```js
export function normalizeChartTicker(value) {
  const ticker = String(value ?? '').trim().toUpperCase();
  return /^[A-Z][A-Z0-9.-]{0,9}$/.test(ticker) ? ticker : null;
}
```

- [ ] **Step 3: Implement the parameterized repository**

```js
import { query } from '../db.js';
import { getChartStartDate, normalizeChartPeriod, normalizeChartTicker } from '../chart/chart-periods.js';
import { normalizeChartRows } from '../chart/normalize-chart-data.js';

const DEFAULT_MAX_ROWS = 1500;
const HARD_MAX_ROWS = 3000;

export async function getChartData({ ticker, period = '1Y', maxRows = DEFAULT_MAX_ROWS }) {
  const safeTicker = normalizeChartTicker(ticker);
  if (!safeTicker) throw new Error('INVALID_TICKER');

  const safePeriod = normalizeChartPeriod(period);
  const safeMaxRows = Math.max(50, Math.min(Number(maxRows) || DEFAULT_MAX_ROWS, HARD_MAX_ROWS));

  const companyResult = await query(
    `select ticker, company_name, sector
     from sp500_constituents
     where ticker = $1 and is_active = true
     limit 1`,
    [safeTicker]
  );
  const company = companyResult.rows[0] ?? null;
  if (!company) return normalizeChartRows({ ticker: safeTicker, company: null, period: safePeriod, rows: [] });

  const latestResult = await query(
    `select max(date)::text as latest_date from stock_daily_prices where ticker = $1`,
    [safeTicker]
  );
  const startDate = getChartStartDate(safePeriod, latestResult.rows[0]?.latest_date ?? null);

  const rowsResult = await query(
    `select * from (
       select
         p.date::text as date,
         p.open::text as open,
         p.high::text as high,
         p.low::text as low,
         p.close::text as close,
         p.adj_close::text as adj_close,
         p.volume::text as volume,
         i.sma5::text as sma5,
         i.sma10::text as sma10,
         i.sma20::text as sma20,
         i.sma50::text as sma50,
         i.sma200::text as sma200
       from stock_daily_prices p
       left join stock_daily_indicators i on i.ticker = p.ticker and i.date = p.date
       where p.ticker = $1 and ($2::date is null or p.date >= $2::date)
       order by p.date desc
       limit $3
     ) chart_rows
     order by date asc`,
    [safeTicker, startDate, safeMaxRows]
  );

  return normalizeChartRows({ ticker: safeTicker, company, period: safePeriod, rows: rowsResult.rows });
}
```

- [ ] **Step 4: Implement API validation, response, and cache headers**

```js
import { NextResponse } from 'next/server';
import { getChartData } from '../../../lib/repositories/chart-data.js';
import { normalizeChartPeriod, normalizeChartTicker } from '../../../lib/chart/chart-periods.js';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const ticker = normalizeChartTicker(searchParams.get('ticker'));
  const period = normalizeChartPeriod(searchParams.get('period'));

  if (!ticker) {
    return NextResponse.json({ error: 'Ogiltig ticker.' }, { status: 400 });
  }

  try {
    const payload = await getChartData({ ticker, period });
    return NextResponse.json(payload, {
      headers: { 'Cache-Control': 'public, max-age=60, s-maxage=300, stale-while-revalidate=1800' },
    });
  } catch (error) {
    console.error('Chart data request failed:', error);
    return NextResponse.json({ error: 'Chartdatan kunde inte laddas.' }, { status: 500 });
  }
}
```

- [ ] **Step 5: Run helper tests**

Run: `node --test tests/chart-periods.test.js tests/chart-data-normalization.test.js`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/chart/chart-periods.js lib/repositories/chart-data.js app/api/chart-data/route.js tests/chart-periods.test.js
git commit -m "feat: expose chart history api"
```

---

### Task 3: Series registry, dependency, and central theme

**Files:**
- Create: `lib/chart/series-registry.js`
- Create: `lib/chart/chart-theme.js`
- Create: `tests/chart-series-registry.test.js`
- Modify: `package.json`
- Modify: `package-lock.json`

**Interfaces:**
- Produces: `CHART_SERIES` keyed by `price`, `volume`, `sma5`, `sma10`, `sma20`, `sma50`, `sma200`.
- Produces: `DEFAULT_VISIBLE_OVERLAYS`.
- Produces: `createChartOptions()` and `createSeriesOptions(key)`.

- [ ] **Step 1: Write registry tests**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { CHART_SERIES, DEFAULT_VISIBLE_OVERLAYS } from '../lib/chart/series-registry.js';

test('series registry contains stable V1 keys', () => {
  assert.deepEqual(Object.keys(CHART_SERIES), ['price', 'volume', 'sma5', 'sma10', 'sma20', 'sma50', 'sma200']);
});

test('only SMA20, SMA50, and SMA200 are visible by default', () => {
  assert.deepEqual(DEFAULT_VISIBLE_OVERLAYS, ['sma20', 'sma50', 'sma200']);
});
```

- [ ] **Step 2: Implement registry and theme**

```js
export const CHART_SERIES = Object.freeze({
  price: { key: 'price', label: 'Pris', kind: 'candlestick', pane: 0 },
  volume: { key: 'volume', label: 'Volym', kind: 'histogram', pane: 1 },
  sma5: { key: 'sma5', label: 'SMA5', kind: 'line', pane: 0, color: '#f59e0b' },
  sma10: { key: 'sma10', label: 'SMA10', kind: 'line', pane: 0, color: '#eab308' },
  sma20: { key: 'sma20', label: 'SMA20', kind: 'line', pane: 0, color: '#38bdf8' },
  sma50: { key: 'sma50', label: 'SMA50', kind: 'line', pane: 0, color: '#a78bfa' },
  sma200: { key: 'sma200', label: 'SMA200', kind: 'line', pane: 0, color: '#f472b6' },
});

export const DEFAULT_VISIBLE_OVERLAYS = Object.freeze(['sma20', 'sma50', 'sma200']);
```

`chart-theme.js` must export plain objects and functions only; it must not import React or browser globals.

- [ ] **Step 3: Add and lock dependency**

Set root dependency:

```json
"lightweight-charts": "5.2.0"
```

Add lock entries for:

```json
"node_modules/fancy-canvas": {
  "version": "2.1.0",
  "resolved": "https://registry.npmjs.org/fancy-canvas/-/fancy-canvas-2.1.0.tgz",
  "integrity": "sha512-nifxXJ95JNLFR2NgRV4/MxVP45G9909wJTEKz5fg/TZS20JJZA6hfgRVh/bC9bwl2zBtBNcYPjiBE4njQHVBwQ==",
  "license": "MIT"
},
"node_modules/lightweight-charts": {
  "version": "5.2.0",
  "resolved": "https://registry.npmjs.org/lightweight-charts/-/lightweight-charts-5.2.0.tgz",
  "integrity": "sha512-ey3Vas8UhV06ni+LT9TA1nEe4y8So4Mi6CL/oarNHFMyTktz/xy8e8+oh04Q//eO3t6etvFXgayz2fClyFQb5w==",
  "license": "Apache-2.0",
  "dependencies": { "fancy-canvas": "2.1.0" }
}
```

- [ ] **Step 4: Run registry tests**

Run: `node --test tests/chart-series-registry.test.js`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json lib/chart/series-registry.js lib/chart/chart-theme.js tests/chart-series-registry.test.js
git commit -m "feat: add professional chart series registry"
```

---

### Task 4: Financial chart lifecycle and crosshair legend

**Files:**
- Create: `app/chart/financial-chart.js`
- Create: `app/chart/crosshair-legend.js`

**Interfaces:**
- Consumes: `bars`, `visibleOverlays`, `resetToken`, and `onCrosshairChange`.
- Produces: a responsive chart with price pane, volume pane, MA overlays, cleanup, and reset behavior.

- [ ] **Step 1: Implement `CrosshairLegend` as a pure presentational component**

It receives `{ ticker, point, visibleOverlays }`. When `point` is null it displays latest values. It renders date, O, H, L, C, volume, and only visible MA values. It must not create subscriptions.

- [ ] **Step 2: Implement the chart lifecycle boundary**

Use `useEffect`, `useRef`, and Lightweight Charts 5.2 imports:

```js
import {
  CandlestickSeries,
  ColorType,
  createChart,
  HistogramSeries,
  LineSeries,
} from 'lightweight-charts';
```

Within one effect:

1. create the chart once for the current bars payload;
2. add candlesticks on pane 0;
3. add volume histogram on pane 1;
4. add all MA line series on pane 0;
5. call `setData` once per series;
6. call `applyOptions({ visible })` when overlay state changes;
7. subscribe to crosshair movement and map `seriesData` back to one legend point;
8. observe the container with `ResizeObserver`;
9. call `fitContent()`;
10. unsubscribe, disconnect, and `chart.remove()` during cleanup.

Volume data must include per-row colors derived from candle direction, but no volume direction may alter price or signal logic.

- [ ] **Step 3: Add stable empty and rendering fallback markup**

If `bars.length === 0`, return a semantic empty-state card instead of creating a chart. The chart container must have a minimum height and `aria-label` describing ticker and period.

- [ ] **Step 4: Commit**

```bash
git add app/chart/financial-chart.js app/chart/crosshair-legend.js
git commit -m "feat: render professional financial chart"
```

---

### Task 5: Workspace, toolbar, route, navbar, and styling

**Files:**
- Create: `app/chart/chart-workspace.js`
- Create: `app/chart/chart-toolbar.js`
- Create: `app/chart/page.js`
- Create: `app/chart/chart.css`
- Modify: `app/dashboard-top-nav.js`

**Interfaces:**
- Consumes: active constituents and initial ticker/period.
- Produces: a bookmarkable interactive `/chart` workspace.

- [ ] **Step 1: Implement server route shell**

`app/chart/page.js` must:

- export `dynamic = 'force-dynamic'`;
- load active constituents with the existing repository;
- validate initial ticker against the constituent list;
- normalize initial period;
- render `DashboardTopNav` and `ChartWorkspace`;
- import `./chart.css`;
- avoid importing Lightweight Charts directly.

- [ ] **Step 2: Implement toolbar controls**

`ChartToolbar` receives:

```js
{
  constituents,
  ticker,
  period,
  visibleOverlays,
  unavailableOverlays,
  onTickerChange,
  onPeriodChange,
  onToggleOverlay,
  onReset,
}
```

Use native `<select>` and `<button>` elements. Each MA toggle must expose `aria-pressed`. Unavailable overlays are disabled and explained in the button title.

- [ ] **Step 3: Implement workspace data flow**

`ChartWorkspace` must:

- initialize visible overlays from `DEFAULT_VISIBLE_OVERLAYS`;
- fetch `/api/chart-data?ticker=...&period=...` with an `AbortController`;
- abort stale requests on ticker/period changes;
- set `loading`, `ready`, `empty`, or `error` state;
- update URL search parameters with `window.history.replaceState`;
- calculate unavailable overlays from the returned bars;
- increment a `resetToken` on reset;
- keep the chart-sized skeleton stable while loading;
- expose a retry button after an error.

- [ ] **Step 4: Add navbar item**

Change the nav item list to include:

```js
{ href: '/chart', icon: 'signal', label: 'Chart' }
```

Do not mark `Översikt` active unconditionally. Accept an optional `activeItem` prop with default `Översikt`, and mark the matching item active. The chart page passes `activeItem="Chart"`.

- [ ] **Step 5: Implement professional styling**

The stylesheet must include:

- full-width workspace constrained only by the application frame;
- chart area at `min-height: clamp(520px, 72vh, 860px)` on desktop;
- restrained dark surfaces using existing CSS variables;
- toolbar wrapping below desktop width;
- clear focus-visible outlines;
- compact mobile controls;
- no decorative glow behind candles;
- a stable skeleton matching final dimensions;
- readable attribution below the chart;
- strong but calm active states for MA toggles.

- [ ] **Step 6: Commit**

```bash
git add app/chart app/dashboard-top-nav.js
git commit -m "feat: add dedicated professional chart workspace"
```

---

### Task 6: Verification and acceptance checks

**Files:**
- Modify only if verification finds a defect in files already listed.

- [ ] **Step 1: Run focused tests**

Run:

```bash
node --test tests/chart-periods.test.js tests/chart-data-normalization.test.js tests/chart-series-registry.test.js
```

Expected: all tests PASS.

- [ ] **Step 2: Run the complete test suite**

Run:

```bash
node --test tests/*.test.js
```

Expected: all existing and new tests PASS.

- [ ] **Step 3: Run production build**

Run:

```bash
npm ci
npm run build
```

Expected: dependency installation and Next.js production build PASS with no server-side `window` or canvas errors.

- [ ] **Step 4: Browser verification**

Verify `/chart?ticker=AAPL&period=1Y` at desktop, tablet, and mobile widths:

- chart loads with candles and volume;
- SMA20/50/200 are visible by default;
- SMA5/10 are off by default;
- toggles change only overlay visibility;
- ticker and period changes update URL and data;
- reset fits visible data;
- crosshair values match visible bars;
- repeated navigation creates no console errors;
- empty and error states remain readable;
- TradingView attribution is visible.

- [ ] **Step 5: Compare branch scope**

Run:

```bash
git diff --stat main...HEAD
git diff main...HEAD -- db migrations scripts
```

Expected: no database migration, signal calculation, threshold, or trading execution files changed.

- [ ] **Step 6: Final commit if verification fixes were required**

```bash
git add <only files fixed during verification>
git commit -m "fix: harden professional chart verification"
```
