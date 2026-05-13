import test from 'node:test';
import assert from 'node:assert/strict';
import {
  bucketMa200Breadth,
  getMa200BreadthForwardStats,
  buildMa200BreadthForwardReturnSignalRows,
  classifyMa200BreadthSignal,
} from '../lib/indicators/market-breadth-ma200-forward-return-model.js';

test('bucketMa200Breadth assigns boundary values to the correct bucket', () => {
  assert.equal(bucketMa200Breadth(0), 'breadth_0_10');
  assert.equal(bucketMa200Breadth(9.99), 'breadth_0_10');
  assert.equal(bucketMa200Breadth(10), 'breadth_10_20');
  assert.equal(bucketMa200Breadth(19.99), 'breadth_10_20');
  assert.equal(bucketMa200Breadth(20), 'breadth_20_30');
  assert.equal(bucketMa200Breadth(89.99), 'breadth_80_90');
  assert.equal(bucketMa200Breadth(90), 'breadth_90_100');
  assert.equal(bucketMa200Breadth(100), 'breadth_90_100');
});

test('getMa200BreadthForwardStats returns fixed return and win-ratio priors from the reference table', () => {
  assert.deepEqual(getMa200BreadthForwardStats('breadth_0_10'), {
    expected_return_5d: 0.59,
    expected_return_10d: 0.88,
    expected_return_1m: 2.27,
    expected_return_3m: 4.27,
    expected_return_6m: 10.9,
    expected_return_12m: 23.65,
    win_ratio_5d: 52.15,
    win_ratio_10d: 53.59,
    win_ratio_1m: 59.81,
    win_ratio_3m: 69.86,
    win_ratio_6m: 68.42,
    win_ratio_12m: 77.99,
  });

  assert.deepEqual(getMa200BreadthForwardStats('breadth_20_30'), {
    expected_return_5d: -1,
    expected_return_10d: -2,
    expected_return_1m: -3.36,
    expected_return_3m: -8.13,
    expected_return_6m: -6.99,
    expected_return_12m: 1.21,
    win_ratio_5d: 31.93,
    win_ratio_10d: 28.15,
    win_ratio_1m: 26.47,
    win_ratio_3m: 18.91,
    win_ratio_6m: 24.37,
    win_ratio_12m: 39.08,
  });
});

test('classifyMa200BreadthSignal treats 0-10 breadth as a capitulation buy without requiring positive slope', () => {
  assert.deepEqual(
    classifyMa200BreadthSignal({
      ma200_breadth_bucket: 'breadth_0_10',
      ma200_breadth_10d_change: -3.5,
      ma200_breadth_20d_change: -7.1,
    }),
    {
      ma200_breadth_signal: 'CAPITULATION_BUY',
      ma200_breadth_action: 'BUY',
      ma200_breadth_confidence: 'high',
      ma200_breadth_warning: null,
    }
  );
});

test('classifyMa200BreadthSignal upgrades 10-20 breadth to buy when 10d and 20d slope both improve', () => {
  assert.deepEqual(
    classifyMa200BreadthSignal({
      ma200_breadth_bucket: 'breadth_10_20',
      ma200_breadth_10d_change: 4.2,
      ma200_breadth_20d_change: 8.5,
    }),
    {
      ma200_breadth_signal: 'EARLY_RECOVERY_BUY',
      ma200_breadth_action: 'BUY',
      ma200_breadth_confidence: 'medium',
      ma200_breadth_warning: null,
    }
  );
});

test('classifyMa200BreadthSignal keeps 20-40 breadth in risk reduction and adds stretch warning at 90-100 rollover', () => {
  assert.deepEqual(
    classifyMa200BreadthSignal({
      ma200_breadth_bucket: 'breadth_20_30',
      ma200_breadth_20d_change: -3.1,
    }),
    {
      ma200_breadth_signal: 'REDUCE_RISK',
      ma200_breadth_action: 'REDUCE_RISK',
      ma200_breadth_confidence: 'high',
      ma200_breadth_warning: null,
    }
  );

  assert.deepEqual(
    classifyMa200BreadthSignal({
      ma200_breadth_bucket: 'breadth_90_100',
      ma200_breadth_20d_change: -8,
    }),
    {
      ma200_breadth_signal: 'BROAD_STRENGTH_RISK_ON',
      ma200_breadth_action: 'RISK_ON',
      ma200_breadth_confidence: 'medium',
      ma200_breadth_warning: 'breadth_stretch_rolling_over',
    }
  );
});

