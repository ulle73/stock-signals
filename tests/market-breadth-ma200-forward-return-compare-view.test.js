import test from 'node:test';
import assert from 'node:assert/strict';
import { buildMarketBreadthForwardReturnComparisonViewModel } from '../lib/utils/market-breadth-ma200-forward-return-compare-view.js';

test('buildMarketBreadthForwardReturnComparisonViewModel builds a current-bucket comparison across all horizons', () => {
  const viewModel = buildMarketBreadthForwardReturnComparisonViewModel({
    staticRow: {
      date: '2026-05-12',
      ma200_breadth_pct: '55.577689',
      ma200_breadth_bucket: 'breadth_50_60',
      ma200_breadth_signal: 'NEUTRAL',
      ma200_breadth_action: 'HOLD',
      ma200_breadth_confidence: 'medium',
      ma200_breadth_warning: null,
      ma200_expected_return_5d: '-0.01',
      ma200_expected_return_10d: '-0.07',
      ma200_expected_return_1m: '0.31',
      ma200_expected_return_3m: '0.96',
      ma200_expected_return_6m: '2.38',
      ma200_expected_return_12m: '6.72',
      ma200_win_ratio_5d: '16.6',
      ma200_win_ratio_10d: '16.6',
      ma200_win_ratio_1m: '19.24',
      ma200_win_ratio_3m: '23.32',
      ma200_win_ratio_6m: '23.19',
      ma200_win_ratio_12m: '21.21',
      ma200_forward_model_version: 'reference_static_v1',
    },
    empiricalRow: {
      benchmark_symbol: 'SPY',
      date: '2026-05-12',
      ma200_breadth_pct: '55.577689',
      ma200_breadth_bucket: 'breadth_50_60',
      ma200_empirical_sample_count_5d: 144,
      ma200_empirical_sample_count_10d: 139,
      ma200_empirical_sample_count_1m: 130,
      ma200_empirical_sample_count_3m: 118,
      ma200_empirical_sample_count_6m: 107,
      ma200_empirical_sample_count_12m: 59,
      ma200_empirical_expected_return_5d: '0.471329',
      ma200_empirical_expected_return_10d: '0.659703',
      ma200_empirical_expected_return_1m: '2.028195',
      ma200_empirical_expected_return_3m: '5.154125',
      ma200_empirical_expected_return_6m: '12.594398',
      ma200_empirical_expected_return_12m: '25.701949',
      ma200_empirical_win_ratio_5d: '65.972222',
      ma200_empirical_win_ratio_10d: '71.223022',
      ma200_empirical_win_ratio_1m: '76.923077',
      ma200_empirical_win_ratio_3m: '89.830508',
      ma200_empirical_win_ratio_6m: '100',
      ma200_empirical_win_ratio_12m: '100',
      ma200_forward_model_version: 'empirical_spy_v2',
    },
  });

  assert.deepEqual(
    {
      date: viewModel.date,
      breadthPct: viewModel.breadthPct,
      bucketKey: viewModel.bucketKey,
      bucketLabel: viewModel.bucketLabel,
      benchmarkSymbol: viewModel.benchmarkSymbol,
      staticSignal: viewModel.staticSignal,
      staticAction: viewModel.staticAction,
      staticConfidence: viewModel.staticConfidence,
      overallTone: viewModel.summary.overallTone,
      strongerHorizons: viewModel.summary.strongerHorizons,
      weakerHorizons: viewModel.summary.weakerHorizons,
      agreementCount: viewModel.summary.agreementCount,
      minimumSampleCount: viewModel.summary.minimumSampleCount,
      largestExpectedReturnDelta: viewModel.summary.largestExpectedReturnDelta,
    },
    {
      date: '2026-05-12',
      breadthPct: 55.58,
      bucketKey: 'breadth_50_60',
      bucketLabel: '50-60%',
      benchmarkSymbol: 'SPY',
      staticSignal: 'NEUTRAL',
      staticAction: 'HOLD',
      staticConfidence: 'medium',
      overallTone: 'positive',
      strongerHorizons: 6,
      weakerHorizons: 0,
      agreementCount: 4,
      minimumSampleCount: 59,
      largestExpectedReturnDelta: {
        horizonKey: '12m',
        horizonLabel: '12m',
        delta: 18.98,
        sampleCount: 59,
      },
    }
  );

  assert.deepEqual(
    viewModel.horizons.find((item) => item.key === '5d'),
    {
      key: '5d',
      label: '5d',
      sampleCount: 144,
      staticExpectedReturn: -0.01,
      empiricalExpectedReturn: 0.47,
      expectedReturnDelta: 0.48,
      expectedReturnTone: 'positive',
      staticWinRatio: 16.6,
      empiricalWinRatio: 65.97,
      winRatioDelta: 49.37,
      winRatioTone: 'positive',
    }
  );

  assert.deepEqual(
    viewModel.horizons.find((item) => item.key === '12m'),
    {
      key: '12m',
      label: '12m',
      sampleCount: 59,
      staticExpectedReturn: 6.72,
      empiricalExpectedReturn: 25.7,
      expectedReturnDelta: 18.98,
      expectedReturnTone: 'positive',
      staticWinRatio: 21.21,
      empiricalWinRatio: 100,
      winRatioDelta: 78.79,
      winRatioTone: 'positive',
    }
  );
});

test('buildMarketBreadthForwardReturnComparisonViewModel returns null when either model row is missing', () => {
  assert.equal(
    buildMarketBreadthForwardReturnComparisonViewModel({
      staticRow: null,
      empiricalRow: {},
    }),
    null
  );

  assert.equal(
    buildMarketBreadthForwardReturnComparisonViewModel({
      staticRow: {},
      empiricalRow: null,
    }),
    null
  );
});
