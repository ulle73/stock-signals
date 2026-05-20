import test from 'node:test';
import assert from 'node:assert/strict';
import { buildBrokerStateSnapshotRows, normalizeAlpacaBrokerState } from '../lib/execution/alpaca-state.js';

test('normalizeAlpacaBrokerState converts raw Alpaca payloads into generic numeric execution state', () => {
  const normalized = normalizeAlpacaBrokerState({
    apiBaseUrl: 'https://paper-api.alpaca.markets/v2',
    account: {
      id: 'acct_1',
      status: 'ACTIVE',
      currency: 'USD',
      cash: '100000',
      equity: '100500',
      portfolio_value: '100500',
      buying_power: '200000',
      trading_blocked: false,
      account_blocked: false,
    },
    positions: [
      {
        asset_id: 'asset_1',
        symbol: 'SPY',
        qty: '250',
        market_value: '99950',
        side: 'long',
      },
    ],
    openOrders: [
      {
        id: 'ord_1',
        symbol: 'SPY',
        side: 'buy',
        status: 'accepted',
        notional: '1000',
      },
    ],
  });

  assert.equal(normalized.metadata.apiBaseUrl, 'https://paper-api.alpaca.markets/v2');
  assert.equal(normalized.account.cash, 100000);
  assert.equal(normalized.account.portfolioValue, 100500);
  assert.equal(normalized.positions[0].qty, 250);
  assert.equal(normalized.positions[0].marketValue, 99950);
  assert.equal(normalized.openOrders[0].status, 'accepted');
});

test('buildBrokerStateSnapshotRows emits account, position and open-order snapshots', () => {
  const normalized = normalizeAlpacaBrokerState({
    apiBaseUrl: 'https://paper-api.alpaca.markets/v2',
    account: {
      id: 'acct_1',
      status: 'ACTIVE',
      cash: '100000',
      equity: '100000',
      portfolio_value: '100000',
      trading_blocked: false,
      account_blocked: false,
    },
    positions: [
      {
        asset_id: 'asset_1',
        symbol: 'SPY',
        qty: '250',
        market_value: '99950',
        side: 'long',
      },
    ],
    openOrders: [
      {
        id: 'ord_1',
        symbol: 'SPY',
        side: 'buy',
        status: 'accepted',
        notional: '1000',
      },
    ],
  });

  const rows = buildBrokerStateSnapshotRows({
    broker: 'alpaca',
    capturedAt: '2026-05-20T10:00:00.000Z',
    normalizedState: normalized,
    rawState: {
      account: { id: 'acct_1' },
      positions: [{ asset_id: 'asset_1' }],
      openOrders: [{ id: 'ord_1' }],
    },
  });

  assert.equal(rows.length, 3);
  assert.deepEqual(rows.map((row) => row.snapshot_type), ['account', 'position', 'open_order']);
  assert.equal(rows[1].symbol, 'SPY');
  assert.equal(rows[2].broker_object_id, 'ord_1');
});
