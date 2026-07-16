import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

function source(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
}

test('TF Sync renders in a fixed top overlay instead of a price-anchored marker series', () => {
  const financialChart = source('app/chart/financial-chart.js');
  const chartCss = source('app/chart/chart.css');

  assert.match(financialChart, /chart-tf-sync-top-layer/);
  assert.match(financialChart, /timeToCoordinate/);
  assert.doesNotMatch(
    financialChart,
    /addMarkerLayer\(chart, series, \{\s*key: ['"]tfSync['"]/s
  );
  assert.match(chartCss, /\.chart-tf-sync-top-layer\s*\{/);
  assert.match(chartCss, /\.chart-tf-sync-top-marker\s*\{/);
});

test('an empty OCC database triggers an initial historical backfill', () => {
  const occFetch = source('scripts/fetch-occ-volume-totals.js');

  assert.match(occFetch, /OCC_INITIAL_BACKFILL_DAYS/);
  assert.doesNotMatch(
    occFetch,
    /if \(!latestStoredDate\) \{\s*return \[today\];\s*\}/s
  );
});

test('the daily workflow calculates the 2Y + 10Y indicator', () => {
  const workflow = source('.github/workflows/fetch-daily.yml');

  assert.match(
    workflow,
    /Calculate 2Y \+ 10Y indicator[\s\S]*?npm run calculate:yield-2y-10y/
  );
});
