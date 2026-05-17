import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPlceThresholdIndicatorRows } from '../lib/indicators/plce-threshold.js';

test('buildPlceThresholdIndicatorRows copies the daily PLCE threshold signal onto each ticker row by date', () => {
  const priceRows = [
    { ticker: 'AAPL', date: '2026-05-01' },
    { ticker: 'AAPL', date: '2026-05-02' },
    { ticker: 'AAPL', date: '2026-05-03' },
  ];
  const plceRows = [
    { date: '2026-05-01', plce_short_volume: '2500000' },
    { date: '2026-05-02', plce_short_volume: '3500001' },
  ];

  const indicatorRows = buildPlceThresholdIndicatorRows(priceRows, plceRows);

  assert.deepEqual(indicatorRows, [
    {
      ticker: 'AAPL',
      date: '2026-05-01',
      plce_threshold_value: 2500000,
      plce_threshold_buy_signal: false,
      plce_threshold_signal: 'none',
    },
    {
      ticker: 'AAPL',
      date: '2026-05-02',
      plce_threshold_value: 3500001,
      plce_threshold_buy_signal: true,
      plce_threshold_signal: 'buy',
    },
    {
      ticker: 'AAPL',
      date: '2026-05-03',
      plce_threshold_value: null,
      plce_threshold_buy_signal: false,
      plce_threshold_signal: 'none',
    },
  ]);
});
