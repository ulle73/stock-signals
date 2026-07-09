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
