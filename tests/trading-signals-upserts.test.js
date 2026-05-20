import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTradingSignalUpsertStatements } from '../lib/repositories/trading-signals.js';

test('buildTradingSignalUpsertStatements includes historical edge fields', () => {
  const rows = [
    {
      date: '2026-01-03',
      setup: 'bullish',
      decision: 'BUY_SPY_TEST',
      previous_state: 'cash',
      target_state: 'long',
      trigger_count: 9,
      market_regime_score: 4.5,
      reason_summary: 'historical_edge_bullish',
      historical_edge_fingerprint: 'bull_strong_calm',
      historical_edge_direction: 'bullish',
      historical_edge_score: 0.55,
      markov_state: 'bull',
      markov_bull_probability: 0.65,
      markov_sideways_probability: 0.15,
      markov_bear_probability: 0.2,
      markov_edge: 0.45,
      markov_stickiness: 0.65,
      markov_sample_size: 50,
      forward_5d_avg_return: 0.012,
      forward_5d_win_rate: 0.61,
      forward_20d_avg_return: 0.035,
      forward_20d_win_rate: 0.64,
      forward_sample_size: 40,
      state_duration_days: 4,
      state_duration_percentile: 0.3,
      state_exhaustion_risk: false,
    },
  ];

  const statements = buildTradingSignalUpsertStatements(rows, 10);

  assert.equal(statements.length, 1);
  assert.match(statements[0].sql, /historical_edge_score/i);
  assert.match(statements[0].sql, /markov_edge/i);
  assert.match(statements[0].sql, /forward_5d_win_rate/i);
  assert.equal(statements[0].params.length, 26);
  assert.equal(statements[0].params[8], 'bull_strong_calm');
  assert.equal(statements[0].params[10], '0.55');
  assert.equal(statements[0].params[15], '0.45');
  assert.equal(statements[0].params[23], 4);
});
