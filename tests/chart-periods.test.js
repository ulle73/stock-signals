import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CHART_PERIODS,
  getChartStartDate,
  normalizeChartPeriod,
  normalizeChartTicker,
} from '../lib/chart/chart-periods.js';

test('chart periods expose the supported public values', () => {
  assert.deepEqual(CHART_PERIODS, ['3M', '6M', '1Y', '2Y', 'ALL']);
});

test('normalizeChartPeriod accepts supported values and falls back to 1Y', () => {
  assert.equal(normalizeChartPeriod('3m'), '3M');
  assert.equal(normalizeChartPeriod(' all '), 'ALL');
  assert.equal(normalizeChartPeriod('bad'), '1Y');
  assert.equal(normalizeChartPeriod(undefined), '1Y');
});

test('getChartStartDate returns deterministic UTC calendar boundaries', () => {
  assert.equal(getChartStartDate('3M', '2026-07-10'), '2026-04-10');
  assert.equal(getChartStartDate('6M', '2026-07-10'), '2026-01-10');
  assert.equal(getChartStartDate('1Y', '2026-07-10'), '2025-07-10');
  assert.equal(getChartStartDate('2Y', '2026-07-10'), '2024-07-10');
  assert.equal(getChartStartDate('ALL', '2026-07-10'), null);
  assert.equal(getChartStartDate('1Y', null), null);
});

test('getChartStartDate clamps end-of-month dates safely', () => {
  assert.equal(getChartStartDate('3M', '2026-05-31'), '2026-02-28');
  assert.equal(getChartStartDate('1Y', '2024-02-29'), '2023-02-28');
});

test('normalizeChartTicker accepts listed symbol syntax and rejects malformed input', () => {
  assert.equal(normalizeChartTicker(' brk.b '), 'BRK.B');
  assert.equal(normalizeChartTicker('BF-B'), 'BF-B');
  assert.equal(normalizeChartTicker('AAPL'), 'AAPL');
  assert.equal(normalizeChartTicker('../AAPL'), null);
  assert.equal(normalizeChartTicker('AAPL?x=1'), null);
  assert.equal(normalizeChartTicker(''), null);
  assert.equal(normalizeChartTicker(undefined), null);
});
