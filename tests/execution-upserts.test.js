import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildExecutionDecisionInsertStatement,
  buildExecutionIntentInsertStatement,
  buildExecutionOrderInsertStatement,
  buildExecutionOrderUpdateStatement,
} from '../lib/repositories/execution.js';

test('buildExecutionIntentInsertStatement stores normalized adapter output', () => {
  const statement = buildExecutionIntentInsertStatement({
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
    reason_summary: 'strong_bull_confirmation',
    adapter_metadata_json: { decision: 'KÖP SPY' },
  });

  assert.match(statement.sql, /insert into execution_intents/i);
  assert.match(statement.sql, /returning id/i);
  assert.deepEqual(statement.params, [
    'trading_signal_daily',
    'trading_signal_daily',
    '2026-05-19',
    'trading_signal_v1_long_cash',
    'SPY',
    'us_equity',
    'active',
    'long',
    '100',
    'go_long',
    '2026-05-19',
    '2026-05-19T00:00:00.000Z',
    'strong_bull_confirmation',
    JSON.stringify({ decision: 'KÖP SPY' }),
  ]);
});

test('buildExecutionDecisionInsertStatement stores decision, risk and proposal fields', () => {
  const statement = buildExecutionDecisionInsertStatement({
    intent_id: 12,
    broker: 'alpaca',
    mode: 'dry_run',
    decision_status: 'dry_run',
    current_position_qty: 0,
    current_position_market_value: 0,
    current_position_side: null,
    current_cash: 100000,
    current_equity: 100000,
    proposed_order_side: 'buy',
    proposed_order_qty: null,
    proposed_order_notional: 100000,
    target_position_notional: 100000,
    blocking_codes_json: [],
    risk_results_json: [{ rule: 'paper_only_check', status: 'pass' }],
    decision_metadata_json: { target_state: 'long' },
  });

  assert.match(statement.sql, /insert into execution_decisions/i);
  assert.match(statement.sql, /returning id/i);
  assert.deepEqual(statement.params, [
    12,
    'alpaca',
    'dry_run',
    'dry_run',
    '0',
    '0',
    null,
    '100000',
    '100000',
    'buy',
    null,
    '100000',
    '100000',
    JSON.stringify([]),
    JSON.stringify([{ rule: 'paper_only_check', status: 'pass' }]),
    JSON.stringify({ target_state: 'long' }),
  ]);
});

test('buildExecutionOrderInsertStatement stores broker request and response payloads', () => {
  const statement = buildExecutionOrderInsertStatement({
    decision_id: 99,
    broker: 'alpaca',
    broker_order_id: 'ord_123',
    symbol: 'SPY',
    side: 'buy',
    order_type: 'market',
    time_in_force: 'day',
    qty: null,
    notional: 1000,
    client_order_id: 'client-123',
    request_json: { symbol: 'SPY', notional: '1000' },
    response_json: { id: 'ord_123', status: 'accepted' },
    broker_status: 'accepted',
  });

  assert.match(statement.sql, /insert into execution_orders/i);
  assert.match(statement.sql, /returning id/i);
  assert.deepEqual(statement.params, [
    99,
    'alpaca',
    'ord_123',
    'SPY',
    'buy',
    'market',
    'day',
    null,
    '1000',
    'client-123',
    JSON.stringify({ symbol: 'SPY', notional: '1000' }),
    JSON.stringify({ id: 'ord_123', status: 'accepted' }),
    'accepted',
  ]);
});

test('buildExecutionOrderUpdateStatement updates broker response by broker order id', () => {
  const statement = buildExecutionOrderUpdateStatement({
    broker: 'alpaca',
    broker_order_id: 'ord_123',
    broker_status: 'filled',
    response_json: { id: 'ord_123', status: 'filled' },
  });

  assert.match(statement.sql, /update execution_orders set/i);
  assert.match(statement.sql, /where broker = \$1 and broker_order_id = \$2/i);
  assert.deepEqual(statement.params, [
    'alpaca',
    'ord_123',
    'filled',
    JSON.stringify({ id: 'ord_123', status: 'filled' }),
  ]);
});
