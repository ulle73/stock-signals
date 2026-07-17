import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildEarningsAnchorData,
  buildEarningsMarkers,
  getEarningsBelowAnchor,
} from '../lib/chart/earnings-markers.js';

test('earnings anchors only use real bar dates', () => {
  const bars = [
    { time: '2026-07-10', high: 105, low: 100, close: 103 },
    { time: '2026-07-11', high: 106, low: 101, close: 104 },
  ];
  assert.deepEqual(buildEarningsAnchorData(bars, [
    { date: '2026-07-10' },
    { date: '2026-08-01' },
  ]), [{ time: '2026-07-10', value: getEarningsBelowAnchor(bars[0]) }]);
});

test('earnings markers are compact amber E events', () => {
  assert.deepEqual(buildEarningsMarkers([{ date: '2026-07-10', confirmed: true }]), [{
    time: '2026-07-10', position: 'belowBar', color: '#f59e0b', shape: 'circle', text: 'E', size: 1.5,
  }]);
});
