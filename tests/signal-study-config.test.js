import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeAndValidateStudyConfig } from '../lib/utils/signal-study-config.js';

test('signal study config normalizes modes for forward horizon studies', () => {
  const config = normalizeAndValidateStudyConfig({
    name: 'forward-check',
    studyType: 'forward_horizon',
    returnInstrument: 'SPY',
    maxHorizonDays: 10,
    conditionMode: 'all',
    conditions: [
      { field: 'market.pct_above_50', operator: '>', value: 50 },
    ],
  });

  assert.equal(config.conditionMode, 'ALL');
});

test('signal study config rejects invalid enum value in condition', () => {
  assert.throws(
    () => normalizeAndValidateStudyConfig({
      name: 'bad-enum',
      studyType: 'forward_horizon',
      returnInstrument: 'SPY',
      maxHorizonDays: 5,
      conditions: [
        { field: 'market.signal', operator: '=', value: 'wrong' },
      ],
    }),
    /not allowed/
  );
});
