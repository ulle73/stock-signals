# Reference Sector Overview Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the overview macro table with the compact, reference-matched market dashboard and an all-sector momentum matrix powered by stored daily data.

**Architecture:** Keep the recommendation sourced solely from the existing market and position snapshots. Add a dashboard-only sector momentum module that compounds stored daily stock returns into equal-weight sector series, joins existing breadth/signal rows and stored RS percentiles, then renders the resulting rows in a server component directly after the compact top cards.

**Tech Stack:** Next.js 16 server components, React 19, PostgreSQL via `pg`, Node built-in test runner, CSS, existing inline SVG icons.

## Global Constraints

- Use only `stock_daily_indicators`, `sector_breadth_daily`, `sector_signal_daily`, `stock_relative_strength_daily`, `market_breadth_daily`, and `market_signal_daily`.
- Do not modify fetchers, external sources, schedules, raw tables, migrations, APIs, market/position signals, alerts, backtests, or persistence.
- Dashboard calculations are presentation-only and cannot feed a raw signal, position signal, ranking, or alert.
- Return source is existing `daily_return_pct`, whose indicator price already follows `adj_close ?? close`.
- Preserve all 11 active GICS sectors and raw sector names; translate names only at render time.
- Use 1, 5, and 21 sessions for 1D, 1W, and 1M. `roc5d` is compounded 5-session return; `acceleration5d` is `roc5d - priorRoc5d` in percentage points.
- Strength is the existing mean `rs_percentile_63d`, not a new relative-strength calculation.

---

### Task 1: Sector momentum view model

**Files:**
- Create: `lib/indicators/sector-overview-momentum.js`
- Test: `tests/sector-overview-momentum.test.js`

**Interfaces:**
- Consumes: `dailyRows` (`{ date, sector, daily_return_pct }`), `strengthRows`, `breadthRows`, and `signalRows`.
- Produces: `buildSectorOverviewRows({ dailyRows, strengthRows, breadthRows, signalRows })`, returning `{ sector, strength, return1d, return1w, return1m, roc5d, acceleration5d, sparkline, breadth, signal }` for every available sector.

- [ ] **Step 1: Write the failing test**

```js
test('buildSectorOverviewRows compounds stored daily sector returns and compares prior ROC', () => {
  const dailyRows = Array.from({ length: 22 }, (_, index) => ({
    date: `2026-06-${String(index + 1).padStart(2, '0')}`,
    sector: 'Information Technology',
    daily_return_pct: index < 17 ? '1' : '2',
  }));
  const [row] = buildSectorOverviewRows({
    dailyRows,
    strengthRows: [{ sector: 'Information Technology', strength: '67.5' }],
    breadthRows: [{ sector: 'Information Technology', pct_above_sma50: '70' }],
    signalRows: [{ sector: 'Information Technology', signal: 'leading' }],
  });
  assert.equal(row.strength, 67.5);
  assert.equal(row.return1d, 2);
  assert.ok(row.return1w > 0);
  assert.equal(row.sparkline.length, 21);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/sector-overview-momentum.test.js`

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement the pure view model**

```js
export const SECTOR_RETURN_WINDOWS = { oneDay: 1, oneWeek: 5, oneMonth: 21 };

function compoundedReturn(points, endIndex, sessions) {
  if (endIndex < sessions - 1) return null;
  return points.slice(endIndex - sessions + 1, endIndex + 1)
    .reduce((value, point) => value * (1 + point / 100), 1) * 100 - 100;
}

export function buildSectorOverviewRows({ dailyRows, strengthRows, breadthRows, signalRows }) {
  // Group stored daily_return_pct by date and sector, average each sector,
  // compound the requested windows, calculate prior 5D ROC, and preserve nulls.
}
```

- [ ] **Step 4: Run focused and existing sector tests**

