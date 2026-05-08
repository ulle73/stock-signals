import test from 'node:test';
import assert from 'node:assert/strict';
import { buildBacktestRunArtifacts } from '../lib/utils/backtest-engine.js';

test('buildBacktestRunArtifacts simulates buy-and-hold and signal-driven long/cash transitions', () => {
  const benchmarkBars = [
    { ticker: 'SPY', date: '2026-01-02', open: 100, close: 102, adj_close: 102 },
    { ticker: 'SPY', date: '2026-01-03', open: 103, close: 105, adj_close: 105 },
    { ticker: 'SPY', date: '2026-01-04', open: 101, close: 100, adj_close: 100 },
  ];
  const signalRows = [
    {
      date: '2026-01-02',
      pct_above_50: 55,
      market_regime_score: 4,
      signal: 'risk_on',
      divergence_status: 'none',
      short_divergence_status: 'none',
    },
    {
      date: '2026-01-03',
      pct_above_50: 45,
      market_regime_score: -3.5,
      signal: 'risk_off',
      divergence_status: 'bearish_warning',
      short_divergence_status: 'short_negative',
    },
  ];

  const buyAndHold = buildBacktestRunArtifacts({
    strategy: {
      code: 'buy_and_hold_spy',
      benchmark_symbol: 'SPY',
      transaction_cost_bps: 5,
      rule_source: 'always_long',
      params_json: { initial_state: 'long' },
    },
    benchmarkBars,
    signalRows,
  });

  assert.equal(buyAndHold.positions.length, 3);
  assert.equal(buyAndHold.positions[0].trade_action, 'enter');
  assert.equal(buyAndHold.positions[1].trade_action, 'hold');
  assert.equal(buyAndHold.positions[2].trade_action, 'hold');
  assert.equal(buyAndHold.equityRows[0].strategy_return_pct, 1.95);
  assert.equal(buyAndHold.equityRows[2].is_in_market, true);
  assert.equal(buyAndHold.summary.time_in_market_pct, 100);

  const breadthThreshold = buildBacktestRunArtifacts({
    strategy: {
      code: 'pct_above_50_threshold_v1',
      benchmark_symbol: 'SPY',
      transaction_cost_bps: 5,
      rule_source: 'pct_above_50_threshold',
      params_json: { initial_state: 'long', threshold: 50 },
    },
    benchmarkBars,
    signalRows,
  });

  assert.equal(breadthThreshold.positions[0].applied_state, 'long');
  assert.equal(breadthThreshold.positions[1].applied_state, 'long');
  assert.equal(breadthThreshold.positions[2].applied_state, 'cash');
  assert.equal(breadthThreshold.positions[2].trade_action, 'exit');
  assert.equal(breadthThreshold.summary.turnover, 2);
  assert.equal(breadthThreshold.summary.time_in_market_pct, 66.666667);

  const marketRegime = buildBacktestRunArtifacts({
    strategy: {
      code: 'market_regime_signal_v1',
      benchmark_symbol: 'SPY',
      transaction_cost_bps: 5,
      rule_source: 'market_regime_signal',
      params_json: { initial_state: 'cash' },
    },
    benchmarkBars,
    signalRows,
  });

  assert.equal(marketRegime.positions[0].trade_action, 'stay_out');
  assert.equal(marketRegime.positions[1].trade_action, 'enter');
  assert.equal(marketRegime.positions[2].trade_action, 'exit');
  assert.match(marketRegime.positions[2].reason_code, /signal:risk_off/);

  const positionMacro = buildBacktestRunArtifacts({
    strategy: {
      code: 'position_macro_signal_v1',
      benchmark_symbol: 'SPY',
      transaction_cost_bps: 5,
      rule_source: 'position_macro_signal',
      params_json: { initial_state: 'cash' },
    },
    benchmarkBars: [
      { ticker: 'SPY', date: '2026-01-02', open: 100, close: 100, adj_close: 100 },
      { ticker: 'SPY', date: '2026-01-03', open: 100, close: 110, adj_close: 110 },
      { ticker: 'SPY', date: '2026-01-04', open: 110, close: 121, adj_close: 121 },
      { ticker: 'SPY', date: '2026-01-05', open: 121, close: 121, adj_close: 121 },
    ],
    signalRows: [
      {
        date: '2026-01-02',
        signal: 'risk_caution',
        decision: 'DELVIS INVESTERAD (50%)',
        target_equity_weight_pct: 50,
        target_cash_weight_pct: 50,
      },
      {
        date: '2026-01-03',
        signal: 'risk_on',
        decision: 'FULLT INVESTERAD (100%)',
        target_equity_weight_pct: 100,
        target_cash_weight_pct: 0,
      },
      {
        date: '2026-01-04',
        signal: 'risk_off',
        decision: 'GÅ TILL CASH',
        target_equity_weight_pct: 0,
        target_cash_weight_pct: 100,
      },
    ],
  });

  assert.equal(positionMacro.positions[0].trade_action, 'stay_out');
  assert.equal(positionMacro.positions[1].trade_action, 'enter');
  assert.equal(positionMacro.positions[1].applied_equity_weight, 0.5);
  assert.equal(positionMacro.positions[2].trade_action, 'rebalance');
  assert.equal(positionMacro.positions[2].applied_equity_weight, 1);
  assert.equal(positionMacro.positions[3].trade_action, 'exit');
  assert.equal(positionMacro.equityRows[1].strategy_return_pct, 4.975);
  assert.equal(positionMacro.equityRows[2].strategy_return_pct, 9.975);
  assert.equal(positionMacro.summary.turnover, 3);

  const tradingLongCash = buildBacktestRunArtifacts({
    strategy: {
      code: 'trading_signal_v1_long_cash',
      benchmark_symbol: 'SPY',
      transaction_cost_bps: 5,
      rule_source: 'trading_signal_long_cash',
      params_json: { initial_state: 'cash' },
    },
    benchmarkBars: [
      { ticker: 'SPY', date: '2026-01-02', open: 100, close: 100, adj_close: 100 },
      { ticker: 'SPY', date: '2026-01-03', open: 100, close: 110, adj_close: 110 },
      { ticker: 'SPY', date: '2026-01-04', open: 110, close: 99, adj_close: 99 },
      { ticker: 'SPY', date: '2026-01-05', open: 99, close: 101, adj_close: 101 },
      { ticker: 'SPY', date: '2026-01-06', open: 101, close: 101, adj_close: 101 },
    ],
    tradingSignalRows: [
      {
        date: '2026-01-02',
        decision: 'KÖP SPY',
        target_state: 'long',
      },
      {
        date: '2026-01-03',
        decision: 'BEHÅLL',
        target_state: 'long',
      },
      {
        date: '2026-01-04',
        decision: 'SÄLJ SPY',
        target_state: 'cash',
      },
      {
        date: '2026-01-05',
        decision: 'GÅ KORT SPY',
        target_state: 'short',
      },
    ],
  });

  assert.equal(tradingLongCash.positions[0].trade_action, 'stay_out');
  assert.equal(tradingLongCash.positions[1].trade_action, 'enter');
  assert.equal(tradingLongCash.positions[1].applied_state, 'long');
  assert.equal(tradingLongCash.positions[2].trade_action, 'hold');
  assert.equal(tradingLongCash.positions[3].trade_action, 'exit');
  assert.equal(tradingLongCash.positions[4].trade_action, 'stay_out');
  assert.equal(tradingLongCash.positions[4].applied_state, 'cash');
  assert.match(tradingLongCash.positions[4].reason_code, /trading_signal:GÅ KORT SPY/);
  assert.equal(tradingLongCash.summary.turnover, 2);
  assert.equal(tradingLongCash.summary.time_in_market_pct, 40);
});
