import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTradingSignalUpsertStatements } from '../lib/repositories/trading-signals.js';

test('buildTradingSignalUpsertStatements batches trading signal rows into one statement', () => {
  const rows = [
    {
      date: '2026-01-03',
      setup: 'bullish',
      decision: 'KÖP SPY',
      previous_state: 'cash',
      target_state: 'long',
      trigger_count: 8,
      market_regime_score: 4.5,
      reason_summary: 'strong_bull_confirmation',
    },
    {
      date: '2026-01-04',
      setup: 'bullish',
      decision: 'BEHÅLL',
      previous_state: 'long',
      target_state: 'long',
      trigger_count: 8,
      market_regime_score: 5,
      reason_summary: 'strong_bull_confirmation',
    },
  ];

  const statements = buildTradingSignalUpsertStatements(rows, 10);

  assert.equal(statements.length, 1);
  assert.match(statements[0].sql, /insert into trading_signal_daily/i);
  assert.deepEqual(statements[0].params, [
    '2026-01-03',
    'bullish',
    'KÖP SPY',
    'cash',
    'long',
    8,
    '4.5',
    'strong_bull_confirmation',
    '2026-01-04',
    'bullish',
    'BEHÅLL',
    'long',
    'long',
    8,
    '5',
    'strong_bull_confirmation',
  ]);
});
