import test from 'node:test';
import assert from 'node:assert/strict';
import { buildMarketBreadthRows } from '../lib/utils/market-breadth.js';

test('buildMarketBreadthRows aggregates breadth counts and percentages by date', () => {
  const rows = [
    {
      ticker: 'AAPL',
      date: '2026-01-02',
      indicator_price: 110,
      daily_return_pct: 2,
      sma20: 100,
      sma50: 120,
      sma200: null,
      pct_from_52w_high: 0,
      pct_from_52w_low: 80,
    },
    {
      ticker: 'MSFT',
      date: '2026-01-02',
      indicator_price: 90,
      daily_return_pct: -1,
      sma20: 100,
      sma50: 80,
      sma200: 85,
      pct_from_52w_high: -10,
      pct_from_52w_low: 0,
    },
  ];

  assert.deepEqual(buildMarketBreadthRows(rows, 0.5), [
    {
      date: '2026-01-02',
      active_ticker_count: 2,
      advancers: 1,
      decliners: 1,
      unchanged: 0,
      valid_sma20_count: 2,
      above_sma20_count: 1,
      valid_sma50_count: 2,
      above_sma50_count: 1,
      valid_sma200_count: 1,
      above_sma200_count: 1,
      valid_52w_count: 2,
      new_highs_52w: 1,
      new_lows_52w: 1,
      pct_above_sma20: 50,
      pct_above_sma50: 50,
      pct_above_sma200: 100,
      is_valid_signal_date: true,
    },
  ]);
});