test('buildMa200BreadthForwardReturnSignalRows attaches priors, slope fields, and deterministic outputs from market breadth history', () => {
  const breadthRows = [
    { date: '2026-01-02', pct_above_sma200: 55, is_valid_signal_date: true },
    { date: '2026-01-05', pct_above_sma200: 48, is_valid_signal_date: true },
    { date: '2026-01-06', pct_above_sma200: 35, is_valid_signal_date: true },
    { date: '2026-01-07', pct_above_sma200: 22, is_valid_signal_date: true },
    { date: '2026-01-08', pct_above_sma200: 12, is_valid_signal_date: true },
    { date: '2026-01-09', pct_above_sma200: 7.5, is_valid_signal_date: true },
    { date: '2026-01-12', pct_above_sma200: 18, is_valid_signal_date: true },
    { date: '2026-01-13', pct_above_sma200: 27, is_valid_signal_date: true },
    { date: '2026-01-14', pct_above_sma200: 45, is_valid_signal_date: true },
    { date: '2026-01-15', pct_above_sma200: 65, is_valid_signal_date: true },
    { date: '2026-01-16', pct_above_sma200: 85, is_valid_signal_date: true },
    { date: '2026-01-20', pct_above_sma200: 92, is_valid_signal_date: true },
    { date: '2026-01-21', pct_above_sma200: 91, is_valid_signal_date: true },
    { date: '2026-01-22', pct_above_sma200: 89, is_valid_signal_date: true },
    { date: '2026-01-23', pct_above_sma200: 88, is_valid_signal_date: true },
    { date: '2026-01-26', pct_above_sma200: 87, is_valid_signal_date: true },
    { date: '2026-01-27', pct_above_sma200: 86, is_valid_signal_date: true },
    { date: '2026-01-28', pct_above_sma200: 85, is_valid_signal_date: true },
    { date: '2026-01-29', pct_above_sma200: 84, is_valid_signal_date: true },
    { date: '2026-01-30', pct_above_sma200: 83, is_valid_signal_date: true },
    { date: '2026-02-02', pct_above_sma200: 82, is_valid_signal_date: true },
    { date: '2026-02-03', pct_above_sma200: 81, is_valid_signal_date: true },
    { date: '2026-02-04', pct_above_sma200: 80, is_valid_signal_date: true },
    { date: '2026-02-05', pct_above_sma200: 79, is_valid_signal_date: true },
    { date: '2026-02-06', pct_above_sma200: 78, is_valid_signal_date: true },
    { date: '2026-02-09', pct_above_sma200: 77, is_valid_signal_date: true },
  ];

  const signalRows = buildMa200BreadthForwardReturnSignalRows({ breadthRows });
  const capitulationRow = signalRows.find((row) => row.date === '2026-01-09');
  const earlyRecoveryRow = signalRows.find((row) => row.date === '2026-01-13');
  const broadStrengthRow = signalRows.find((row) => row.date === '2026-02-09');

  assert.deepEqual(
    {
      ma200_breadth_pct: capitulationRow.ma200_breadth_pct,
      ma200_breadth_bucket: capitulationRow.ma200_breadth_bucket,
      ma200_breadth_signal: capitulationRow.ma200_breadth_signal,
      ma200_breadth_action: capitulationRow.ma200_breadth_action,
      ma200_expected_return_6m: capitulationRow.ma200_expected_return_6m,
      ma200_win_ratio_12m: capitulationRow.ma200_win_ratio_12m,
    },
    {
      ma200_breadth_pct: 7.5,
      ma200_breadth_bucket: 'breadth_0_10',
      ma200_breadth_signal: 'CAPITULATION_BUY',
      ma200_breadth_action: 'BUY',
      ma200_expected_return_6m: 10.9,
      ma200_win_ratio_12m: 77.99,
    }
  );

  assert.deepEqual(
    {
      ma200_breadth_pct: earlyRecoveryRow.ma200_breadth_pct,
      ma200_breadth_bucket: earlyRecoveryRow.ma200_breadth_bucket,
      ma200_breadth_5d_change: earlyRecoveryRow.ma200_breadth_5d_change,
      ma200_breadth_signal: earlyRecoveryRow.ma200_breadth_signal,
      ma200_breadth_action: earlyRecoveryRow.ma200_breadth_action,
    },
    {
      ma200_breadth_pct: 27,
      ma200_breadth_bucket: 'breadth_20_30',
      ma200_breadth_5d_change: -8,
      ma200_breadth_signal: 'REDUCE_RISK',
      ma200_breadth_action: 'REDUCE_RISK',
    }
  );

  assert.deepEqual(
    {
      ma200_breadth_pct: broadStrengthRow.ma200_breadth_pct,
      ma200_breadth_bucket: broadStrengthRow.ma200_breadth_bucket,
      ma200_breadth_20d_change: broadStrengthRow.ma200_breadth_20d_change,
      ma200_breadth_signal: broadStrengthRow.ma200_breadth_signal,
      ma200_breadth_action: broadStrengthRow.ma200_breadth_action,
      ma200_breadth_warning: broadStrengthRow.ma200_breadth_warning,
    },
    {
      ma200_breadth_pct: 77,
      ma200_breadth_bucket: 'breadth_70_80',
      ma200_breadth_20d_change: 69.5,
      ma200_breadth_signal: 'RISK_ON',
      ma200_breadth_action: 'RISK_ON',
      ma200_breadth_warning: null,
    }
  );
});
