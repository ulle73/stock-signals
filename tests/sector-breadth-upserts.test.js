import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSectorBreadthUpsertStatements } from '../lib/repositories/sector-breadth.js';

test('buildSectorBreadthUpsertStatements batches sector breadth rows into one statement', () => {
  const rows = [
    {
      date: '2026-01-02',
      sector: 'Energy',
      active_ticker_count: 1,
      advancers: 0,
      decliners: 0,
      unchanged: 1,
      valid_sma20_count: 1,
      above_sma20_count: 1,
      pct_above_sma20: 100,
      valid_sma50_count: 1,
      above_sma50_count: 0,
      pct_above_sma50: 0,
      valid_sma200_count: 0,
      above_sma200_count: 0,
      pct_above_sma200: null,
      valid_52w_count: 1,
      new_highs_52w: 0,
      new_lows_52w: 0,
      is_valid_signal_date: false,
    },
    {
      date: '2026-01-02',
      sector: 'Information Technology',
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
      valid_sma200_count: 2,
      above_sma200_count: 2,
      pct_above_sma200: 100,
      valid_52w_count: 2,
      new_highs_52w: 1,
      new_lows_52w: 1,
      is_valid_signal_date: true,
    },
  ];

  const statements = buildSectorBreadthUpsertStatements(rows, 2);

  assert.equal(statements.length, 1);
  assert.match(statements[0].sql, /insert into sector_breadth_daily/i);
  assert.deepEqual(statements[0].params, [
    '2026-01-02', 'Energy', 1, 0, 0, 1, 1, 1, '100', 1, 0, '0', 0, 0, null, 1, 0, 0, false,
    '2026-01-02', 'Information Technology', 2, 1, 1, 0, 2, 1, '50', 2, 1, '50', 2, 2, '100', 2, 1, 1, true,
  ]);
});
