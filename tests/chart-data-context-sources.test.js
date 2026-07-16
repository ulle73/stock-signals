import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../lib/repositories/chart-data.js', import.meta.url), 'utf8');

test('chart context sources remain optional and isolated', () => {
  assert.match(source, /async function optionalRows\(label, loader\)/);
  assert.match(source, /Optional \$\{label\} chart layer unavailable/);
  assert.match(source, /from gex_dex_source_snapshots/);
  assert.match(source, /from stock_relative_strength_daily/);
  assert.match(source, /from sector_breadth_daily/);
  assert.match(source, /from market_breadth_daily/);
  assert.match(source, /from stock_earnings_calendar_daily/);
  assert.match(source, /limit 340/);
});

test('chart payload exposes all context families without changing bar joins', () => {
  assert.match(source, /gexDexSnapshots: normalizeGexDexSnapshots/);
  assert.match(source, /relativeStrengthContext: buildRelativeStrengthContext/);
  assert.match(source, /breadthContext: buildBreadthContext/);
  assert.match(source, /volatilityContext: buildVolatilityContext/);
  assert.match(source, /earningsEvents: earnings\.events/);
  assert.match(source, /nextEarnings: earnings\.nextEarnings/);
});
