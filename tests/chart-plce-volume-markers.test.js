import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildPlceAnchorData,
  buildPlceMarkers,
  getPlceBelowAnchor,
} from '../lib/chart/plce-volume-markers.js';

test('PLCE uses a deterministic gap below the candle', () => {
  assert.equal(getPlceBelowAnchor({ high: 105, low: 100, close: 103 }), 96);
  assert.equal(getPlceBelowAnchor({ high: 100, low: 100, close: 100 }), 98.8);
  assert.equal(getPlceBelowAnchor({ high: 100, low: null, close: 100 }), null);
});

test('PLCE anchors stored threshold signals only', () => {
  assert.deepEqual(buildPlceAnchorData([
    { time: '2026-07-01', high: 105, low: 100, close: 103, plce_threshold_buy_signal: true },
    { time: '2026-07-02', high: 106, low: 101, close: 104, plce_threshold_buy_signal: false },
  ]), [{ time: '2026-07-01', value: 96 }]);
});

test('PLCE renders one large blue upward marker per signal date', () => {
  assert.deepEqual(buildPlceMarkers([
    { time: '2026-07-01', plce_threshold_buy_signal: true },
    { time: '2026-07-02', plce_threshold_buy_signal: false },
  ]), [{
    time: '2026-07-01',
    position: 'belowBar',
    color: '#0004ff',
    shape: 'arrowUp',
    size: 2,
  }]);
});
