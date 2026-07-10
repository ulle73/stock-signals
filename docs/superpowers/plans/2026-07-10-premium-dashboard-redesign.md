# Premium Dashboard Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** Redesign the MarketSignals dashboard as a premium dark, decision-first view without changing business, data, signal, query, or backend behavior.

**Architecture:** Keep app/page.js as the current server-side composition point for the existing dashboard snapshot and view models. Add prop-only presentation components for line icons and the top navigation, render the existing all-row equity sector matrix immediately after change cards, and contain visual changes in app/restyle.css.

**Tech Stack:** Next.js 16, React 19, CSS, Node.js built-in test runner, existing ThemeToggle.

## Global Constraints

- Do not modify lib/, db/, scripts/, app/api/, migrations, repositories, queries, fetches, calculations, rankings, thresholds, sort order, signal logic, or the data model.
- Do not add dependencies or mock financial values, time-series points, signals, timestamps, or sector rows.
- New presentational components accept props and never fetch. Use only values already available to app/page.js.
- The main recommendation must render the existing interpretation.headlineLabel. Do not hardcode a bullish recommendation.
- Numeric values may be visualized as bars, meters, or chips only; do not derive ROC, acceleration, trend, rank, or sector strength.
- Use the existing EquitySectorStyleRegimePerformanceSection as-is for sector data. It already iterates every available matrix.rows item; do not filter it to a top/bottom subset.
- Do not call or re-enable app/api/sector-factor-regime-performance/route.js. That existing route returns HTTP 410.
- Preserve ThemeToggle. Use dark only as the fallback when no saved user theme exists.
- Only app/, tests/dashboard-presentation-contract.test.js, and the design/plan documents may change.

---

## File structure

| File | Responsibility |
| --- | --- |
| app/dashboard-icons.js | Stateless local SVG line-icon primitive. |
| app/dashboard-top-nav.js | Prop-driven top navigation with existing anchors, ThemeToggle, and a supplied timestamp label. |
| app/layout.js | Minimal global shell and dark fallback. |
| app/page.js | Existing-data composition for hero, change cards, primary sector placement, and status footer. |
| app/equity-sector-style-regime-performance-section.js | Primary presentation class and UI copy for the existing all-row matrix. |
| app/restyle.css | Dark fintech styling and responsive rules. |
| tests/dashboard-presentation-contract.test.js | UI-only source contracts; existing calculation tests remain unchanged. |

## Task 1: Add the presentation-only navigation foundation

**Files:**
- Create: app/dashboard-icons.js
- Create: app/dashboard-top-nav.js
- Modify: app/layout.js:1-84
- Create: tests/dashboard-presentation-contract.test.js

**Interfaces:**
- Consumes: updatedLabel string from app/page.js and existing ThemeToggle.
- Produces: DashboardIcon({ name, size, title }) and DashboardTopNav({ updatedLabel }); neither reads dashboard data or fetches.

- [ ] **Step 1: Write the failing navigation contract test.**

~~~js
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const root = process.cwd();
const readSource = (relativePath) => readFile(path.join(root, relativePath), 'utf8');

test('dashboard uses a prop-driven top navigation instead of a sidebar shell', async () => {
  const [layout, topNav] = await Promise.all([
    readSource('app/layout.js'),
    readSource('app/dashboard-top-nav.js'),
  ]);

  assert.doesNotMatch(layout, /className="side-nav"/);
  assert.match(topNav, /export default function DashboardTopNav\(\{ updatedLabel \}\)/);
  assert.match(topNav, /href: '#oversikt'/);
  assert.match(topNav, /href: '#sektorer'/);
  assert.match(topNav, /<ThemeToggle\s*\/>/);
});
~~~

- [ ] **Step 2: Run the test to verify it fails for the expected reason.**

Run: node --test tests/dashboard-presentation-contract.test.js

Expected: FAIL because app/dashboard-top-nav.js is absent and the layout still includes the side-nav markup.

- [ ] **Step 3: Create the local line-icon component.**

