import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPositionSignalUpsertStatements } from '../lib/repositories/position-signals.js';

test('buildPositionSignalUpsertStatements batches position signal rows into one statement', () => {
  const rows = [
    {
      date: '2026-04-02',
      signal: 'risk_caution',
      decision: 'DELVIS INVESTERAD (25%)',
      target_equity_weight_pct: 25,
      target_cash_weight_pct: 75,
      raw_signal: 'risk_caution',
      raw_decision: 'DELVIS INVESTERAD (25%)',
      raw_target_equity_weight_pct: 25,
      raw_target_cash_weight_pct: 75,
      market_signal: 'neutral',
      market_regime_score: 0,
      caution_count: 5,
      hard_risk_off_count: 0,
      reason_summary: 'multiple_caution_flags',
      persistence_direction: 'reduction',
      persistence_streak_days: 3,
      persistence_required_days: 3,
    },
  ];

  const statements = buildPositionSignalUpsertStatements(rows, 10);

  assert.equal(statements.length, 1);
  assert.match(statements[0].sql, /insert into position_signal_daily/i);
  assert.deepEqual(statements[0].params, [
    '2026-04-02',
    'risk_caution',
    'DELVIS INVESTERAD (25%)',
    '25',
    '75',
    'risk_caution',
    'DELVIS INVESTERAD (25%)',
    '25',
    '75',
    'neutral',
    '0',
    5,
    0,
    'multiple_caution_flags',
    'reduction',
    3,
    3,
  ]);
});
