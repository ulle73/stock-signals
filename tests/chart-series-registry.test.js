import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CHART_SERIES,
  DEFAULT_VISIBLE_INDICATORS,
  DEFAULT_VISIBLE_OVERLAYS,
  DEFAULT_VISIBLE_SIGNALS,
  INDICATOR_KEYS,
  MOVING_AVERAGE_KEYS,
  SIGNAL_KEYS,
} from '../lib/chart/series-registry.js';

test('series registry contains stable chart keys in render order', () => {
  assert.deepEqual(Object.keys(CHART_SERIES), [
    'price', 'volume', 'sma5', 'sma10', 'sma20', 'sma50', 'sma200',
    'rydObvZscore', 'rydObvRaw', 'tfSync', 'plceVolumeExtreme', 'cvolExtreme', 'yield2y10y',
  ]);
});

test('moving-average registry keys and default visibility are explicit', () => {
  assert.deepEqual(MOVING_AVERAGE_KEYS, ['sma5', 'sma10', 'sma20', 'sma50', 'sma200']);
  assert.deepEqual(DEFAULT_VISIBLE_OVERLAYS, ['sma20', 'sma50', 'sma200']);
});

test('RYD indicator registry keys use pane two and keep raw OBV optional', () => {
  assert.deepEqual(INDICATOR_KEYS, ['rydObvZscore', 'rydObvRaw']);
  assert.deepEqual(DEFAULT_VISIBLE_INDICATORS, ['rydObvZscore']);
  assert.equal(CHART_SERIES.rydObvZscore.kind, 'histogram');
  assert.equal(CHART_SERIES.rydObvZscore.pane, 2);
  assert.equal(CHART_SERIES.rydObvRaw.kind, 'line');
  assert.equal(CHART_SERIES.rydObvRaw.pane, 2);
  assert.equal(CHART_SERIES.rydObvRaw.priceScaleId, 'left');
});

test('all four TradingView signal layers are visible by default on pane zero', () => {
  assert.deepEqual(SIGNAL_KEYS, ['tfSync', 'plceVolumeExtreme', 'cvolExtreme', 'yield2y10y']);
  assert.deepEqual(DEFAULT_VISIBLE_SIGNALS, ['tfSync', 'plceVolumeExtreme', 'cvolExtreme', 'yield2y10y']);

  assert.equal(CHART_SERIES.tfSync.kind, 'markers');
  assert.equal(CHART_SERIES.tfSync.pane, 0);
  assert.deepEqual(CHART_SERIES.tfSync.availabilityKeys, ['tf_sync_buy_signal', 'tf_sync_sell_signal']);

  assert.equal(CHART_SERIES.plceVolumeExtreme.kind, 'markers');
  assert.equal(CHART_SERIES.plceVolumeExtreme.pane, 0);
  assert.deepEqual(CHART_SERIES.plceVolumeExtreme.availabilityKeys, ['plce_threshold_buy_signal']);

  assert.equal(CHART_SERIES.cvolExtreme.kind, 'markers');
  assert.equal(CHART_SERIES.cvolExtreme.pane, 0);
  assert.deepEqual(CHART_SERIES.cvolExtreme.availabilityKeys, ['cvol_sell_signal_1', 'cvol_sell_signal_2', 'cvol_sell_signal_3']);

  assert.equal(CHART_SERIES.yield2y10y.kind, 'markers');
  assert.equal(CHART_SERIES.yield2y10y.pane, 0);
  assert.deepEqual(CHART_SERIES.yield2y10y.availabilityKeys, ['yield_2y_10y_buy_signal', 'yield_2y_10y_sell_signal']);
});

test('every moving average has one professional line definition', () => {
  for (const key of MOVING_AVERAGE_KEYS) {
    assert.equal(CHART_SERIES[key].kind, 'line');
    assert.equal(CHART_SERIES[key].pane, 0);
    assert.equal(typeof CHART_SERIES[key].label, 'string');
    assert.match(CHART_SERIES[key].color, /^#[0-9a-f]{6}$/i);
  }
});
