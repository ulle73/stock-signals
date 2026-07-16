import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(
  new URL('../lib/repositories/chart-data.js', import.meta.url),
  'utf8'
);

test('chart data reads TF Sync from its dedicated optional table', () => {
  assert.doesNotMatch(
    source,
    /\bi\.tf_sync_/,
    'stock_daily_indicators must not be queried for TF Sync columns'
  );
  assert.match(source, /from tf_sync_indicator_daily/i);
  assert.match(source, /optionalRows\('TF Sync'/);
  assert.match(source, /Optional \$\{label\} chart layer unavailable/);
});