~~~js
// app/dashboard-icons.js
const paths = {
  grid: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z',
  signal: 'M3 17l5-5 4 3 8-9M16 6h4v4',
  eye: 'M2.5 12s3.5-6 9.5-6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6zm9.5 2.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
  layers: 'M12 3 3 8l9 5 9-5-9-5zm-9 9 9 5 9-5M3 16l9 5 9-5',
  clock: 'M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z',
  settings: 'M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zm0-12v2m0 13v2m8.5-8.5h-2m-13 0h-2',
  target: 'M12 3v3m0 12v3M3 12h3m12 0h3M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z',
  shield: 'M12 3 4.5 6v5.5c0 4.4 3.1 7.7 7.5 9.5 4.4-1.8 7.5-5.1 7.5-9.5V6L12 3zm-3.2 9.1 2.1 2.1 4.4-4.4',
  gauge: 'M4 16a8 8 0 1 1 16 0M12 12l3.8-3.8M5 19h14',
  database: 'M4 6c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3zm0 0v6c0 1.7 3.6 3 8 3s8-1.3 8-3V6m-16 6v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6',
};

export default function DashboardIcon({ name = 'grid', size = 16, title }) {
  return (
    <svg aria-hidden={title ? undefined : true} className="dashboard-icon" fill="none" height={size} role={title ? 'img' : undefined} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" viewBox="0 0 24 24" width={size}>
      {title ? <title>{title}</title> : null}
      <path d={paths[name] ?? paths.grid} />
    </svg>
  );
}
~~~

- [ ] **Step 4: Create the top navigation and simplify the layout shell.**

~~~js
// app/dashboard-top-nav.js
import ThemeToggle from './theme-toggle.js';
import DashboardIcon from './dashboard-icons.js';

const navItems = [
  { href: '#oversikt', icon: 'grid', label: 'Översikt' },
  { href: '#signaler', icon: 'signal', label: 'Signaler' },
  { href: '#alla-aktier', icon: 'eye', label: 'Bevakning' },
  { href: '#sektorer', icon: 'layers', label: 'Sektorer' },
  { href: '#signaler', icon: 'clock', label: 'Historik' },
  { icon: 'settings', label: 'Inställningar' },
];

export default function DashboardTopNav({ updatedLabel }) {
  return (
    <header className="market-topbar">
      <a className="market-brand" href="#oversikt">
        <span className="market-brand-mark"><DashboardIcon name="signal" size={22} /></span>
        <span>Market<span>Signals</span></span>
      </a>
      <nav className="market-top-nav" aria-label="Huvudnavigation">
        {navItems.map((item) => (item.href ? (
          <a className={item.label === 'Översikt' ? 'is-active' : undefined} href={item.href} key={item.label}>
            <DashboardIcon name={item.icon} size={15} />{item.label}
          </a>
        ) : (
          <span aria-disabled="true" key={item.label}><DashboardIcon name={item.icon} size={15} />{item.label}</span>
        )))}
      </nav>
      <div className="market-topbar-meta">
        <span className="market-live-dot" aria-hidden="true" />
        <span>{updatedLabel}</span>
        <ThemeToggle />
      </div>
    </header>
  );
}
~~~

Replace the layout body with the following and remove navItems plus the ThemeToggle import:

~~~jsx
<body>
  <div className="app-frame">{children}</div>
</body>
~~~

Change only the fallback assignment in the existing inline theme script:

~~~js
var savedTheme = localStorage.getItem('theme') || 'dark';
~~~

- [ ] **Step 5: Re-run the test and commit the navigation foundation.**

Run: node --test tests/dashboard-presentation-contract.test.js

Expected: PASS with one navigation contract test.

~~~bash
git add app/dashboard-icons.js app/dashboard-top-nav.js app/layout.js tests/dashboard-presentation-contract.test.js
git commit -m "feat: add premium dashboard top navigation"
~~~

## Task 2: Recompose the first viewport from existing data only

