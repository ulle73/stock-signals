# GEX/DEX Options Positioning Beta Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a modular GammaLens-backed GEX/DEX snapshot layer and a read-only dashboard section for SPY and QQQ, without changing the core price-fetch pipeline or creating trading actions.

**Architecture:** A standalone GammaLens source adapter normalizes the API payload into immutable source snapshots and per-strike rows. A separate pure indicator converts the raw snapshot into contextual states (`range`, `flip_risk`, `expansion`, `neutral`); a dashboard repository and view model then render the latest source-backed state. The fetch and calculation scripts remain isolated from `scripts/fetch-daily.js` and run in a dedicated scheduled workflow.

**Tech Stack:** Next.js 16 server components, Node.js 22 `fetch`, PostgreSQL, GitHub Actions, Node test runner, CSS/SVG-free DOM charts.

---

## Guardrails

- GammaLens is the only v1 market-data input. Do not alter Yahoo, FRED, OCC, constituent, or raw-price fetching.
- Persist provider timestamp, freshness fields, source URL, and raw JSON. The provider's `data_quality` label is displayed as provider metadata, not treated as independently verified quality.
- No buy/sell signals, Telegram behavior, backtest strategy, or execution changes. The derived state is a contextual raw signal layer only.
- Default to `SPY,QQQ`; expose `GEX_DEX_TICKERS` for a comma-separated, normalized watchlist.
- Keep all custom calculations in `lib/indicators/gex-dex-regime.js`, not `lib/utils/rolling-indicators.js`.

### Task 1: Add the GammaLens source contract

**Files:**

- Create: `lib/sources/gammalens-gex-dex.js`
- Create: `tests/gammalens-gex-dex.test.js`

**Step 1: Write the failing test**

Cover URL construction, a valid payload with one strike, preservation of source metadata, and a rejected malformed payload:

```js
test('parseGammaLensGexDexPayload normalizes a source snapshot and per-strike GEX/DEX rows', () => {
  const result = parseGammaLensGexDexPayload('SPY', payload);
  assert.equal(result.snapshot.ticker, 'SPY');
  assert.equal(result.snapshot.source_timestamp, '2026-07-10T21:32:25.175Z');
  assert.deepEqual(result.strikes[0], {
    strike: 750,
    call_gex: 12,
    put_gex: -8,
    net_gex: 4,
    call_dex: 5,
    put_dex: -3,
    net_dex: 2,
    expiry_count: 3,
  });
});
```

**Step 2: Run the test to verify it fails**

Run: `node --test tests/gammalens-gex-dex.test.js`

Expected: fail because the source module does not exist.

**Step 3: Write the minimal implementation**

- Export `buildGammaLensGexDexUrl(ticker)`.
- Export `parseGammaLensGexDexPayload(ticker, payload)` which requires matching ticker, a parseable provider timestamp, `key_levels`, a finite `spot_price`, and at least one finite-strike row.
- Export `fetchGammaLensGexDex(ticker, fetchFn = fetch)` which checks `response.ok`, parses JSON, and delegates to the parser.
- Store only source values and raw payload; do not infer trade direction in this layer.

**Step 4: Run the test to verify it passes**

Run: `node --test tests/gammalens-gex-dex.test.js`

Expected: pass.

### Task 2: Persist raw snapshots and strike distributions

**Files:**

- Create: `db/migrations/027_create_gex_dex_snapshot_tables.sql`
- Create: `lib/repositories/gex-dex-snapshots.js`
- Create: `tests/gex-dex-snapshots.test.js`

**Step 1: Write the failing test**

Specify the atomic storage contract: a source snapshot is keyed by `(ticker, source_timestamp)`, includes raw payload/provenance/freshness, and its strikes are inserted with `(snapshot_id, strike)` identity.

```js
test('buildGexDexSnapshotUpsertStatement preserves GammaLens source metadata', () => {
  const statement = buildGexDexSnapshotUpsertStatement(snapshot);
  assert.match(statement.sql, /insert into gex_dex_source_snapshots/i);
  assert.deepEqual(statement.params.slice(0, 3), ['SPY', '2026-07-10T21:32:25.175Z', sourceUrl]);
});
```

