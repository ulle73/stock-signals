import test from 'node:test';
import assert from 'node:assert/strict';
import { buildBrokerOrderRequest } from '../lib/execution/order-mapper.js';

test('maps an approved buy decision to an Alpaca market order request', () => {
  const request = buildBrokerOrderRequest({
    symbol: 'SPY',
    decision_status: 'approved_for_send',
    proposed_order_side: 'buy',
    proposed_order_notional: 1234.56,
    proposed_order_qty: null,
  }, { clientOrderId: 'client-1' });

  assert.deepEqual(request, {
    symbol: 'SPY',
    side: 'buy',
    type: 'market',
    time_in_force: 'day',
    notional: '1234.56',
    client_order_id: 'client-1',
  });
});

test('maps an approved sell-to-cash decision to a quantity-based Alpaca order request', () => {
  const request = buildBrokerOrderRequest({
    symbol: 'SPY',
    decision_status: 'approved_for_send',
    proposed_order_side: 'sell',
    proposed_order_notional: null,
    proposed_order_qty: 250,
  });

  assert.deepEqual(request, {
    symbol: 'SPY',
    side: 'sell',
    type: 'market',
    time_in_force: 'day',
    qty: '250',
  });
});

test('maps an approved buy-to-cover decision to a quantity-based Alpaca order request', () => {
  const request = buildBrokerOrderRequest({
    symbol: 'SPY',
    decision_status: 'approved_for_send',
    proposed_order_side: 'buy',
    proposed_order_notional: null,
    proposed_order_qty: 125,
  });

  assert.deepEqual(request, {
    symbol: 'SPY',
    side: 'buy',
    type: 'market',
    time_in_force: 'day',
    qty: '125',
  });
});

test('refuses to build a broker request for blocked or no-op decisions', () => {
  assert.throws(
    () => buildBrokerOrderRequest({ symbol: 'SPY', decision_status: 'blocked' }),
    /Cannot build broker order request/
  );
});