**Files:**
- Modify: app/page.js:1-376
- Modify: tests/dashboard-presentation-contract.test.js

**Interfaces:**
- Consumes: current latestRun, latestSignal, interpretation, positionCurrent, scorePct, exposurePct, interpretation.heatmap, coverage, and existing format functions.
- Produces: a decision-first hero, change cards that contain only supplied values, and a status rail. No snapshot property or financial calculation is added.

- [ ] **Step 1: Append the failing first-viewport contract test.**

~~~js
test('overview keeps current recommendation dominant and renders existing dashboard values', async () => {
  const source = await readSource('app/page.js');

  assert.match(source, /<DashboardTopNav updatedLabel=\{formatTimestamp\(latestRun\?\.finished_at\)\}/);
  assert.match(source, /<h1>\{interpretation\.headlineLabel\}<\/h1>/);
  assert.match(source, /Beslutsstyrka/);
  assert.match(source, /Rekommenderad exponering/);
  assert.match(source, /interpretation\.heatmap\.map/);
  assert.match(source, /dashboard-status-rail/);
});
~~~

- [ ] **Step 2: Run it before editing page composition.**

Run: node --test tests/dashboard-presentation-contract.test.js

Expected: FAIL because the existing page does not use DashboardTopNav or dashboard-status-rail.

- [ ] **Step 3: Import the presentation components and place the top nav as the first child of main.**

~~~js
import DashboardIcon from './dashboard-icons.js';
import DashboardTopNav from './dashboard-top-nav.js';
~~~

~~~jsx
// First child of the existing <main className="page-shell restyle-page">.
<DashboardTopNav updatedLabel={formatTimestamp(latestRun?.finished_at)} />
~~~

- [ ] **Step 4: Replace only the overview JSX with the following existing-value composition.**

~~~jsx
<section className="category-section dashboard-overview" id="oversikt">
  <div className={['market-hero', toneClass(interpretation.tone)].join(' ')}>
    <div className="market-hero-copy">
      <p className="hero-label"><DashboardIcon name="target" size={15} /> Rekommendation</p>
      <p className="eyebrow">Dagens marknadsläge · {formatDate(latestSignal?.date)}</p>
      <h1>{interpretation.headlineLabel}</h1>
      <p className="hero-subline">{interpretation.actionBias}</p>
    </div>
    <div className="market-hero-kpis">
      <article className="hero-kpi-card">
        <span><DashboardIcon name="shield" size={16} /> Beslutsstyrka</span>
        <strong>{interpretation.displayScore ?? '—'}<small>/100</small></strong>
        <div className="hero-progress" aria-label={'Score ' + scorePct + ' av 100'}><i style={{ width: scorePct + '%' }} /></div>
      </article>
      <article className="hero-kpi-card">
        <span><DashboardIcon name="gauge" size={16} /> Risknivå</span>
        <strong>{positionCurrent?.signalLabel ?? 'Ingen positionsrad'}</strong>
        <small>{positionCurrent ? positionCurrent.hardRiskOffCount + ' hårda / ' + positionCurrent.cautionCount + ' caution' : 'Ingen riskstatus'}</small>
      </article>
      <article className="hero-kpi-card">
        <span><DashboardIcon name="grid" size={16} /> Rekommenderad exponering</span>
        <strong>{positionCurrent ? formatPercent(positionCurrent.appliedEquityPct, 0) : '—'}</strong>
        <div className="hero-progress" aria-label={exposurePct + '% investerat'}><i style={{ width: exposurePct + '%' }} /></div>
      </article>
    </div>
  </div>

  <section className="change-summary" aria-labelledby="change-summary-heading">
    <div className="compact-section-heading">
      <p className="section-kicker">Vad har förändrats?</p>
      <h2 id="change-summary-heading">Viktigaste förändringarna</h2>
    </div>
    <div className="metric-strip">
      {interpretation.heatmap.map((item) => <ReasonTile item={item} key={item.key} />)}
    </div>
  </section>
