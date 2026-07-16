import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildYieldAnchorData,
  buildYieldMarkers,
  getYieldAnchor,
} from '../lib/chart/yield-2y-10y-markers.js';

test('2Y + 10Y markers use the outer collision tier', () => {
  assert.equal(getYieldAnchor({ high: 105, low: 100, close: 103, yield_2y_10y_buy_signal: true }), 91);
  assert.equal(getYieldAnchor({ high: 105, low: 100, close: 103, yield_2y_10y_sell_signal: true }), 114);
  assert.equal(getYieldAnchor({ high: 100, low: 100, close: 100, yield_2y_10y_buy_signal: true }), 97.5);
});

test('2Y + 10Y creates anchors for stored buy and sell events only', () => {
  assert.deepEqual(buildYieldAnchorData([
    { time: '2026-01-01', high: 105, low: 100, close: 103, yield_2y_10y_buy_signal: true },
    { time: '2026-01-02', high: 106, low: 101, close: 104 },
    { time: '2026-01-03', high: 107, low: 102, close: 105, yield_2y_10y_sell_signal: true },
  ]), [
    { time: '2026-01-01', value: 91 },
    { time: '2026-01-03', value: 116 },
  ]);
});

test('2Y + 10Y renders very large white directional triangles', () => {
  assert.deepEqual(buildYieldMarkers([
    { time: '2026-01-01', yield_2y_10y_buy_signal: true },
    { time: '2026-01-03', yield_2y_10y_sell_signal: true },
  ]), [
    { time: '2026-01-01', position: 'belowBar', color: '#ffffff', shape: 'arrowUp', size: 3 },
    { time: '2026-01-03', position: 'aboveBar', color: '#ffffff', shape: 'arrowDown', size: 3 },
  ]);
});
