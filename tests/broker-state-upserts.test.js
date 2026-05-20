import test from 'node:test';
import assert from 'node:assert/strict';
import { buildBrokerStateSnapshotInsertStatements } from '../lib/repositories/broker-state.js';

test('buildBrokerStateSnapshotInsertStatements batches broker state snapshots', () => {
  const statements = buildBrokerStateSnapshotInsertStatements([
    {
      broker: 'alpaca',
      snapshot_type: 'account',
      symbol: null,
      broker_object_id: 'acct_1',
      captured_at: '2026-05-20T10:00:00.000Z',
      normalized_json: { cash: 100000, equity: 100000 },
      payload_json: { id: 'acct_1', cash: '100000' },
    },
    {
      broker: 'alpaca',
      snapshot_type: 'open_order',
      symbol: 'SPY',
      broker_object_id: 'ord_1',
      captured_at: '2026-05-20T10:00:00.000Z',
      normalized_json: { symbol: 'SPY', status: 'accepted' },
      payload_json: { id: 'ord_1', symbol: 'SPY' },
    },
  ], 2);

  assert.equal(statements.length, 1);
  assert.match(statements[0].sql, /insert into broker_state_snapshots/i);
  assert.deepEqual(statements[0].params, [
    'alpaca',
    'account',
    null,
    'acct_1',
    '2026-05-20T10:00:00.000Z',
    JSON.stringify({ cash: 100000, equity: 100000 }),
    JSON.stringify({ id: 'acct_1', cash: '100000' }),
    'alpaca',
    'open_order',
    'SPY',
    'ord_1',
    '2026-05-20T10:00:00.000Z',
    JSON.stringify({ symbol: 'SPY', status: 'accepted' }),
    JSON.stringify({ id: 'ord_1', symbol: 'SPY' }),
  ]);
});
