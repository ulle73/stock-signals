import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCvolAnchorData,
  buildCvolMarkers,
  getCvolAboveAnchor,
} from '../lib/chart/cvol-markers.js';

test('CVOL uses a deterministic gap above the candle', () => {
  assert.equal(getCvolAboveAnchor({ high: 105, low: 100, close: 103 }), 109.25);
  assert.equal(getCvolAboveAnchor({ high: 100, low: 100, close: 100 }), 101.2);
  assert.equal(getCvolAboveAnchor({ high: null, low: 100, close: 100 }), null);
});

test('CVOL creates one anchor for any stored sell threshold', () => {
  assert.deepEqual(buildCvolAnchorData([
    { time: '2026-07-01', high: 105, low: 100, close: 103, cvol_sell_signal_1: true },
    { time: '2026-07-02', high: 106, low: 101, close: 104 },
    { time: '2026-07-03', high: 107, low: 102, close: 105, cvol_sell_signal_2: true, cvol_sell_signal_3: true },
  ]), [
    { time: '2026-07-01', value: 109.25 },
    { time: '2026-07-03', value: 111.25 },
  ]);
});

test('CVOL collapses simultaneous thresholds to one blue marker and enlarges multiples', () => {
  assert.deepEqual(buildCvolMarkers([
    { time: '2026-07-01', cvol_sell_signal_1: true, cvol_signal: 'sell_z20_gt_1_5' },
    { time: '2026-07-02' },
    {
      time: '2026-07-03',
      cvol_sell_signal_1: true,
      cvol_sell_signal_2: true,
      cvol_sell_signal_3: true,
      cvol_signal: 'multiple_sell_signals',
    },
  ]), [
    { time: '2026-07-01', position: 'aboveBar', color: '#0004ff', shape: 'arrowDown', size: 1 },
    { time: '2026-07-03', position: 'aboveBar', color: '#0004ff', shape: 'arrowDown', size: 2 },
  ]);
});
