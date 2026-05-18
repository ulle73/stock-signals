import test from 'node:test';
import assert from 'node:assert/strict';
import { getSignalStudyField, listSignalStudyFields } from '../lib/signal-registry/fields.js';

test('signal study registry exposes expected core fields', () => {
  const fields = listSignalStudyFields();
  const keys = fields.map((field) => field.key);

  assert.ok(keys.includes('position.target_equity_weight_pct'));
  assert.ok(keys.includes('market.pct_above_50'));
  assert.ok(keys.includes('market.signal'));
  assert.ok(keys.includes('trading.target_state'));
  assert.ok(keys.includes('stock.ryd_obv_buy_signal'));
  assert.ok(keys.includes('tf_sync.state'));
});

test('signal study registry returns computed enum metadata for tf_sync.state', () => {
  const field = getSignalStudyField('tf_sync.state');

  assert.equal(field.type, 'enum');
  assert.deepEqual(field.possibleOptions, ['green', 'red', 'neutral']);
  assert.ok(field.allowedOperators.includes('changed_to'));
  assert.ok(field.allowedOperators.includes('changed_from'));
});

test('signal study registry rejects unknown fields', () => {
  assert.equal(getSignalStudyField('unknown.field'), null);
});
