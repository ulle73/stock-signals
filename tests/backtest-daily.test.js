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
      divergence_status: 'none',
      short_divergence_status: 'none',
    },
    {
      date: '2026-01-03',
      pct_above_50: 45,
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
});
