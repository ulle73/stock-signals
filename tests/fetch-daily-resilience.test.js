import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const source = fs.readFileSync(new URL('../scripts/fetch-daily.js', import.meta.url), 'utf8');

test('fetch daily uses the shared operational coverage policy', () => {
  assert.match(source, /buildDailyPriceCoverageDecision/);
  assert.match(source, /coverageDecision\.canContinue/);
  assert.match(source, /coverageDecision\.isPartial/);
});

test('fetch daily no longer aborts merely because one constituent failed', () => {
  assert.doesNotMatch(
    source,
    /yahooResult\.failedTickers\.length > 0 \|\| benchmarkResult\.failedBenchmarks\.length > 0/
  );
});

test('fetch daily keeps benchmark failure and insufficient coverage as hard stops', () => {
  assert.match(source, /benchmarkResult\.failedBenchmarks\.length > 0/);
  assert.match(source, /Daily price coverage is insufficient/);
});

test('fetch daily records coverage and failed tickers in completion metadata', () => {
  assert.match(source, /dailyPriceCoverage: coverageDecision/);
  assert.match(source, /failedTickers: yahooResult\.failedTickers/);
});
