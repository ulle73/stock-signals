import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSwingSignalUpsertStatements } from '../lib/repositories/swing-signals.js';

test('buildSwingSignalUpsertStatements batches swing signal rows into one statement', () => {
  const rows = [
    {
      date: '2026-02-03',
      setup: 'bullish',
      decision: 'KÖP STARKA SEKTORER',
      previous_state: 'long_watchlist',
      target_state: 'long',
      active_sector_count: 4,
      leading_sector_count: 2,
      improving_sector_count: 1,
      weakening_sector_count: 0,
      lagging_sector_count: 0,
      mixed_sector_count: 1,
      market_signal: 'risk_on',
      market_regime_score: 4.5,
      reason_summary: 'sector_leadership_expanding',
    },
  ];

  const statements = buildSwingSignalUpsertStatements(rows, 10);

  assert.equal(statements.length, 1);
  assert.match(statements[0].sql, /insert into swing_signal_daily/i);
  assert.deepEqual(statements[0].params, [
    '2026-02-03',
    'bullish',
    'KÖP STARKA SEKTORER',
    'long_watchlist',
    'long',
    4,
    2,
    1,
    0,
    0,
    1,
    'risk_on',
    '4.5',
    'sector_leadership_expanding',
  ]);
});