</section>
~~~

Update ReasonTile to retain item.label, item.value, item.detail, and item.tone exactly and replace the empty reason-spark with a decorative DashboardIcon. Do not add a sparkline because these existing heatmap items do not provide a series.

- [ ] **Step 5: Add the existing data-health values as the final status rail without deriving coverage.**

~~~jsx
<footer className="dashboard-status-rail" aria-label="Datastatus">
  <span><DashboardIcon name="database" size={14} /> Fetch: {formatStatus(latestRun?.status)}</span>
  <span>Senaste prisdatum: {formatDate(coverage.latest_price_date)}</span>
  <span>Täckning: {formatNumber(coverage.priced_ticker_count)} / {formatNumber(coverage.active_ticker_count)}</span>
</footer>
~~~

Place it as the last child of main. It displays two existing counts rather than calculating a percentage.

- [ ] **Step 6: Re-run the test and commit this UI-only composition.**

Run: node --test tests/dashboard-presentation-contract.test.js

Expected: PASS with navigation and first-viewport contracts.

~~~bash
git add app/page.js tests/dashboard-presentation-contract.test.js
git commit -m "feat: redesign dashboard decision overview"
~~~

## Task 3: Make the existing full sector matrix the first detailed section

**Files:**
- Modify: app/page.js:1-376
- Modify: app/equity-sector-style-regime-performance-section.js:15-33
- Modify: tests/dashboard-presentation-contract.test.js

**Interfaces:**
- Consumes: unchanged EquitySectorStyleRegimePerformanceSection and its existing server-rendered matrix view model.
- Produces: a primary section with id=sektorer directly after change-summary. The existing RegimePerformanceMatrix continues to render every matrix.rows entry.

- [ ] **Step 1: Append the failing all-sector placement test.**

