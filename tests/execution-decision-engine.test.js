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
    rebalancePolicy: 'buffered_band_rebalance',
    targetGrossExposurePct: 95,
    cashBufferPct: 5,
    rebalanceBandRelative: 0.25,
    rebalanceBandAbsolutePct: 1,
    minOrderNotionalUsd: 100,
    minOrderEquityPct: 0.5,
    maxRebalanceTurnoverPct: 30,
    ...overrides,
  };
}

function createMarkovIntent(overrides = {}) {
  return {
    symbol: 'SPY',
    asset_class: 'us_equity',
    intent_status: 'active',
    target_state: 'long',
    target_exposure_pct: 10,
    signal_date: '2026-05-19',
    reference_price: 100,
    adapter_metadata_json: {
      ticker_count: 10,
      ...(overrides.adapter_metadata_json ?? {}),
    },
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
    config: createConfig({ rebalancePolicy: 'full_rebalance_exact', maxRebalanceTurnoverPct: 100 }),
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
      target_exposure_pct: 10,
      signal_date: '2026-05-19',
      adapter_metadata_json: { ticker_count: 10 },
    },
    brokerState: createBrokerState({ account: { status: 'ACTIVE', cash: 100000, equity: 100000, portfolioValue: 100000, tradingBlocked: false, accountBlocked: false } }),
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
  assert.equal(decision.proposed_order_notional, 9500);
});

test('full_rebalance_exact still builds a quantity-based sell decision when enabled explicitly', () => {
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
    config: createConfig({ rebalancePolicy: 'full_rebalance_exact' }),
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
      rebalancePolicy: 'full_rebalance_exact',
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

test('rounds short-entry quantity down to whole shares so Alpaca can accept the order', () => {
  const decision = buildExecutionDecision({
    intent: {
      symbol: 'SPY',
      asset_class: 'us_equity',
      intent_status: 'active',
      target_state: 'short',
      target_exposure_pct: -30,
      action_hint: 'enter_short',
      signal_date: '2026-05-19',
      reference_price: 110,
    },
    brokerState: createBrokerState(),
    config: createConfig({
      rebalancePolicy: 'full_rebalance_exact',
      shortingEnabled: true,
    }),
    mode: 'dry_run',
    now: new Date('2026-05-20T12:00:00.000Z'),
  });

  assert.equal(decision.proposed_order_side, 'sell');
  assert.equal(decision.proposed_order_qty, 272);
});

test('buffered_band_rebalance sells a ticker fully when it leaves the basket', () => {
  const decision = buildExecutionDecision({
    intent: createMarkovIntent({
      target_state: 'cash',
      target_exposure_pct: 0,
      action_hint: 'go_cash',
    }),
    brokerState: createBrokerState({
      account: { status: 'ACTIVE', cash: 20000, equity: 100000, portfolioValue: 100000, tradingBlocked: false, accountBlocked: false },
      positions: [{ symbol: 'SPY', qty: 95, marketValue: 9500, side: 'long' }],
    }),
    config: createConfig(),
    mode: 'dry_run',
    now: new Date('2026-05-20T12:00:00.000Z'),
  });

  assert.equal(decision.proposed_order_side, 'sell');
  assert.equal(decision.proposed_order_qty, 95);
  assert.equal(decision.decision_metadata_json.rebalance_action, 'exit');
});

test('buffered_band_rebalance keeps surviving basket members inside the drift band', () => {
  const decision = buildExecutionDecision({
    intent: createMarkovIntent(),
    brokerState: createBrokerState({
      account: { status: 'ACTIVE', cash: 10000, equity: 100000, portfolioValue: 100000, tradingBlocked: false, accountBlocked: false },
      positions: [{ symbol: 'SPY', qty: 100, marketValue: 10000, side: 'long' }],
    }),
    config: createConfig(),
    mode: 'dry_run',
    now: new Date('2026-05-20T12:00:00.000Z'),
  });

  assert.equal(decision.decision_status, 'no_op');
  assert.equal(decision.proposed_order_side, null);
  assert.equal(decision.decision_metadata_json.rebalance_policy, 'buffered_band_rebalance');
  assert.equal(decision.decision_metadata_json.rebalance_action, 'hold');
  assert.equal(decision.decision_metadata_json.target_weight_pct, 9.5);
});

test('buffered_band_rebalance trims only to the upper band instead of exact target', () => {
  const decision = buildExecutionDecision({
    intent: createMarkovIntent(),
    brokerState: createBrokerState({
      account: { status: 'ACTIVE', cash: 10000, equity: 100000, portfolioValue: 100000, tradingBlocked: false, accountBlocked: false },
      positions: [{ symbol: 'SPY', qty: 130, marketValue: 13000, side: 'long' }],
    }),
    config: createConfig(),
    mode: 'dry_run',
    now: new Date('2026-05-20T12:00:00.000Z'),
  });

  assert.equal(decision.proposed_order_side, 'sell');
  assert.equal(decision.proposed_order_qty, 11.25);
  assert.equal(decision.decision_metadata_json.rebalance_action, 'trim');
});

test('buffered_band_rebalance buys new entries from cash above the configured buffer', () => {
  const decision = buildExecutionDecision({
    intent: createMarkovIntent(),
    brokerState: createBrokerState({
      account: { status: 'ACTIVE', cash: 100000, equity: 100000, portfolioValue: 100000, tradingBlocked: false, accountBlocked: false },
    }),
    config: createConfig(),
    mode: 'dry_run',
    now: new Date('2026-05-20T12:00:00.000Z'),
  });

  assert.equal(decision.proposed_order_side, 'buy');
  assert.equal(decision.proposed_order_notional, 9500);
  assert.equal(decision.decision_metadata_json.rebalance_action, 'enter');
});

test('buffered_band_rebalance skips small orders below the configured minimum', () => {
  const decision = buildExecutionDecision({
    intent: createMarkovIntent(),
    brokerState: createBrokerState({
      account: { status: 'ACTIVE', cash: 10000, equity: 100000, portfolioValue: 100000, tradingBlocked: false, accountBlocked: false },
      positions: [{ symbol: 'SPY', qty: 72, marketValue: 7200, side: 'long' }],
    }),
    config: createConfig({
      rebalanceBandRelative: 0.2,
      rebalanceBandAbsolutePct: 0.1,
      minOrderNotionalUsd: 1000,
      minOrderEquityPct: 0,
    }),
    mode: 'dry_run',
    now: new Date('2026-05-20T12:00:00.000Z'),
  });

  assert.equal(decision.decision_status, 'no_op');
  assert.equal(decision.decision_metadata_json.rebalance_action, 'skipped_small_order');
});
