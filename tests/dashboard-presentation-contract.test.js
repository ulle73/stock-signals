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

test('overview uses the existing market decision with the reference-style action hero', async () => {
  const [source, referenceView] = await Promise.all([
    readSource('app/page.js'),
    readSource('lib/utils/dashboard-reference-view.js'),
  ]);

  assert.match(source, /<DashboardTopNav updatedLabel=\{formatTimestamp\(latestRun\?\.finished_at\)\}/);
  assert.match(source, /getSectorOverviewSnapshot/);
  assert.match(source, /buildReferenceMarketMetrics/);
  assert.match(source, /<h1>\{overviewAction\}<\/h1>/);
  assert.match(source, /reference-hero/);
  assert.match(source, /reference-recommendation/);
  assert.match(referenceView, /ÖKA EXPONERING/);
  assert.match(referenceView, /MINSKA EXPONERING/);
});

test('all current sectors follow the compact market cards with performance, ROC, acceleration, and trend', async () => {
  const [page, matrix] = await Promise.all([
    readSource('app/page.js'),
    readSource('app/sector-overview-matrix.js'),
  ]);

  assert.match(page, /import SectorOverviewMatrix/);
  assert.doesNotMatch(page, /EquitySectorStyleRegimePerformanceSection/);
  assert.ok(page.indexOf('reference-metric-grid') < page.indexOf('id="sektorer"'));
  assert.match(page, /<SectorOverviewMatrix snapshot=\{sectorOverview\} \/>/);
  assert.match(matrix, /snapshot\.rows\.map\(\(row\)/);
  assert.match(matrix, /ROC 5D \/ Acceleration/);
  assert.match(matrix, /return1d/);
  assert.match(matrix, /return1w/);
  assert.match(matrix, /return1m/);
  assert.match(matrix, /sparkline/);
});

test('reference dashboard styles include compact hero, six-card strip, and sector matrix rules', async () => {
  const css = await readSource('app/restyle.css');

  assert.match(css, /\.market-topbar\s*\{/);
  assert.match(css, /\.reference-hero\s*\{/);
  assert.match(css, /\.reference-metric-grid\s*\{/);
  assert.match(css, /\.sector-overview-table\s*\{/);
  assert.match(css, /\.acceleration-segments\s*\{/);
  assert.match(css, /@media \(max-width: 1100px\)/);
  assert.match(css, /@media \(max-width: 640px\)/);
});

test('watchlist icon uses a valid closed eye path', async () => {
  const source = await readSource('app/dashboard-icons.js');

  assert.match(source, /eye: 'M2 12C4\.8 7\.8 7\.8 6 12 6s7\.2 1\.8 10 6c-2\.8 4\.2-5\.8 6-10 6S4\.8 16\.2 2 12Zm13 0a3 3 0 1 1-6 0a3 3 0 0 1 6 0'/);
});

test('reference sector matrix keeps horizontal overflow inside its own panel', async () => {
  const css = await readSource('app/restyle.css');

  assert.match(css, /\.sector-overview-section\s*\{[^}]*min-width:\s*0;/s);
  assert.match(css, /\.sector-overview-card\s*\{[^}]*min-width:\s*0;/s);
  assert.match(css, /\.sector-overview-scroll\s*\{[^}]*max-width:\s*100%;/s);
});

test('reference sector matrix keeps strength bars, signed values, and segmented acceleration visible', async () => {
  const css = await readSource('app/restyle.css');

  assert.match(css, /\.sector-strength-bar\s*\{/);
  assert.match(css, /\.sector-return\.is-positive\s*\{/);
  assert.match(css, /\.sector-return\.is-negative\s*\{/);
  assert.match(css, /\.acceleration-segments i\s*\{/);
});

test('reference metric strip uses six equal desktop cards', async () => {
  const css = await readSource('app/restyle.css');

  assert.match(css, /\.reference-metric-grid\s*\{[^}]*grid-template-columns:\s*repeat\(6, minmax\(0, 1fr\)\);/s);
});

test('backtest table gives duplicate strategy codes distinct React keys', async () => {
  const source = await readSource('app/page.js');

  assert.match(source, /function renderBacktestRow\(row, index\)/);
  assert.match(source, /key=\{`\$\{row\.code\}-\$\{index\}`\}/);
  assert.match(source, /backtests\.map\(\(row, index\) => renderBacktestRow\(row, index\)\)/);
});
