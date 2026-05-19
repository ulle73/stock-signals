import test from 'node:test';
import assert from 'node:assert/strict';
import { listSignalStudyFields } from '../lib/signal-registry/fields.js';
import {
  coerceSignalInstrumentSelection,
  scopeNeedsSignalInstrument,
} from '../lib/utils/signal-study-ui-config.js';

const fieldsByKey = new Map(
  listSignalStudyFields().map((field) => [field.key, field])
);

const signalInstrumentOptions = [
  { value: 'AAPL', label: 'AAPL · Apple Inc.' },
  { value: 'MSFT', label: 'MSFT · Microsoft' },
];

test('signal study UI detects when ticker-scoped fields require signal instrument', () => {
  const config = {
    studyType: 'state_period',
    stateField: 'tf_sync.state',
    filters: [],
  };

  assert.equal(scopeNeedsSignalInstrument(config, fieldsByKey), true);
});

test('signal study UI coerces invalid ticker-scoped signal instrument to valid return ticker', () => {
  const config = {
    studyType: 'state_period',
    returnInstrument: 'AAPL',
    signalInstrument: 'SPY',
    stateField: 'tf_sync.state',
    filters: [],
  };

  const nextConfig = coerceSignalInstrumentSelection({
    config,
    fieldsByKey,
    signalInstrumentOptions,
  });

  assert.equal(nextConfig.signalInstrument, 'AAPL');
});

test('signal study UI clears invalid signal instrument when only global fields are selected', () => {
  const config = {
    studyType: 'forward_horizon',
    returnInstrument: 'SPY',
    signalInstrument: 'SPY',
    conditions: [
      { field: 'market.pct_above_50', operator: '>', value: 50 },
    ],
  };

  const nextConfig = coerceSignalInstrumentSelection({
    config,
    fieldsByKey,
    signalInstrumentOptions,
  });

  assert.equal(nextConfig.signalInstrument, '');
});
