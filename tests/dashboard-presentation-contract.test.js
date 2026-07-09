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

test('overview keeps current recommendation dominant and renders existing dashboard values', async () => {
  const source = await readSource('app/page.js');

  assert.match(source, /<DashboardTopNav updatedLabel=\{formatTimestamp\(latestRun\?\.finished_at\)\}/);
  assert.match(source, /<h1>\{interpretation\.headlineLabel\}<\/h1>/);
  assert.match(source, /Beslutsstyrka/);
  assert.match(source, /Rekommenderad exponering/);
  assert.match(source, /interpretation\.heatmap\.map/);
  assert.match(source, /dashboard-status-rail/);
});

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

test('premium dashboard styles include responsive navigation, hero, sector matrix, and status rail rules', async () => {
  const css = await readSource('app/restyle.css');

  assert.match(css, /\.market-topbar\s*\{/);
  assert.match(css, /\.market-hero-kpis\s*\{/);
  assert.match(css, /\.primary-sector-matrix\s*\{/);
  assert.match(css, /\.dashboard-status-rail\s*\{/);
  assert.match(css, /@media \(max-width: 1100px\)/);
  assert.match(css, /@media \(max-width: 640px\)/);
});

test('watchlist icon uses a valid closed eye path', async () => {
  const source = await readSource('app/dashboard-icons.js');

  assert.match(source, /eye: 'M2 12C4\.8 7\.8 7\.8 6 12 6s7\.2 1\.8 10 6c-2\.8 4\.2-5\.8 6-10 6S4\.8 16\.2 2 12Zm13 0a3 3 0 1 1-6 0a3 3 0 0 1 6 0'/);
});

test('sector matrix keeps horizontal overflow inside its own panel', async () => {
  const css = await readSource('app/restyle.css');

  assert.match(css, /\.primary-sector-section\s*\{[^}]*min-width:\s*0;/s);
  assert.match(css, /\.primary-sector-matrix\s*\{[^}]*min-width:\s*0;/s);
  assert.match(css, /\.primary-sector-matrix \.regime-stat-scroll\s*\{[^}]*max-width:\s*100%;/s);
});

test('primary sector matrix keeps its heading and status badge in the dense dark presentation', async () => {
  const css = await readSource('app/restyle.css');

  assert.match(css, /\.primary-sector-matrix h2\s*\{[^}]*font-size:\s*clamp\(1\.65rem, 3vw, 2\.65rem\);/s);
  assert.match(css, /\.primary-sector-matrix \.macro-slide-badge\s*\{[^}]*background:\s*rgba\(1, 7, 9, 0\.72\);/s);
});

test('primary sector matrix overrides the inherited light table header', async () => {
  const css = await readSource('app/restyle.css');

  assert.match(css, /\.primary-sector-matrix \.macro-slide-table thead th\s*\{[^}]*background:\s*#0c171c !important;/s);
  assert.match(css, /\.primary-sector-matrix \.macro-slide-table tbody th\s*\{[^}]*background:\s*#0c171c;/s);
});

test('change cards use a compact desktop minimum width', async () => {
  const css = await readSource('app/restyle.css');

  assert.match(css, /\.metric-strip\s*\{[^}]*grid-template-columns:\s*repeat\(auto-fit, minmax\(150px, 1fr\)\);/s);
});
