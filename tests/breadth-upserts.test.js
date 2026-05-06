import test from 'node:test';
import assert from 'node:assert/strict';
import { buildMarketBreadthUpsertStatements } from '../lib/repositories/breadth.js';

test('buildMarketBreadthUpsertStatements batches breadth rows into one statement', () => {
  const rows = [
    {
      date: '2026-01-02',
      active_ticker_count: 2,
      advancers: 1,
      decliners: 1,
      unchanged: 0,
      valid_sma20_count: 2,
      above_sma20_count: 1,
      pct_above_sma20: 50,
      valid_sma50_count: 2,
      above_sma50_count: 1,
      pct_above_sma50: 50,
      valid_sma200_count: 1,
      above_sma200_count: 1,
      pct_above_sma200: 100,
      valid_52w_count: 2,
      new_highs_52w: 1,
      new_lows_52w: 1,
      is_valid_signal_date: true,
    },
    {
      date: '2026-01-03',
      active_ticker_count: 2,
      advancers: 0,
      decliners: 2,
      unchanged: 0,
      valid_sma20_count: 2,
      above_sma20_count: 0,
      pct_above_sma20: 0,
      valid_sma50_count: 2,
      above_sma50_count: 0,
      pct_above_sma50: 0,
      valid_sma200_count: 1,
      above_sma200_count: 0,
      pct_above_sma200: 0,
      valid_52w_count: 2,
      new_highs_52w: 0,
      new_lows_52w: 1,
      is_valid_signal_date: false,
    },
  ];

  const statements = buildMarketBreadthUpsertStatements(rows, 2);

  assert.equal(statements.length, 1);
  assert.match(statements[0].sql, /insert into market_breadth_daily/i);
  assert.deepEqual(statements[0].params, [
    '2026-01-02', 2, 1, 1, 0, 2, 1, '50', 2, 1, '50', 1, 1, '100', 2, 1, 1, true,
    '2026-01-03', 2, 0, 2, 0, 2, 0, '0', 2, 0, '0', 1, 0, '0', 2, 0, 1, false,
  ]);
});
