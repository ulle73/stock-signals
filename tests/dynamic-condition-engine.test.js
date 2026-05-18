import test from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluateCondition,
  evaluateConditionSet,
  validateCondition,
} from '../lib/utils/dynamic-condition-engine.js';
import { getSignalStudyField } from '../lib/signal-registry/fields.js';

function bar(values) {
  return { values };
}

test('dynamic condition engine evaluates numeric, boolean and enum operators', () => {
  const currentBar = bar({
    'market.pct_above_50': 54,
    'stock.ryd_obv_buy_signal': true,
    'tf_sync.state': 'green',
  });
  const previousBar = bar({
    'market.pct_above_50': 48,
    'stock.ryd_obv_buy_signal': false,
    'tf_sync.state': 'neutral',
  });

  assert.equal(
    evaluateCondition(
      { field: 'market.pct_above_50', operator: '>', value: 50 },
      { currentBar, previousBar }
    ),
    true
  );

  assert.equal(
    evaluateCondition(
      { field: 'stock.ryd_obv_buy_signal', operator: 'is_true' },
      { currentBar, previousBar }
    ),
    true
  );

  assert.equal(
    evaluateCondition(
      { field: 'tf_sync.state', operator: 'changed_to', value: 'green' },
      { currentBar, previousBar }
    ),
    true
  );
});

test('dynamic condition engine detects crosses and composite modes', () => {
  const currentBar = bar({
    'market.pct_above_50': 51,
    'market.vix': 21,
  });
  const previousBar = bar({
    'market.pct_above_50': 49,
    'market.vix': 27,
  });

  assert.equal(
    evaluateCondition(
      { field: 'market.pct_above_50', operator: 'crossed_above', value: 50 },
      { currentBar, previousBar }
    ),
    true
  );

  assert.equal(
    evaluateConditionSet({
      conditions: [
        { field: 'market.pct_above_50', operator: '>', value: 50 },
        { field: 'market.vix', operator: '<', value: 25 },
      ],
      conditionMode: 'ALL',
      currentBar,
      previousBar,
    }),
    true
  );

  assert.equal(
    evaluateConditionSet({
      conditions: [
        { field: 'market.pct_above_50', operator: '>', value: 60 },
        { field: 'market.vix', operator: '<', value: 25 },
      ],
      conditionMode: 'ANY',
      currentBar,
      previousBar,
    }),
    true
  );
});

test('dynamic condition engine validates registry-backed operators safely', () => {
  assert.doesNotThrow(() =>
    validateCondition({
      field: 'market.pct_above_50',
      operator: 'between',
      value: [40, 60],
    })
  );

  assert.throws(
    () =>
      validateCondition({
        field: 'market.signal',
        operator: 'crossed_above',
        value: 'risk_on',
      }),
    /Operator crossed_above is not allowed/
  );

  assert.throws(
    () =>
      validateCondition({
        field: 'not.allowed',
        operator: '=',
        value: 1,
      }),
    /Unknown signal study field/
  );

  assert.equal(getSignalStudyField('market.signal')?.type, 'enum');
});
