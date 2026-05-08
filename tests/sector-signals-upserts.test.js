import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSectorSignalUpsertStatements } from '../lib/repositories/sector-signals.js';

test('buildSectorSignalUpsertStatements batches sector signal rows into one statement', () => {
  const rows = [
    {
      date: '2026-01-15',
      sector: 'Information Technology',
      active_ticker_count: 20,
      pct_above_sma50: 70,
      pct_above_sma50_14d_change: 15,
      pct_above_sma200: 64,
      pct_above_sma200_14d_change: 12,
      ad_net: 27,
      ad_net_14d_change: 22,
      new_highs_52w: 8,
      new_lows_52w: 1,
      sector_regime_score: 5,
      signal: 'leading',
      reason_summary: 'strong_sector_breadth',
    },
  ];

  const statements = buildSectorSignalUpsertStatements(rows, 10);

  assert.equal(statements.length, 1);
  assert.match(statements[0].sql, /insert into sector_signal_daily/i);
  assert.deepEqual(statements[0].params, [
    '2026-01-15',
    'Information Technology',
    20,
    '70',
    '15',
    '64',
    '12',
    27,
    22,
    8,
    1,
    '5',
    'leading',
    'strong_sector_breadth',
  ]);
});