~~~js
test('full existing sector matrix follows change cards without a top-bottom subset', async () => {
  const [page, matrixRenderer] = await Promise.all([
    readSource('app/page.js'),
    readSource('app/macro-matrix-renderers.js'),
  ]);

  assert.match(page, /import EquitySectorStyleRegimePerformanceSection/);
  assert.ok(page.indexOf('change-summary') < page.indexOf('id="sektorer"'));
  assert.match(page, /<EquitySectorStyleRegimePerformanceSection\s*\/>/);
  assert.match(matrixRenderer, /matrix\.rows\.map\(\(row, index\)/);
});
~~~

- [ ] **Step 2: Run the test before mounting the primary section.**

Run: node --test tests/dashboard-presentation-contract.test.js

Expected: FAIL because the sector component is not mounted after change-summary.

- [ ] **Step 3: Mount the existing server component immediately after the change-summary.**

~~~js
import EquitySectorStyleRegimePerformanceSection from './equity-sector-style-regime-performance-section.js';
~~~

~~~jsx
<section className="category-section primary-sector-section" id="sektorer">
  <SectionIntro
    eyebrow="Sektorer"
    title="Sektorer – ranking och förändring"
    copy="Jämför alla tillgängliga sektorer samtidigt. Värden och trendmått kommer direkt från befintlig sektormatris."
  />
  <Suspense fallback={<SectionLoadingCard title="Sektormatris" copy="Läser in befintlig sektordata." />}>
    <EquitySectorStyleRegimePerformanceSection />
  </Suspense>
</section>
~~~

Do not add a route, client fetch, repository call, row filter, or any 1D/1W/1M/ROC/acceleration calculation. The existing component and renderer already iterate every available matrix row.

- [ ] **Step 4: Apply a primary presentation class and copy only.**

~~~jsx
<MacroMatrixSlide
  className="regime-stat-card macro-slide-equity-regime-performance primary-sector-matrix"
  title="Sektorer – regimperformance och styrka"
  subtitle="Jämför hela det befintliga sektorunderlaget. Färg och cellformat visar endast redan levererade värden."
  footnote={`Equity-tabellen visar samma sju block som referensen: average/median returns, volatility, Sharpe, win ratio, beta med OMXS30 och observationer. Aktuell regim är ${formatRegimeStatus(matrix.currentRegime)} per ${formatMatrixMonth(matrix.asOfDate)}.`}
>
~~~

Keep the existing matrix, rowHeader, rowBucket, and RegimePerformanceMatrix arguments unchanged.

- [ ] **Step 5: Re-run the test and commit the sector placement.**

Run: node --test tests/dashboard-presentation-contract.test.js

Expected: PASS with all-row sector matrix placement verified.

~~~bash
git add app/page.js app/equity-sector-style-regime-performance-section.js tests/dashboard-presentation-contract.test.js
git commit -m "feat: prioritize full sector matrix"
~~~

## Task 4: Apply the premium responsive visual system

**Files:**
- Modify: app/restyle.css:1-665
- Modify: tests/dashboard-presentation-contract.test.js

**Interfaces:**
- Consumes: only existing and newly introduced presentation class names.
- Produces: CSS-only dark fintech styling for navigation, hero, cards, the existing sector cell classes, and the status rail.

- [ ] **Step 1: Append the failing visual-system contract test.**

~~~js
test('premium dashboard styles include responsive navigation, hero, sector matrix, and status rail rules', async () => {
  const css = await readSource('app/restyle.css');

  assert.match(css, /\.market-topbar\s*\{/);
  assert.match(css, /\.market-hero-kpis\s*\{/);
  assert.match(css, /\.primary-sector-matrix\s*\{/);
  assert.match(css, /\.dashboard-status-rail\s*\{/);
  assert.match(css, /@media \(max-width: 1100px\)/);
  assert.match(css, /@media \(max-width: 640px\)/);
});
~~~

- [ ] **Step 2: Run the test and confirm the selector contract fails.**

Run: node --test tests/dashboard-presentation-contract.test.js

Expected: FAIL because the new selector set is not present.

- [ ] **Step 3: Append the desktop visual system to app/restyle.css.**

~~~css
:root {
  --market-surface: rgba(8, 14, 18, 0.86);
  --market-surface-raised: rgba(12, 21, 26, 0.96);
  --market-border: rgba(136, 167, 160, 0.16);
  --market-green-glow: rgba(0, 230, 118, 0.18);
}

.app-frame { display: block; min-height: 100vh; }
.page-shell.restyle-page { gap: 22px; margin: 0 auto; max-width: 1600px; padding: 14px 24px 28px; }
.market-topbar { align-items: center; background: rgba(5, 10, 13, 0.9); border-bottom: 1px solid var(--market-border); display: grid; gap: 24px; grid-template-columns: auto minmax(0, 1fr) auto; min-height: 58px; padding: 0 2px; position: sticky; top: 0; z-index: 20; }
.market-brand, .market-top-nav a, .market-top-nav span, .market-topbar-meta { align-items: center; display: inline-flex; gap: 8px; }
.market-brand { color: var(--text); font-size: 1rem; font-weight: 750; text-decoration: none; white-space: nowrap; }
.market-brand > span:last-child > span, .market-brand-mark { color: var(--accent); }
.market-top-nav { display: flex; gap: 4px; justify-content: center; min-width: 0; }
.market-top-nav a, .market-top-nav span { border-radius: 10px; color: var(--muted); font-size: 0.78rem; padding: 9px 11px; text-decoration: none; }
.market-top-nav a:hover, .market-top-nav a:focus-visible, .market-top-nav .is-active { background: rgba(255, 255, 255, 0.055); color: var(--text); outline: none; }
.market-top-nav .is-active .dashboard-icon, .market-live-dot { color: var(--accent); }
.market-topbar-meta { color: var(--muted); font-size: 0.75rem; justify-content: flex-end; white-space: nowrap; }
.market-live-dot { background: var(--accent); border-radius: 50%; box-shadow: 0 0 10px var(--market-green-glow); height: 7px; width: 7px; }

.market-hero { background: linear-gradient(105deg, rgba(14, 39, 26, 0.82), var(--market-surface-raised) 56%); border: 1px solid var(--market-border); border-radius: 20px; box-shadow: 0 20px 44px rgba(0, 0, 0, 0.28); display: grid; gap: 28px; grid-template-columns: minmax(0, 1.35fr) minmax(440px, 1fr); padding: 30px 34px; }
.hero-label { align-items: center; color: var(--accent); display: flex; font-size: 0.72rem; font-weight: 750; gap: 7px; letter-spacing: 0.12em; margin: 0 0 16px; text-transform: uppercase; }
.market-hero h1 { font-size: clamp(2.45rem, 5.2vw, 5.4rem); letter-spacing: -0.065em; line-height: 0.9; margin: 0; text-transform: uppercase; }
.market-hero-kpis { display: grid; gap: 10px; grid-template-columns: repeat(3, minmax(0, 1fr)); }
.hero-kpi-card { background: rgba(1, 7, 9, 0.4); border: 1px solid var(--market-border); border-radius: 14px; display: grid; gap: 11px; padding: 17px; }
.hero-kpi-card > span { align-items: center; color: var(--muted); display: flex; font-size: 0.68rem; gap: 6px; text-transform: uppercase; }
.hero-kpi-card strong { color: var(--text); font-size: clamp(1.25rem, 2vw, 1.9rem); line-height: 1.05; }
.hero-progress { background: rgba(255, 255, 255, 0.09); border-radius: 999px; height: 6px; overflow: hidden; }
.hero-progress i { background: linear-gradient(90deg, #42ce6a, var(--accent)); border-radius: inherit; box-shadow: 0 0 13px var(--market-green-glow); display: block; height: 100%; }

.reason-tile { background: var(--market-surface); border: 1px solid var(--market-border); border-radius: 14px; min-height: 148px; padding: 17px; }
.dashboard-status-rail { align-items: center; border-top: 1px solid var(--market-border); color: var(--muted); display: flex; flex-wrap: wrap; font-size: 0.76rem; gap: 13px 24px; margin-top: 10px; padding: 15px 3px 0; }
.dashboard-status-rail span { align-items: center; display: inline-flex; gap: 7px; }
~~~

- [ ] **Step 4: Add matrix emphasis and mobile behavior.**

~~~css
.primary-sector-section { margin-top: 6px; }
.primary-sector-matrix { background: var(--market-surface-raised); border: 1px solid var(--market-border); box-shadow: 0 22px 46px rgba(0, 0, 0, 0.22); }
.primary-sector-matrix .regime-stat-scroll { border: 1px solid rgba(136, 167, 160, 0.12); border-radius: 14px; margin-top: 18px; }
.primary-sector-matrix .regime-stat-table tbody th, .primary-sector-matrix .regime-stat-table tbody td { border-bottom-color: rgba(136, 167, 160, 0.1); }
.primary-sector-matrix .regime-stat-table tbody tr:hover { background: rgba(255, 255, 255, 0.035); }
.primary-sector-matrix .macro-positive, .primary-sector-matrix .macro-strong_positive { box-shadow: inset 3px 0 0 rgba(0, 230, 118, 0.68); }
.primary-sector-matrix .macro-negative, .primary-sector-matrix .macro-strong_negative { box-shadow: inset 3px 0 0 rgba(239, 68, 68, 0.68); }

@media (max-width: 1100px) {
  .market-topbar { gap: 12px; }
  .market-top-nav { justify-content: flex-start; overflow-x: auto; scrollbar-width: none; }
  .market-top-nav::-webkit-scrollbar { display: none; }
  .market-hero { grid-template-columns: 1fr; }
  .market-hero-kpis { grid-template-columns: repeat(3, minmax(145px, 1fr)); }
}

@media (max-width: 640px) {
  .page-shell.restyle-page { padding: 8px 14px 22px; }
  .market-topbar { grid-template-columns: 1fr auto; padding: 10px 0; }
  .market-top-nav { grid-column: 1 / -1; grid-row: 2; }
  .market-topbar-meta > span:not(.market-live-dot) { display: none; }
  .theme-toggle { padding: 6px 10px; }
  .market-hero { border-radius: 16px; gap: 22px; padding: 23px 20px; }
  .market-hero h1 { font-size: clamp(2.2rem, 14vw, 3.45rem); }
  .market-hero-kpis { grid-template-columns: 1fr; }
  .metric-strip { grid-template-columns: 1fr 1fr; }
}
~~~

Do not add synthetic sparklines. Existing sector cell classes may receive visual emphasis because they already reflect the supplied matrix cells.

- [ ] **Step 5: Re-run the test and commit the visual system.**

Run: node --test tests/dashboard-presentation-contract.test.js

Expected: PASS with navigation, hero, sector, and responsive style contracts.

~~~bash
git add app/restyle.css tests/dashboard-presentation-contract.test.js
git commit -m "style: apply premium market dashboard system"
~~~

## Task 5: Verify the UI-only implementation end to end

**Files:**
- Verify: app/layout.js, app/dashboard-icons.js, app/dashboard-top-nav.js, app/page.js, app/equity-sector-style-regime-performance-section.js, app/restyle.css, tests/dashboard-presentation-contract.test.js

**Interfaces:**
- Consumes: completed presentation components and unchanged dashboard data paths.
- Produces: build, visual, responsive, and scope-audit evidence.

- [ ] **Step 1: Run presentation and unchanged view-model tests.**

~~~bash
node --test tests/dashboard-presentation-contract.test.js tests/dashboard-view.test.js tests/dashboard-repository.test.js
~~~

Expected: PASS with zero failures.

- [ ] **Step 2: Run the production build.**

~~~bash
npm run build
~~~

Expected: exit code 0 and a completed Next.js production build.

- [ ] **Step 3: Inspect desktop and mobile in an actual browser.**

Start the existing app with its local environment. Inspect / at 1440px and 390px widths and save a screenshot for each.

~~~text
Desktop: top navigation is compact; the current recommendation is dominant; strength,
risk, exposure, and the change cards precede the primary sector matrix.
Desktop: the primary matrix displays every available existing matrix row.
Mobile: navigation scrolls horizontally; KPI cards stack; matrix overflow remains contained.
~~~

If the existing sector source has no rows, retain the current fallback behavior and report that condition. Never insert mock rows.

- [ ] **Step 4: Audit changed paths and whitespace before handoff.**

~~~bash
git diff --name-only main...HEAD
git diff --check main...HEAD
git status --short
~~~

Expected: code changes are limited to app/ and tests/dashboard-presentation-contract.test.js; no changed path under lib/, db/, scripts/, .github/, or app/api/.

- [ ] **Step 5: Commit only a verification-driven presentation adjustment, if one was necessary.**

~~~bash
git add app tests/dashboard-presentation-contract.test.js
git commit -m "fix: polish responsive dashboard presentation"
~~~

Do this only when visual inspection required a presentation-only correction. In the handoff, list every changed file and explicitly state that no backend, query, calculation, threshold, sort order, signal logic, or data model was modified.

## Plan self-review

- **Spec coverage:** Tasks 1–2 implement the dark top-nav shell and dominant first viewport. Task 3 makes the existing full matrix the first detailed section. Task 4 provides responsive premium styling. Task 5 proves build, visual behavior, and scope.
- **Data safety:** The plan neither changes nor adds a repository, API route, query, calculation, ranking, threshold, or model. It avoids the disabled sector API and reuses the existing server component.
- **Missing-data safety:** No synthetic sector row or sparkline is introduced. Existing empty and loading behavior remains intact.
- **Type consistency:** DashboardTopNav accepts only the updatedLabel string from Home. DashboardIcon is prop-only. The sector component and matrix interfaces stay unchanged.
- **Placeholder scan:** Every code step specifies exact files, commands, expected results, and implementation snippets.
