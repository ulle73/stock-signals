import test from 'node:test';
import assert from 'node:assert/strict';
import { runExecutionPipeline } from '../lib/execution/run-execution-pipeline.js';

function createRawBrokerState() {
  return {
    account: {
      id: 'acct_1',
      status: 'ACTIVE',
      cash: '100000',
      equity: '100000',
      portfolio_value: '100000',
      buying_power: '200000',
      trading_blocked: false,
      account_blocked: false,
    },
    positions: [],
    openOrders: [],
  };
}

function createConfig(tradingEnabled = false) {
  return {
    alpaca: {
      apiBaseUrl: 'https://paper-api.alpaca.markets/v2',
      tradingEnabled,
    },
    allowedSymbols: ['SPY'],
    maxOrderNotionalUsd: 100000,
    maxPositionNotionalUsd: 100000,
    maxSignalAgeDays: 5,
  };
}

function createRepositories() {
  const calls = {
    intents: [],
    decisions: [],
    orders: [],
    snapshots: [],
  };
  let nextIntentId = 1;
  let nextDecisionId = 10;
  let nextOrderId = 100;

  return {
    calls,
    executionRepository: {
      async insertExecutionIntent(row) {
        calls.intents.push(row);
        return nextIntentId++;
      },
      async insertExecutionDecision(row) {
        calls.decisions.push(row);
        return nextDecisionId++;
      },
      async insertExecutionOrder(row) {
        calls.orders.push(row);
        return nextOrderId++;
      },
    },
    brokerStateRepository: {
      async insertBrokerStateSnapshots(rows) {
        calls.snapshots.push(...rows);
        return rows.length;
      },
    },
  };
}

test('runExecutionPipeline persists snapshots, intents and dry-run decisions without submitting orders', async () => {
  const repositories = createRepositories();
  const submitCalls = [];

  const result = await runExecutionPipeline({
    mode: 'dry_run',
    loadIntents: async () => [{
      source_type: 'trading_signal_daily',
      source_table: 'trading_signal_daily',
      source_row_key: '2026-05-19',
      strategy_code: 'trading_signal_v1_long_cash',
      symbol: 'SPY',
      asset_class: 'us_equity',
      intent_status: 'active',
      target_state: 'long',
      target_exposure_pct: 100,
      action_hint: 'go_long',
      signal_date: '2026-05-19',
      signal_timestamp: '2026-05-19T00:00:00.000Z',
      reason_summary: 'bullish',
      adapter_metadata_json: {},
    }],
    brokerClient: {
      async getAccount() { return createRawBrokerState().account; },
      async getPositions() { return createRawBrokerState().positions; },
      async getOpenOrders() { return createRawBrokerState().openOrders; },
      async submitOrder(order) {
        submitCalls.push(order);
        return { id: 'ord_1' };
      },
    },
    config: createConfig(false),
    executionRepository: repositories.executionRepository,
    brokerStateRepository: repositories.brokerStateRepository,
    now: new Date('2026-05-20T12:00:00.000Z'),
  });

  assert.equal(repositories.calls.intents.length, 1);
  assert.equal(repositories.calls.decisions.length, 1);
  assert.equal(repositories.calls.decisions[0].decision_status, 'dry_run');
  assert.equal(repositories.calls.orders.length, 0);
  assert.equal(submitCalls.length, 0);
  assert.equal(repositories.calls.snapshots.length, 1);
  assert.equal(result.results[0].decisionStatus, 'dry_run');
});

test('runExecutionPipeline persists blocked short intents without calling Alpaca submitOrder', async () => {
  const repositories = createRepositories();
  let submitCalled = false;

  const result = await runExecutionPipeline({
    mode: 'paper_execute',
    loadIntents: async () => [{
      source_type: 'trading_signal_daily',
      source_table: 'trading_signal_daily',
      source_row_key: '2026-05-19',
      strategy_code: 'trading_signal_v1_long_cash',
      symbol: 'SPY',
      asset_class: 'us_equity',
      intent_status: 'blocked',
      target_state: 'short',
      target_exposure_pct: -100,
      action_hint: 'enter_short',
      signal_date: '2026-05-19',
      signal_timestamp: '2026-05-19T00:00:00.000Z',
      reason_summary: 'blocked',
      adapter_metadata_json: {
        blocked_reason_code: 'short_signal_not_supported',
      },
    }],
    brokerClient: {
      async getAccount() { return createRawBrokerState().account; },
      async getPositions() { return createRawBrokerState().positions; },
      async getOpenOrders() { return createRawBrokerState().openOrders; },
      async submitOrder() {
        submitCalled = true;
        return { id: 'ord_1' };
      },
    },
    config: createConfig(true),
    executionRepository: repositories.executionRepository,
    brokerStateRepository: repositories.brokerStateRepository,
    now: new Date('2026-05-20T12:00:00.000Z'),
  });

  assert.equal(repositories.calls.intents.length, 1);
  assert.equal(repositories.calls.decisions[0].decision_status, 'blocked');
  assert.deepEqual(repositories.calls.decisions[0].blocking_codes_json, ['short_signal_not_supported']);
  assert.equal(repositories.calls.orders.length, 0);
  assert.equal(submitCalled, false);
  assert.equal(result.results[0].decisionStatus, 'blocked');
});

