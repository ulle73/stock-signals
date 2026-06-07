import test from 'node:test';
import assert from 'node:assert/strict';
import { buildExecutionDecision } from '../lib/execution/decision-engine.js';

function createBrokerState(overrides = {}) {
  return {
    metadata: { apiBaseUrl: 'https://paper-api.alpaca.markets/v2' },
    account: {
      status: 'ACTIVE',
      cash: 100000,
      equity: 100000,
      portfolioValue: 100000,
      tradingBlocked: false,
      accountBlocked: false,
    },
    positions: [],
    openOrders: [],
    ...overrides,
  };
}

function createConfig(overrides = {}) {
  return {
    alpaca: {
      apiBaseUrl: 'https://paper-api.alpaca.markets/v2',
      tradingEnabled: false,
    },
    allowedSymbols: ['SPY'],
    maxOrderNotionalUsd: 100000,
    maxPositionNotionalUsd: 100000,
    maxSignalAgeDays: 5,
    shortingEnabled: false,
    ...overrides,
  };
}

test('returns no_op for a no-op intent', () => {
  const decision = buildExecutionDecision({
    intent: {
      symbol: 'SPY',
      intent_status: 'no_op',
      target_state: 'cash',
      target_exposure_pct: 0,
      signal_date: '2026-05-19',
    },
    brokerState: createBrokerState(),
    config: createConfig(),
    mode: 'dry_run',
    now: new Date('2026-05-20T12:00:00.000Z'),
  });

  assert.equal(decision.decision_status, 'no_op');
  assert.equal(decision.proposed_order_side, null);
});

test('builds a dry-run buy decision for a long target when no position exists', () => {
  const decision = buildExecutionDecision({
    intent: {
      symbol: 'SPY',
      asset_class: 'us_equity',
      intent_status: 'active',
      target_state: 'long',
      target_exposure_pct: 100,
      signal_date: '2026-05-19',
    },
    brokerState: createBrokerState(),
    config: createConfig(),
    mode: 'dry_run',
    now: new Date('2026-05-20T12:00:00.000Z'),
  });

  assert.equal(decision.decision_status, 'dry_run');
  assert.equal(decision.proposed_order_side, 'buy');
  assert.equal(decision.proposed_order_notional, 100000);
  assert.equal(decision.current_position_qty, 0);
});

test('builds a dry-run sell decision when target is cash and SPY is currently held', () => {
  const decision = buildExecutionDecision({
    intent: {
      symbol: 'SPY',
      asset_class: 'us_equity',
      intent_status: 'active',
      target_state: 'cash',
      target_exposure_pct: 0,
      signal_date: '2026-05-19',
    },
    brokerState: createBrokerState({
      positions: [{ symbol: 'SPY', qty: 250, marketValue: 99950, side: 'long' }],
    }),
    config: createConfig(),
    mode: 'dry_run',
    now: new Date('2026-05-20T12:00:00.000Z'),
  });

  assert.equal(decision.decision_status, 'dry_run');
  assert.equal(decision.proposed_order_side, 'sell');
  assert.equal(decision.proposed_order_qty, 250);
  assert.equal(decision.proposed_order_notional, null);
});

test('blocks an adapter-blocked short signal before any order can be proposed', () => {
  const decision = buildExecutionDecision({
    intent: {
      symbol: 'SPY',
      asset_class: 'us_equity',
      intent_status: 'blocked',
      target_state: 'short',
      target_exposure_pct: -100,
      signal_date: '2026-05-19',
      adapter_metadata_json: {
        blocked_reason_code: 'short_signal_not_supported',
      },
    },
    brokerState: createBrokerState(),
    config: createConfig(),
    mode: 'dry_run',
    now: new Date('2026-05-20T12:00:00.000Z'),
  });

  assert.equal(decision.decision_status, 'blocked');
  assert.deepEqual(decision.blocking_codes, ['short_signal_not_supported']);
  assert.equal(decision.proposed_order_side, null);
});

test('approves a paper-execute decision only when trading is enabled and all rules pass', () => {
  const decision = buildExecutionDecision({
    intent: {
      symbol: 'SPY',
      asset_class: 'us_equity',
      intent_status: 'active',
      target_state: 'long',
      target_exposure_pct: 100,
      signal_date: '2026-05-19',
    },
    brokerState: createBrokerState(),
    config: createConfig({
      alpaca: {
        apiBaseUrl: 'https://paper-api.alpaca.markets/v2',
        tradingEnabled: true,
      },
    }),
    mode: 'paper_execute',
    now: new Date('2026-05-20T12:00:00.000Z'),
  });

  assert.equal(decision.decision_status, 'approved_for_send');
  assert.equal(decision.proposed_order_side, 'buy');
});

test('builds a quantity-based sell decision when a long basket position must be reduced', () => {
  const decision = buildExecutionDecision({
    intent: {
      symbol: 'SPY',
      asset_class: 'us_equity',
      intent_status: 'active',
      target_state: 'long',
      target_exposure_pct: 50,
      signal_date: '2026-05-19',
      reference_price: 100,
    },
    brokerState: createBrokerState({
      positions: [{ symbol: 'SPY', qty: 800, marketValue: 80000, side: 'long' }],
    }),
    config: createConfig(),
    mode: 'dry_run',
    now: new Date('2026-05-20T12:00:00.000Z'),
  });

  assert.equal(decision.proposed_order_side, 'sell');
  assert.equal(decision.proposed_order_qty, 300);
  assert.equal(decision.proposed_order_notional, null);
});

test('builds a short-entry decision when shorting is enabled and a reference price is available', () => {
  const decision = buildExecutionDecision({
    intent: {
      symbol: 'SPY',
      asset_class: 'us_equity',
      intent_status: 'active',
      target_state: 'short',
      target_exposure_pct: -25,
      action_hint: 'enter_short',
      signal_date: '2026-05-19',
      reference_price: 100,
    },
    brokerState: createBrokerState(),
    config: createConfig({
      shortingEnabled: true,
    }),
    mode: 'dry_run',
    now: new Date('2026-05-20T12:00:00.000Z'),
  });

  assert.equal(decision.decision_status, 'dry_run');
  assert.equal(decision.proposed_order_side, 'sell');
  assert.equal(decision.proposed_order_qty, 250);
  assert.equal(decision.target_position_notional, -25000);
});
