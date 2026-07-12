import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CHART_SERIES,
  DEFAULT_VISIBLE_OVERLAYS,
  MOVING_AVERAGE_KEYS,
} from '../lib/chart/series-registry.js';

test('series registry contains stable V1 keys in render order', () => {
  assert.deepEqual(Object.keys(CHART_SERIES), [
    'price',
    'volume',
    'sma5',
    'sma10',
    'sma20',
    'sma50',
    'sma200',
  ]);
});

test('moving-average registry keys and default visibility are explicit', () => {
  assert.deepEqual(MOVING_AVERAGE_KEYS, ['sma5', 'sma10', 'sma20', 'sma50', 'sma200']);
  assert.deepEqual(DEFAULT_VISIBLE_OVERLAYS, ['sma20', 'sma50', 'sma200']);
});

test('every moving average has one professional line definition', () => {
  for (const key of MOVING_AVERAGE_KEYS) {
    assert.equal(CHART_SERIES[key].kind, 'line');
    assert.equal(CHART_SERIES[key].pane, 0);
    assert.equal(typeof CHART_SERIES[key].label, 'string');
    assert.match(CHART_SERIES[key].color, /^#[0-9a-f]{6}$/i);
  }
});
