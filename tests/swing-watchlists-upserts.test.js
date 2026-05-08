import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSwingWatchlistUpsertStatements } from '../lib/repositories/swing-watchlists.js';

test('buildSwingWatchlistUpsertStatements batches ranked watchlist rows into one statement', () => {
  const rows = [
    {
      date: '2026-03-10',
      bias: 'long',
      rank_in_bias: 1,
      ticker: 'NVDA',
      sector: 'Information Technology',
      sector_signal: 'leading',
      swing_setup: 'bullish',
      swing_decision: 'KÖP STARKA SEKTORER',
      playbook: 'deploy_long',
      is_actionable: true,
      watchlist_score: 9,
      indicator_price: 110,
      daily_return_pct: 2.1,
      relative_volume20: 1.3,
      pct_from_52w_high: -4,
      pct_from_52w_low: 35,
      distance_from_sma50_pct: 10,
      distance_from_sma200_pct: 10,
      reason_summary: 'leading_sector_momentum',
    },
  ];

  const statements = buildSwingWatchlistUpsertStatements(rows, 10);

  assert.equal(statements.length, 1);
  assert.match(statements[0].sql, /insert into swing_watchlist_daily/i);
  assert.deepEqual(statements[0].params, [
    '2026-03-10',
    'long',
    1,
    'NVDA',
    'Information Technology',
    'leading',
    'bullish',
    'KÖP STARKA SEKTORER',
    'deploy_long',
    true,
    '9',
    '110',
    '2.1',
    '1.3',
    '-4',
    '35',
    '10',
    '10',
    'leading_sector_momentum',
  ]);
});
