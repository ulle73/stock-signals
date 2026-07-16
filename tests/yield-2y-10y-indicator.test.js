import test from 'node:test';
import assert from 'node:assert/strict';
import {
  alignYield2y10ySourceRows,
  buildYield2y10yIndicatorRows,
} from '../lib/indicators/yield-2y-10y.js';

function seriesRows(seriesId, values) {
  return values.map(([date, value]) => ({ series_id: seriesId, date, value }));
}

test('yield source alignment intersects daily yields and forward-fills FEDFUNDS', () => {
  const rows = [
    ...seriesRows('DGS2', [['2026-01-02', 6], ['2026-01-03', 4.8], ['2026-02-03', 2.5]]),
    ...seriesRows('DGS10', [['2026-01-02', 5], ['2026-01-03', 5], ['2026-02-03', 5]]),
    ...seriesRows('FEDFUNDS', [['2026-01-01', 5], ['2026-02-01', 6]]),
  ];

  assert.deepEqual(alignYield2y10ySourceRows(rows), [
    { date: '2026-01-02', two_year: 6, ten_year: 5, effr: 5 },
    { date: '2026-01-03', two_year: 4.8, ten_year: 5, effr: 5 },
    { date: '2026-02-03', two_year: 2.5, ten_year: 5, effr: 6 },
  ]);
});

test('yield state machine persists inversion, emits sell, and later emits buy', () => {
  const dates = ['2026-01-02', '2026-01-03', '2026-01-04', '2026-01-05', '2026-01-06', '2026-02-03'];
  const rows = [
    ...seriesRows('DGS2', dates.map((date, index) => [date, index === 0 ? 6 : index === 1 ? 4.8 : index === 5 ? 2.5 : 4.5])),
    ...seriesRows('DGS10', dates.map((date) => [date, 5])),
    ...seriesRows('FEDFUNDS', [['2026-01-01', 5], ['2026-02-01', 6]]),
  ];

  const result = buildYield2y10yIndicatorRows(rows);
  assert.equal(result[0].signal, 'inverted');
  assert.equal(result[0].is_inverted, true);
  assert.equal(result[1].signal, 'sell');
  assert.equal(result[1].sell_signal, true);
  assert.equal(result[1].is_short, true);
  assert.equal(result[4].signal, 'none');
  assert.equal(result[4].is_short, true);
  assert.equal(result[5].signal, 'buy');
  assert.equal(result[5].buy_signal, true);
  assert.equal(result[5].is_long, true);
  assert.equal(result[5].smooth_effr_5, 5.2);
  assert.equal(result[5].prev_smooth_effr_5, 5);
  assert.equal(result[5].prev_effr, 5);
  assert.equal(result[5].frr_2_10, 1.125);
});

test('yield state machine fails closed when required values are unavailable', () => {
  const rows = [
    ...seriesRows('DGS2', [['2026-01-02', 4]]),
    ...seriesRows('DGS10', [['2026-01-02', 0]]),
    ...seriesRows('FEDFUNDS', [['2026-01-01', 5]]),
  ];
  assert.deepEqual(buildYield2y10yIndicatorRows(rows), []);
});