**Step 2: Run the test to verify it fails**

Run: `node --test tests/gex-dex-snapshots.test.js`

Expected: fail because the repository does not exist.

**Step 3: Write the minimal implementation**

- Add `gex_dex_source_snapshots`: provider time, retrieve time, source URL, provider freshness flags, headline GEX/DEX fields, level JSON, and raw response JSON.
- Add `gex_dex_strike_snapshots`: one row per source snapshot/strike with GEX, DEX, and expiry count.
- Add `upsertGexDexSnapshot(snapshot, strikes)` using a transaction; update an existing source timestamp and replace its strike set atomically.
- Add read methods for uncalculated snapshots and the latest snapshot plus strikes for each ticker.

**Step 4: Run the test to verify it passes**

Run: `node --test tests/gex-dex-snapshots.test.js tests/migration-sql.test.js`

Expected: pass.

### Task 3: Calculate contextual GEX/DEX states

**Files:**

- Create: `db/migrations/028_create_gex_dex_signal_snapshots.sql`
- Create: `lib/indicators/gex-dex-regime.js`
- Create: `lib/repositories/gex-dex-signals.js`
- Create: `scripts/calculate-gex-dex-signals.js`
- Create: `tests/gex-dex-regime.test.js`
- Modify: `package.json`

**Step 1: Write the failing tests**

Define pure state rules without directional trade advice:

```js
test('buildGexDexRegimeRows marks positive gamma inside a tight wall range as range', () => {
  const row = buildGexDexRegimeRows([positiveGammaSnapshot])[0];
  assert.equal(row.gex_dex_signal, 'range');
  assert.equal(row.inside_walls, true);
});

test('buildGexDexRegimeRows marks a negative-gamma wall break as expansion', () => {
  const row = buildGexDexRegimeRows([negativeGammaOutsideWall])[0];
  assert.equal(row.gex_dex_signal, 'expansion');
});
```

**Step 2: Run the test to verify it fails**

Run: `node --test tests/gex-dex-regime.test.js`

Expected: fail because the indicator does not exist.

**Step 3: Write the minimal implementation**

- Calculate distances to gamma flip/call wall/put wall in provider ATR units.
- Persist `inside_walls`, `near_gamma_flip`, `above_call_wall`, `below_put_wall`, GEX/DEX confluence, and one of `range`, `flip_risk`, `expansion`, `neutral`, `unknown`.
- Priority is `unknown` (incomplete/stale data), `flip_risk`, `expansion`, `range`, then `neutral`.
- Add `calculate:gex-dex-signals`; it processes source snapshots that have no derived row and records its own fetch-run status.

**Step 4: Run the tests to verify they pass**

Run: `node --test tests/gex-dex-regime.test.js tests/gex-dex-snapshots.test.js`

Expected: pass.

### Task 4: Fetch a configurable GammaLens watchlist

**Files:**

- Create: `scripts/fetch-gex-dex.js`
- Create: `tests/gex-dex-fetch-config.test.js`
- Modify: `package.json`

**Step 1: Write the failing test**

```js
test('resolveGexDexTickers defaults to SPY and QQQ and normalizes configured values', () => {
  assert.deepEqual(resolveGexDexTickers('spy, qqq, SPY'), ['SPY', 'QQQ']);
  assert.deepEqual(resolveGexDexTickers(''), ['SPY', 'QQQ']);
});
```

**Step 2: Run the test to verify it fails**

Run: `node --test tests/gex-dex-fetch-config.test.js`

Expected: fail because the fetch script/config helper does not exist.

**Step 3: Write the minimal implementation**

- Fetch each configured ticker through the source adapter.
- Persist snapshots independently; a failed ticker produces a partial-success fetch run instead of discarding successful symbols.
- Add `fetch:gex-dex` to `package.json`.
- Do not call `scripts/fetch-daily.js` or add GammaLens to it.

**Step 4: Run the test to verify it passes**

Run: `node --test tests/gex-dex-fetch-config.test.js tests/gammalens-gex-dex.test.js`

Expected: pass.

### Task 5: Render the Options Positioning dashboard

