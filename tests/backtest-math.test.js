import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateDailyStrategyReturn,
  calculateDrawdown,
  deriveAdjustedOpen,
} from '../lib/utils/backtest-math.js';

test('deriveAdjustedOpen keeps open on the adjusted scale of adj_close', () => {
  assert.equal(
    deriveAdjustedOpen({
      open: 90,
      close: 100,
      adj_close: 80,
    }),
    72
  );
});

test('calculateDailyStrategyReturn handles long-to-long close-to-close returns', () => {
  const result = calculateDailyStrategyReturn({
    previousState: 'long',
    nextState: 'long',
    previousBar: {
      open: 98,
      close: 100,
      adj_close: 100,
    },
    currentBar: {
      open: 103,
      close: 105,
      adj_close: 105,
    },
    transactionCostBps: 5,
  });

  assert.equal(result.strategyReturnPct, 5);
  assert.equal(result.transactionCostPct, 0);
  assert.equal(result.tradeAction, 'hold');
});

test('calculateDailyStrategyReturn handles cash-to-long entry at next open with transaction cost', () => {
  const result = calculateDailyStrategyReturn({
    previousState: 'cash',
    nextState: 'long',
    previousBar: {
      open: 98,
      close: 100,
      adj_close: 100,
    },
    currentBar: {
      open: 110,
      close: 120,
      adj_close: 108,
    },
    transactionCostBps: 5,
  });

  assert.equal(result.strategyReturnPct, 9.040909);
  assert.equal(result.transactionCostPct, 0.05);
  assert.equal(result.tradeAction, 'enter');
});

test('calculateDailyStrategyReturn handles long-to-cash exit at next open with transaction cost', () => {
  const result = calculateDailyStrategyReturn({
    previousState: 'long',
    nextState: 'cash',
    previousBar: {
      open: 98,
      close: 100,
      adj_close: 100,
    },
    currentBar: {
      open: 110,
      close: 120,
      adj_close: 108,
    },
    transactionCostBps: 5,
  });

  assert.equal(result.strategyReturnPct, -1.05);
  assert.equal(result.transactionCostPct, 0.05);
  assert.equal(result.tradeAction, 'exit');
});

test('calculateDailyStrategyReturn returns zero for cash-to-cash days', () => {
  const result = calculateDailyStrategyReturn({
    previousState: 'cash',
    nextState: 'cash',
    previousBar: {
      open: 98,
      close: 100,
      adj_close: 100,
    },
    currentBar: {
      open: 103,
      close: 105,
      adj_close: 105,
    },
    transactionCostBps: 5,
  });

  assert.equal(result.strategyReturnPct, 0);
  assert.equal(result.transactionCostPct, 0);
  assert.equal(result.tradeAction, 'stay_out');
});

test('calculateDailyStrategyReturn supports partial allocations and open rebalance costs', () => {
  const result = calculateDailyStrategyReturn({
    previousWeight: 0.5,
    nextWeight: 1,
    previousBar: {
      open: 100,
      close: 110,
      adj_close: 110,
    },
    currentBar: {
      open: 121,
      close: 133.1,
      adj_close: 133.1,
    },
    transactionCostBps: 5,
  });

  assert.equal(result.strategyReturnPct, 14.975);
  assert.equal(result.transactionCostPct, 0.025);
  assert.equal(result.tradeAction, 'rebalance');
});

test('calculateDrawdown returns percentage drop from the running peak', () => {
  assert.equal(calculateDrawdown(120, 150), -20);
  assert.equal(calculateDrawdown(150, 150), 0);
});