test('runExecutionPipeline submits approved paper orders and persists broker responses', async () => {
  const repositories = createRepositories();
  const submitCalls = [];

  const result = await runExecutionPipeline({
    mode: 'paper_execute',
    loadIntents: async () => [{
      source_type: 'trading_signal_daily',
      source_table: 'trading_signal_daily',
      source_row_key: '2026-05-19',
      strategy_code: 'trading_signal_v1_long_cash',
      symbol: 'SPY',
      asset_class: 'us_equity',
      intent_status: 'active',
      target_state: 'long',
      target_exposure_pct: 100,
      action_hint: 'go_long',
      signal_date: '2026-05-19',
      signal_timestamp: '2026-05-19T00:00:00.000Z',
      reason_summary: 'bullish',
      adapter_metadata_json: {},
    }],
    brokerClient: {
      async getAccount() { return createRawBrokerState().account; },
      async getPositions() { return createRawBrokerState().positions; },
      async getOpenOrders() { return createRawBrokerState().openOrders; },
      async submitOrder(order) {
        submitCalls.push(order);
        return { id: 'ord_1', status: 'accepted' };
      },
    },
    config: createConfig(true),
    executionRepository: repositories.executionRepository,
    brokerStateRepository: repositories.brokerStateRepository,
    generateClientOrderId: ({ intentId }) => `intent-${intentId}`,
    now: new Date('2026-05-20T12:00:00.000Z'),
  });

  assert.equal(repositories.calls.decisions[0].decision_status, 'sent');
  assert.equal(repositories.calls.orders.length, 1);
  assert.equal(repositories.calls.orders[0].broker_order_id, 'ord_1');
  assert.equal(submitCalls.length, 1);
  assert.equal(submitCalls[0].client_order_id, 'intent-1');
  assert.equal(result.results[0].decisionStatus, 'sent');
});

test('runExecutionPipeline propagates custom broker labels into snapshots and orders', async () => {
  const repositories = createRepositories();

  await runExecutionPipeline({
    mode: 'paper_execute',
    broker: 'alpaca_bull10',
    loadIntents: async () => [({
      source_type: 'ticker_markov_daily',
      source_table: 'ticker_markov_daily',
      source_row_key: 'top_10_bull_weekly:2026-05-19',
      strategy_code: 'ticker_markov_top_10_bull_weekly',
      symbol: 'SPY',
      asset_class: 'us_equity',
      intent_status: 'active',
      target_state: 'long',
      target_exposure_pct: 100,
      action_hint: 'go_long',
      signal_date: '2026-05-19',
      signal_timestamp: '2026-05-19T00:00:00.000Z',
      reason_summary: 'bullish',
      adapter_metadata_json: {},
    })],
    brokerClient: {
      async getAccount() { return createRawBrokerState().account; },
      async getPositions() { return createRawBrokerState().positions; },
      async getOpenOrders() { return createRawBrokerState().openOrders; },
      async submitOrder() {
        return { id: 'ord_custom', status: 'accepted' };
      },
    },
    config: createConfig(true),
    executionRepository: repositories.executionRepository,
    brokerStateRepository: repositories.brokerStateRepository,
    now: new Date('2026-05-20T12:00:00.000Z'),
  });

  assert.equal(repositories.calls.snapshots[0].broker, 'alpaca_bull10');
  assert.equal(repositories.calls.decisions[0].broker, 'alpaca_bull10');
  assert.equal(repositories.calls.orders[0].broker, 'alpaca_bull10');
});
