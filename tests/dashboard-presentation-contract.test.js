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
