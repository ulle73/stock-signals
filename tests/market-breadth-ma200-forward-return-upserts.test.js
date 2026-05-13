import test from 'node:test';
import assert from 'node:assert/strict';
import { buildMa200BreadthForwardReturnSignalUpsertStatements } from '../lib/repositories/market-breadth-ma200-forward-return-signals.js';

test('buildMa200BreadthForwardReturnSignalUpsertStatements stores bucket, slope, priors, and signal fields', () => {
  const rows = [
    {
      date: '2026-02-09',
      ma200_breadth_pct: 77,
      ma200_breadth_bucket: 'breadth_70_80',
      ma200_breadth_5d_change: -5,
      ma200_breadth_10d_change: -10,
      ma200_breadth_20d_change: -15,
      ma200_breadth_50d_change: null,
      ma200_breadth_signal: 'RISK_ON',
      ma200_breadth_action: 'RISK_ON',
      ma200_breadth_confidence: 'medium_high',
      ma200_breadth_warning: null,
      ma200_expected_return_5d: 0.24,
      ma200_expected_return_10d: 0.87,
      ma200_expected_return_1m: 2.27,
      ma200_expected_return_3m: 4.02,
      ma200_expected_return_6m: 4.87,
      ma200_expected_return_12m: 7.37,
      ma200_win_ratio_5d: 22.63,
      ma200_win_ratio_10d: 25.51,
      ma200_win_ratio_1m: 27.64,
      ma200_win_ratio_3m: 28.48,
      ma200_win_ratio_6m: 24.77,
      ma200_win_ratio_12m: 22.17,
      ma200_forward_model_version: 'reference_static_v1',
    },
  ];

  const statements = buildMa200BreadthForwardReturnSignalUpsertStatements(rows, 10);

  assert.equal(statements.length, 1);
  assert.match(statements[0].sql, /insert into market_breadth_ma200_forward_return_signal_daily/i);
  assert.deepEqual(statements[0].params, [
    '2026-02-09',
    '77',
    'breadth_70_80',
    '-5',
    '-10',
    '-15',
    null,
    'RISK_ON',
    'RISK_ON',
    'medium_high',
    null,
    '0.24',
    '0.87',
    '2.27',
    '4.02',
    '4.87',
    '7.37',
    '22.63',
    '25.51',
    '27.64',
    '28.48',
    '24.77',
    '22.17',
    'reference_static_v1',
  ]);
});