Run: `node --test tests/sector-overview-momentum.test.js tests/sector-breadth.test.js tests/sector-signals.test.js`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/indicators/sector-overview-momentum.js tests/sector-overview-momentum.test.js
git commit -m "feat: add sector overview momentum view model"
```

### Task 2: Read-only overview repository

**Files:**
- Create: `lib/repositories/sector-overview.js`
- Test: `tests/sector-overview-repository.test.js`

**Interfaces:**
- Consumes: existing database tables through an injected `{ query }` client.
- Produces: `getSectorOverviewSnapshot(queryClient)`, returning latest date and all calculated sector rows.

- [ ] **Step 1: Write the failing SQL contract**

```js
test('getSectorOverviewSnapshot reads only existing sector and RS tables', async () => {
  const calls = [];
  await getSectorOverviewSnapshot({ query: async (sql) => {
    calls.push(sql);
    return { rows: [] };
  } });
  const sql = calls.join('\n');
  assert.match(sql, /stock_daily_indicators/i);
  assert.match(sql, /sector_breadth_daily/i);
  assert.match(sql, /sector_signal_daily/i);
  assert.match(sql, /stock_relative_strength_daily/i);
  assert.doesNotMatch(sql, /insert|update|delete|alter|create/i);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/sector-overview-repository.test.js`

Expected: FAIL because the repository does not exist.

- [ ] **Step 3: Implement source reads and assembly**

```js
export async function getSectorOverviewSnapshot(queryClient = { query }) {
  const [dailyReturnResult, strengthResult, breadthResult, signalResult] = await Promise.all([
    queryClient.query(`select i.date::text as date, c.sector, i.daily_return_pct::text as daily_return_pct
      from stock_daily_indicators i join sp500_constituents c on c.ticker = i.ticker
      where c.is_active = true and c.sector is not null and i.daily_return_pct is not null
      order by i.date asc, c.sector asc, i.ticker asc`),
    queryClient.query(`select c.sector, avg(r.rs_percentile_63d)::text as strength
      from stock_relative_strength_daily r join sp500_constituents c on c.ticker = r.ticker
      where r.date = (select max(date) from stock_relative_strength_daily) and c.is_active = true
      group by c.sector`),
    queryClient.query(`select * from sector_breadth_daily where date = (select max(date) from sector_breadth_daily)`),
    queryClient.query(`select * from sector_signal_daily where date = (select max(date) from sector_signal_daily)`),
  ]);
  return {
    rows: buildSectorOverviewRows({
      dailyRows: dailyReturnResult.rows,
      strengthRows: strengthResult.rows,
      breadthRows: breadthResult.rows,
      signalRows: signalResult.rows,
    }),
  };
}
```

- [ ] **Step 4: Run repository and calculation tests**

Run: `node --test tests/sector-overview-repository.test.js tests/sector-overview-momentum.test.js`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/repositories/sector-overview.js tests/sector-overview-repository.test.js
git commit -m "feat: load dashboard sector overview data"
```

### Task 3: Reference-matched dashboard presentation

**Files:**
- Create: `app/sector-overview-matrix.js`
- Modify: `app/page.js`
- Modify: `app/dashboard-icons.js`
- Modify: `app/restyle.css`
- Modify: `tests/dashboard-presentation-contract.test.js`

**Interfaces:**
- Consumes: `getSectorOverviewSnapshot()`, existing `getDashboardSnapshot()`, and `interpretMarketSignal()`.
- Produces: reference-style hero, six compact cards, and a matrix with strength bars, 1D/1W/1M values, acceleration segments, and 21-session sparklines.

- [ ] **Step 1: Write failing presentation contracts**

```js
assert.match(pageSource, /SectorOverviewMatrix/);
assert.doesNotMatch(pageSource, /EquitySectorStyleRegimePerformanceSection/);
assert.match(matrixSource, /ROC 5D \/ Acceleration/);
assert.match(matrixSource, /return1d/);
assert.match(matrixSource, /return1w/);
assert.match(matrixSource, /return1m/);
assert.match(matrixSource, /sparkline/);
assert.match(css, /sector-overview-table/);
assert.match(css, /acceleration-segments/);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/dashboard-presentation-contract.test.js`

Expected: FAIL because the page still mounts the macro matrix.

- [ ] **Step 3: Implement the reference hierarchy**

```jsx
<section className="reference-hero" id="oversikt">
  <HeroAction interpretation={interpretation} position={positionCurrent} />
</section>
<section className="reference-metric-grid" aria-label="Marknadens nyckeltal">
  <MarketMetricCards signal={latestSignal} />
</section>
<section className="sector-overview-section" id="sektorer">
  <SectorOverviewMatrix snapshot={sectorOverview} />
</section>
```

Render all supplied rows. Map sector labels to Swedish only in the component. Draw SVG paths only from supplied `sparkline` points. Keep hero action and recommendation tied to existing market/position signals, never the new sector values.

- [ ] **Step 4: Apply compact reference styling**

```css
.reference-hero { grid-template-columns: 150px minmax(0, 1fr) 320px; }
.reference-metric-grid { grid-template-columns: repeat(6, minmax(0, 1fr)); }
.sector-overview-table { width: 100%; border-collapse: collapse; }
.sector-strength-bar > i { width: var(--strength); }
.acceleration-segments[data-tone='positive'] i { background: var(--accent); }
.sector-sparkline { width: 92px; height: 26px; }
```

The matrix must scroll inside its own card on narrow screens and must not widen the page.

- [ ] **Step 5: Verify browser and build**

Run: `node --test tests/dashboard-presentation-contract.test.js && npm run build`

Inspect `http://127.0.0.1:3106` at 1440×960 and 390×844 with Playwright.

- [ ] **Step 6: Commit**

```bash
git add app/page.js app/sector-overview-matrix.js app/dashboard-icons.js app/restyle.css tests/dashboard-presentation-contract.test.js
git commit -m "feat: match dashboard overview to sector reference"
```

## Self-Review

- Task 3 covers the image 1 hierarchy: top navigation, action-first hero, six metric cards, then the primary sector matrix.
- Tasks 1–3 cover all sectors, strength bars, 1D/1W/1M, signed ROC/acceleration, segmented acceleration, and sparklines.
- Task 2 enforces read-only use of existing data; no fetcher, migration, API, or raw table changes.
- The plan uses the same field names across calculation, repository, test, and component.
