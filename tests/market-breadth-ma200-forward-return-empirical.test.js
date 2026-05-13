import test from 'node:test';
import assert from 'node:assert/strict';
import { buildMa200BreadthForwardReturnEmpiricalRows } from '../lib/indicators/market-breadth-ma200-forward-return-empirical.js';

const TEST_FORWARD_LOOKAHEADS = {
  '5d': 1,
  '10d': 2,
  '1m': 3,
  '3m': 4,
  '6m': 5,
  '12m': 6,
};

test('buildMa200BreadthForwardReturnEmpiricalRows only uses matured same-bucket history and prefers adj_close over close', () => {
  const breadthRows = [
    { date: '2026-01-02', pct_above_sma200: 5, is_valid_signal_date: true },
    { date: '2026-01-05', pct_above_sma200: 6, is_valid_signal_date: true },
    { date: '2026-01-06', pct_above_sma200: 15, is_valid_signal_date: true },
    { date: '2026-01-07', pct_above_sma200: 7, is_valid_signal_date: true },
    { date: '2026-01-08', pct_above_sma200: 16, is_valid_signal_date: true },
    { date: '2026-01-09', pct_above_sma200: 8, is_valid_signal_date: true },
    { date: '2026-01-12', pct_above_sma200: 17, is_valid_signal_date: true },
    { date: '2026-01-13', pct_above_sma200: 9, is_valid_signal_date: true },
  ];

  const benchmarkRows = [
    { date: '2026-01-02', close: 100, adj_close: 100 },
    { date: '2026-01-05', close: 110, adj_close: 110 },
    { date: '2026-01-06', close: 121, adj_close: 121 },
    { date: '2026-01-07', close: 100, adj_close: 108.9 },
    { date: '2026-01-08', close: 98.01, adj_close: 98.01 },
    { date: '2026-01-09', close: 107.811, adj_close: 107.811 },
    { date: '2026-01-12', close: 118.5921, adj_close: 118.5921 },
    { date: '2026-01-13', close: 106.73289, adj_close: 106.73289 },
  ];

  const empiricalRows = buildMa200BreadthForwardReturnEmpiricalRows({
    breadthRows,
    benchmarkRows,
    benchmarkSymbol: 'SPY',
    forwardLookaheads: TEST_FORWARD_LOOKAHEADS,
  });

  const firstTenTwentyRow = empiricalRows.find((row) => row.date === '2026-01-06');
  const firstZeroTenRowWithHistory = empiricalRows.find((row) => row.date === '2026-01-07');
  const secondTenTwentyRowWithHistory = empiricalRows.find((row) => row.date === '2026-01-08');

  assert.deepEqual(
    {
      benchmark_symbol: firstTenTwentyRow.benchmark_symbol,
      ma200_breadth_bucket: firstTenTwentyRow.ma200_breadth_bucket,
      ma200_empirical_sample_count_5d: firstTenTwentyRow.ma200_empirical_sample_count_5d,
      ma200_empirical_expected_return_5d: firstTenTwentyRow.ma200_empirical_expected_return_5d,
      ma200_empirical_win_ratio_5d: firstTenTwentyRow.ma200_empirical_win_ratio_5d,
    },
    {
      benchmark_symbol: 'SPY',
      ma200_breadth_bucket: 'breadth_10_20',
      ma200_empirical_sample_count_5d: 0,
      ma200_empirical_expected_return_5d: null,
      ma200_empirical_win_ratio_5d: null,
    }
  );

  assert.deepEqual(
    {
      benchmark_symbol: firstZeroTenRowWithHistory.benchmark_symbol,
      ma200_breadth_bucket: firstZeroTenRowWithHistory.ma200_breadth_bucket,
      ma200_empirical_sample_count_5d: firstZeroTenRowWithHistory.ma200_empirical_sample_count_5d,
      ma200_empirical_expected_return_5d: firstZeroTenRowWithHistory.ma200_empirical_expected_return_5d,
      ma200_empirical_win_ratio_5d: firstZeroTenRowWithHistory.ma200_empirical_win_ratio_5d,
      ma200_empirical_sample_count_10d: firstZeroTenRowWithHistory.ma200_empirical_sample_count_10d,
      ma200_empirical_expected_return_10d: firstZeroTenRowWithHistory.ma200_empirical_expected_return_10d,
      ma200_empirical_win_ratio_10d: firstZeroTenRowWithHistory.ma200_empirical_win_ratio_10d,
      ma200_empirical_sample_count_1m: firstZeroTenRowWithHistory.ma200_empirical_sample_count_1m,
      ma200_empirical_expected_return_1m: firstZeroTenRowWithHistory.ma200_empirical_expected_return_1m,
      ma200_empirical_win_ratio_1m: firstZeroTenRowWithHistory.ma200_empirical_win_ratio_1m,
    },
    {
      benchmark_symbol: 'SPY',
      ma200_breadth_bucket: 'breadth_0_10',
      ma200_empirical_sample_count_5d: 2,
      ma200_empirical_expected_return_5d: 10,
      ma200_empirical_win_ratio_5d: 100,
      ma200_empirical_sample_count_10d: 2,
      ma200_empirical_expected_return_10d: 10,
      ma200_empirical_win_ratio_10d: 50,
      ma200_empirical_sample_count_1m: 1,
      ma200_empirical_expected_return_1m: 8.9,
      ma200_empirical_win_ratio_1m: 100,
    }
  );

  assert.deepEqual(
    {
      benchmark_symbol: secondTenTwentyRowWithHistory.benchmark_symbol,
      ma200_breadth_bucket: secondTenTwentyRowWithHistory.ma200_breadth_bucket,
      ma200_empirical_sample_count_5d: secondTenTwentyRowWithHistory.ma200_empirical_sample_count_5d,
      ma200_empirical_expected_return_5d: secondTenTwentyRowWithHistory.ma200_empirical_expected_return_5d,
      ma200_empirical_win_ratio_5d: secondTenTwentyRowWithHistory.ma200_empirical_win_ratio_5d,
      ma200_empirical_sample_count_10d: secondTenTwentyRowWithHistory.ma200_empirical_sample_count_10d,
      ma200_empirical_expected_return_10d: secondTenTwentyRowWithHistory.ma200_empirical_expected_return_10d,
      ma200_empirical_win_ratio_10d: secondTenTwentyRowWithHistory.ma200_empirical_win_ratio_10d,
      ma200_empirical_sample_count_1m: secondTenTwentyRowWithHistory.ma200_empirical_sample_count_1m,
      ma200_empirical_expected_return_1m: secondTenTwentyRowWithHistory.ma200_empirical_expected_return_1m,
    },
    {
      benchmark_symbol: 'SPY',
      ma200_breadth_bucket: 'breadth_10_20',
      ma200_empirical_sample_count_5d: 1,
      ma200_empirical_expected_return_5d: -10,
      ma200_empirical_win_ratio_5d: 0,
      ma200_empirical_sample_count_10d: 1,
      ma200_empirical_expected_return_10d: -19,
      ma200_empirical_win_ratio_10d: 0,
      ma200_empirical_sample_count_1m: 0,
      ma200_empirical_expected_return_1m: null,
    }
  );
});
