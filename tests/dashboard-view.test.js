import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildMarketSeriesCards,
  buildPositionStatusViewModel,
  normalizeTickerInput,
  resolveSelectedTicker,
} from '../lib/utils/dashboard-view.js';

test('normalizeTickerInput uppercases, trims, and falls back to AAPL', () => {
  assert.equal(normalizeTickerInput(' msft '), 'MSFT');
  assert.equal(normalizeTickerInput(''), 'AAPL');
  assert.equal(normalizeTickerInput(undefined), 'AAPL');
});

test('resolveSelectedTicker keeps valid values and falls back to the first active constituent', () => {
  const constituents = [
    { ticker: 'AAPL', company_name: 'Apple' },
    { ticker: 'MSFT', company_name: 'Microsoft' },
  ];

  assert.equal(resolveSelectedTicker(' msft ', constituents), 'MSFT');
  assert.equal(resolveSelectedTicker('invalid', constituents), 'AAPL');
  assert.equal(resolveSelectedTicker('', constituents), 'AAPL');
  assert.equal(resolveSelectedTicker(undefined, []), 'AAPL');
});

test('buildMarketSeriesCards returns fixed cards and fills missing series with null', () => {
  const cards = buildMarketSeriesCards([
    { series_id: 'VIXCLS', date: '2026-05-04', value: '24.11' },
    { series_id: 'SP500', date: '2026-05-05', value: '5123.45' },
  ]);

  assert.deepEqual(cards, [
    {
      seriesId: 'SP500',
      label: 'S&P 500',
      description: 'Index close',
      value: '5123.45',
      date: '2026-05-05',
    },
    {
      seriesId: 'VIXCLS',
      label: 'VIX',
      description: 'Volatility index',
      value: '24.11',
      date: '2026-05-04',
    },
    {
      seriesId: 'BAMLH0A0HYM2',
      label: 'HY Spread',
      description: 'Credit stress',
      value: null,
      date: null,
    },
  ]);
});

test('buildPositionStatusViewModel shapes current position, flags, and backtest comparison', () => {
  const viewModel = buildPositionStatusViewModel({
    current: {
      date: '2026-05-07',
      signal: 'risk_caution',
      decision: 'DELVIS INVESTERAD (75%)',
      target_equity_weight_pct: '75',
      raw_signal: 'risk_caution',
      raw_decision: 'DELVIS INVESTERAD (50%)',
      raw_target_equity_weight_pct: '50',
      market_signal: 'risk_off',
      market_regime_score: '-2',
      caution_count: 3,
      hard_risk_off_count: 3,
      reason_summary: 'persistent_hard_risk_cluster',
      persistence_direction: 'reduction',
      persistence_streak_days: 2,
      persistence_required_days: 3,
      sp500_trend_regime: 'below_200dma',
      vix_regime: 'calm',
      credit_regime: 'stress',
      yield_curve_regime: 'inverted',
      fed_policy_trend: 'stable',
      labor_trend: 'deteriorating',
      inflation_trend: 'heating_up',
      sentiment_trend: 'stable',
    },
    previous: {
      date: '2026-05-06',
      target_equity_weight_pct: '100',
    },
    latestChange: {
      date: '2026-05-05',
      previous_equity_weight_pct: '100',
      new_equity_weight_pct: '75',
      decision: 'DELVIS INVESTERAD (75%)',
    },
    backtests: [
      {
        code: 'position_macro_signal_v1',
        name: 'Position Macro Signal v1',
        cagr: '13.58',
        max_drawdown: '-12.34',
        time_in_market_pct: '99.90',
      },
      {
        code: 'buy_and_hold_spy',
        name: 'Buy & Hold SPY',
        cagr: '17.62',
        max_drawdown: '-18.76',
        time_in_market_pct: '100.00',
      },
    ],
  });

  assert.equal(viewModel.current.appliedEquityPct, 75);
  assert.equal(viewModel.current.rawEquityPct, 50);
  assert.equal(viewModel.current.isPending, true);
  assert.equal(viewModel.current.dayOverDayChangePct, -25);
  assert.equal(viewModel.current.tone, 'caution');

  assert.deepEqual(
    viewModel.flags.hard.filter((flag) => flag.active).map((flag) => flag.key),
    ['sp500_trend', 'credit_stress', 'breadth_risk_off']
  );

  assert.deepEqual(
    viewModel.flags.caution.filter((flag) => flag.active).map((flag) => flag.key),
    ['yield_curve', 'labor', 'inflation']
  );

  assert.equal(viewModel.persistence.directionLabel, 'Nedväxling väntar');
  assert.equal(viewModel.persistence.progressLabel, '2/3 dagar bekräftade');

  assert.equal(viewModel.latestChange.direction, 'down');
  assert.equal(viewModel.latestChange.previousEquityPct, 100);
  assert.equal(viewModel.latestChange.newEquityPct, 75);

  assert.equal(viewModel.backtest.position.code, 'position_macro_signal_v1');
  assert.equal(viewModel.backtest.benchmark.code, 'buy_and_hold_spy');
  assert.equal(viewModel.backtest.deltaCagrPct, -4.04);
  assert.equal(viewModel.backtest.deltaDrawdownPct, 6.42);
});

test('buildPositionStatusViewModel handles missing position data', () => {
  const viewModel = buildPositionStatusViewModel({
    current: null,
    previous: null,
    latestChange: null,
    backtests: [],
  });

  assert.equal(viewModel.current, null);
  assert.equal(viewModel.latestChange, null);
  assert.equal(viewModel.backtest.position, null);
  assert.equal(viewModel.backtest.benchmark, null);
  assert.equal(viewModel.backtest.deltaCagrPct, null);
});
