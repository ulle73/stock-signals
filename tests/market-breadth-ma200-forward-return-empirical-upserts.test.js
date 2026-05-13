import test from 'node:test';
import assert from 'node:assert/strict';
import { buildMa200BreadthForwardReturnEmpiricalUpsertStatements } from '../lib/repositories/market-breadth-ma200-forward-return-empirical.js';

test('buildMa200BreadthForwardReturnEmpiricalUpsertStatements stores empirical counts, returns, and win ratios for the active breadth bucket', () => {
  const rows = [
    {
      date: '2026-01-08',
      benchmark_symbol: 'SPY',
      ma200_breadth_pct: 16,
      ma200_breadth_bucket: 'breadth_10_20',
      ma200_empirical_sample_count_5d: 1,
      ma200_empirical_sample_count_10d: 1,
      ma200_empirical_sample_count_1m: 0,
      ma200_empirical_sample_count_3m: 0,
      ma200_empirical_sample_count_6m: 0,
      ma200_empirical_sample_count_12m: 0,
      ma200_empirical_expected_return_5d: -10,
      ma200_empirical_expected_return_10d: -19,
      ma200_empirical_expected_return_1m: null,
      ma200_empirical_expected_return_3m: null,
      ma200_empirical_expected_return_6m: null,
      ma200_empirical_expected_return_12m: null,
      ma200_empirical_win_ratio_5d: 0,
      ma200_empirical_win_ratio_10d: 0,
      ma200_empirical_win_ratio_1m: null,
      ma200_empirical_win_ratio_3m: null,
      ma200_empirical_win_ratio_6m: null,
      ma200_empirical_win_ratio_12m: null,
      ma200_forward_model_version: 'empirical_spy_v2',
    },
  ];

  const statements = buildMa200BreadthForwardReturnEmpiricalUpsertStatements(rows, 10);

  assert.equal(statements.length, 1);
  assert.match(statements[0].sql, /insert into market_breadth_ma200_forward_return_empirical_daily/i);
  assert.deepEqual(statements[0].params, [
    '2026-01-08',
    'SPY',
    '16',
    'breadth_10_20',
    1,
    1,
    0,
    0,
    0,
    0,
    '-10',
    '-19',
    null,
    null,
    null,
    null,
    '0',
    '0',
    null,
    null,
    null,
    null,
    'empirical_spy_v2',
  ]);
});