**Files:**

- Create: `lib/utils/gex-dex-dashboard-view.js`
- Create: `app/gex-dex-section.js`
- Create: `app/gex-dex-section-view.js`
- Create: `tests/gex-dex-dashboard-view.test.js`
- Modify: `app/page.js`
- Modify: `app/dashboard-top-nav.js`
- Modify: `app/restyle.css`

**Step 1: Write the failing view-model tests**

```js
test('buildGexDexDashboardView exposes a current positioning map and normalizes strike bars', () => {
  const view = buildGexDexDashboardView([snapshot], [strike]);
  assert.equal(view.cards[0].signal.label, 'Range');
  assert.equal(view.cards[0].strikes[0].gexBarPct, 100);
});
```

**Step 2: Run the test to verify it fails**

Run: `node --test tests/gex-dex-dashboard-view.test.js`

Expected: fail because the dashboard view model does not exist.

**Step 3: Write the minimal implementation**

- Add a server-rendered “Options Positioning · Beta” section just after the market overview, with a nav anchor.
- Render one card per current snapshot: freshness badge, spot/level ladder, contextual state, provider context, and separate compact GEX/DEX per-strike charts.
- Use neutral/GEX-regime colours; do not imply a buy or sell action.
- Show an explicit empty state when snapshots are unavailable and a stale warning when the provider marks a snapshot stale.
- Keep all numerical formatting and chart normalization in the view-model layer; components only render it.

**Step 4: Run the test to verify it passes**

Run: `node --test tests/gex-dex-dashboard-view.test.js`

Expected: pass.

### Task 6: Schedule and document the isolated beta pipeline

**Files:**

- Create: `.github/workflows/gex-dex-snapshots.yml`
- Modify: `README.md`
- Modify: `AVAILABLE_DATA.md`
- Create: `docs/indicators/gex-dex-options-positioning.md`

**Step 1: Add documentation tests/checks where applicable**

Run: `node --test tests/fetch-daily-workflow.test.js tests/migration-sql.test.js`

Expected: existing workflow tests remain green; no core fetch behavior changes.

**Step 2: Write the minimal implementation**

- Create a dedicated workflow that runs `fetch:gex-dex` and `calculate:gex-dex-signals` on a weekday hourly cadence plus manual dispatch. It must not invoke the core daily price fetch.
- Document that GitHub cron is an indicative beta scheduler, the data is provider-derived, and signals are contextual rather than trade instructions.
- Document `GEX_DEX_TICKERS=SPY,QQQ` and the two commands.

**Step 3: Verify full integration**

Run:

```bash
node --test tests/gammalens-gex-dex.test.js tests/gex-dex-snapshots.test.js tests/gex-dex-regime.test.js tests/gex-dex-fetch-config.test.js tests/gex-dex-dashboard-view.test.js
npm run db:migrate
npm run fetch:gex-dex
npm run calculate:gex-dex-signals
npm run build
```

Expected: tests, migration, data fetch, calculation, and production build pass. Verify the dashboard’s SPY/QQQ cards manually with stored snapshots.

**Step 4: Commit**

```bash
git add docs/plans/2026-07-10-gex-dex-options-positioning.md lib/sources/gammalens-gex-dex.js lib/repositories/gex-dex-snapshots.js lib/indicators/gex-dex-regime.js lib/repositories/gex-dex-signals.js scripts/fetch-gex-dex.js scripts/calculate-gex-dex-signals.js db/migrations/027_create_gex_dex_snapshot_tables.sql db/migrations/028_create_gex_dex_signal_snapshots.sql app/gex-dex-section.js app/gex-dex-section-view.js app/page.js app/dashboard-top-nav.js app/restyle.css .github/workflows/gex-dex-snapshots.yml README.md AVAILABLE_DATA.md docs/indicators/gex-dex-options-positioning.md tests/gammalens-gex-dex.test.js tests/gex-dex-snapshots.test.js tests/gex-dex-regime.test.js tests/gex-dex-fetch-config.test.js tests/gex-dex-dashboard-view.test.js package.json
git commit -m "feat: add GammaLens GEX/DEX positioning beta"
```
