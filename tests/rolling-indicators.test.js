import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateTickerIndicators } from '../lib/utils/rolling-indicators.js';

test('calculateTickerIndicators uses adj_close before close and honors warmup windows', () => {
  const rows = [
    { ticker: 'AAPL', date: '2026-01-01', close: '10', adj_close: null, volume: '100' },
    { ticker: 'AAPL', date: '2026-01-02', close: '20', adj_close: '50', volume: '200' },
    { ticker: 'AAPL', date: '2026-01-03', close: '30', adj_close: null, volume: '300' },
  ];

  const indicators = calculateTickerIndicators(rows, [
    { key: 'sma1', size: 1 },
    { key: 'sma2', size: 2 },
    { key: 'sma3', size: 3 },
  ], {
    volumeWindowSize: 2,
    highLowWindowSize: 3,
  });

  assert.deepEqual(indicators, [
    {
      ticker: 'AAPL',
      date: '2026-01-01',
      indicator_price: 10,
      daily_return_pct: null,
      avg_volume20: null,
      relative_volume20: null,
      pct_from_52w_high: null,
      pct_from_52w_low: null,
      sma1: 10,
      sma2: null,
      sma3: null,
    },
    {
      ticker: 'AAPL',
      date: '2026-01-02',
      indicator_price: 50,
      daily_return_pct: 400,
      avg_volume20: 150,
      relative_volume20: 1.333333,
      pct_from_52w_high: null,
      pct_from_52w_low: null,
      sma1: 50,
      sma2: 30,
      sma3: null,
    },
    {
      ticker: 'AAPL',
      date: '2026-01-03',
      indicator_price: 30,
      daily_return_pct: -40,
      avg_volume20: 250,
      relative_volume20: 1.2,
      pct_from_52w_high: -40,
      pct_from_52w_low: 200,
      sma1: 30,
      sma2: 40,
      sma3: 30,
    },
  ]);
});

test('calculateTickerIndicators throws when no usable price exists', () => {
  assert.throws(
    () => calculateTickerIndicators([
      { ticker: 'MSFT', date: '2026-01-01', close: null, adj_close: null, volume: '100' },
    ]),
    /usable indicator price/i
  );
});
