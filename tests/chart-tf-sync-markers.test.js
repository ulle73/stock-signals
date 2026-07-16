import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildTfSyncAnchorData,
  buildTfSyncMarkers,
  getTfSyncFixedTopAnchor,
} from '../lib/chart/tf-sync-markers.js';

test('TF Sync uses one fixed lane above the full visible price range', () => {
  const bars = [
    { high: 105, low: 100 },
    { high: 120, low: 90 },
    { high: 110, low: 95 },
  ];

  assert.equal(getTfSyncFixedTopAnchor(bars), 124.2);
  assert.equal(getTfSyncFixedTopAnchor([{ high: null, low: 100 }]), null);
});

test('all TF Sync signal dates share the same top anchor', () => {
  assert.deepEqual(buildTfSyncAnchorData([
    { time: '2026-07-01', high: 105, low: 100, tf_sync_buy_signal: true },
    { time: '2026-07-02', high: 120, low: 90 },
    { time: '2026-07-03', high: 107, low: 102, tf_sync_sell_signal: true },
  ]), [
    { time: '2026-07-01', value: 124.2 },
    { time: '2026-07-03', value: 124.2 },
  ]);
});

test('TF Sync renders green and red downward arrows', () => {
  assert.deepEqual(buildTfSyncMarkers([
    { time: '2026-07-01', tf_sync_buy_signal: true },
    { time: '2026-07-02' },
    { time: '2026-07-03', tf_sync_sell_signal: true },
  ]), [
    { time: '2026-07-01', position: 'aboveBar', color: '#55ff55', shape: 'arrowDown' },
    { time: '2026-07-03', position: 'aboveBar', color: '#ff3b3b', shape: 'arrowDown' },
  ]);
});
