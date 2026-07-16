import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildTfSyncAnchorData,
  buildTfSyncMarkers,
  getTfSyncTopAnchor,
} from '../lib/chart/tf-sync-markers.js';

test('TF Sync uses a deterministic top lane above the candle', () => {
  assert.equal(getTfSyncTopAnchor({ high: 105, low: 100, close: 103 }), 119.4);
  assert.equal(getTfSyncTopAnchor({ high: 100, low: 100, close: 100 }), 104.8);
  assert.equal(getTfSyncTopAnchor({ high: null, low: 100, close: 100 }), null);
});

test('TF Sync anchor data includes signal dates only', () => {
  assert.deepEqual(buildTfSyncAnchorData([
    { time: '2026-07-01', high: 105, low: 100, close: 103, tf_sync_buy_signal: true },
    { time: '2026-07-02', high: 106, low: 101, close: 104 },
    { time: '2026-07-03', high: 107, low: 102, close: 105, tf_sync_sell_signal: true },
  ]), [
    { time: '2026-07-01', value: 119.4 },
    { time: '2026-07-03', value: 121.4 },
  ]);
});

test('TF Sync renders green and red downward triangles', () => {
  assert.deepEqual(buildTfSyncMarkers([
    { time: '2026-07-01', tf_sync_buy_signal: true },
    { time: '2026-07-02' },
    { time: '2026-07-03', tf_sync_sell_signal: true },
  ]), [
    { time: '2026-07-01', position: 'aboveBar', color: '#55ff55', shape: 'arrowDown' },
    { time: '2026-07-03', position: 'aboveBar', color: '#ff3b3b', shape: 'arrowDown' },
  ]);
});
