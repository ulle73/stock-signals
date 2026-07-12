import test from 'node:test';
import assert from 'node:assert/strict';
import {
  RYD_OBV_LEVELS,
  buildRawObvLineData,
  buildRydObvHistogramData,
  buildRydObvMarkers,
  getRydObvZscoreColor,
} from '../lib/chart/ryd-obv-series.js';

test('RYD OBV chart exposes the exact TradingView reference levels', () => {
  assert.deepEqual(RYD_OBV_LEVELS.map(({ value }) => value), [-6, -2.7, -1.25, 0, 1.25, 2.7, 6]);
});

test('RYD OBV Z-score colors use gray neutral, green positive, red negative, and yellow extremes', () => {
  assert.equal(getRydObvZscoreColor(3), '#fffb00');
  assert.equal(getRydObvZscoreColor(2.7), '#fffb00');
  assert.equal(getRydObvZscoreColor(2), '#4caf50');
  assert.equal(getRydObvZscoreColor(1.25), '#6b7280');
  assert.equal(getRydObvZscoreColor(0), '#6b7280');
  assert.equal(getRydObvZscoreColor(-1.25), '#6b7280');
  assert.equal(getRydObvZscoreColor(-2), '#ef4444');
  assert.equal(getRydObvZscoreColor(-2.7), '#fffb00');
  assert.equal(getRydObvZscoreColor(-4), '#fffb00');
});

test('RYD OBV histogram and raw line skip warmup gaps and invalid values', () => {
  const bars = [
    { time: '2026-07-01', ryd_obv: 100, ryd_obv_zscore_80: null },
    { time: '2026-07-02', ryd_obv: 120, ryd_obv_zscore_80: -2 },
    { time: '2026-07-03', ryd_obv: 'bad', ryd_obv_zscore_80: 3 },
  ];

  assert.deepEqual(buildRydObvHistogramData(bars), [
    { time: '2026-07-02', value: -2, color: '#ef4444' },
    { time: '2026-07-03', value: 3, color: '#fffb00' },
  ]);

  assert.deepEqual(buildRawObvLineData(bars), [
    { time: '2026-07-01', value: 100 },
    { time: '2026-07-02', value: 120 },
  ]);
});

test('RYD OBV markers use stored signals only when the Z-score point exists', () => {
  const bars = [
    { time: '2026-07-01', ryd_obv_zscore_80: null, ryd_obv_buy_signal: true },
    { time: '2026-07-02', ryd_obv_zscore_80: -2.6, ryd_obv_buy_signal: true },
    { time: '2026-07-03', ryd_obv_zscore_80: 2.6, ryd_obv_sell_signal: true },
  ];

  assert.deepEqual(buildRydObvMarkers(bars), [
    {
      time: '2026-07-02',
      position: 'belowBar',
      color: '#34ff56',
      shape: 'arrowUp',
    },
    {
      time: '2026-07-03',
      position: 'aboveBar',
      color: '#ff3e3e',
      shape: 'arrowDown',
    },
  ]);
});
