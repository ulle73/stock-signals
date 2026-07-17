import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildGexDexLevelData,
  GEX_DEX_LEVEL_DEFINITIONS,
  hasGexDexLevelGroup,
} from '../lib/chart/gex-dex-levels.js';

test('GEX levels begin at the first real snapshot and extend only forward', () => {
  const data = buildGexDexLevelData([
    { date: '2026-07-10', callWall: 300 },
    { date: '2026-07-12', callWall: 305 },
  ], '2026-07-15');
  assert.deepEqual(data.callWall, [
    { time: '2026-07-10', value: 300 },
    { time: '2026-07-12', value: 305 },
    { time: '2026-07-15', value: 305 },
  ]);
  assert.equal(data.callWall.some((point) => point.time < '2026-07-10'), false);
});

test('a fresh snapshot after the latest price bar anchors at the latest real candle', () => {
  const data = buildGexDexLevelData([
    { date: '2026-07-17', callWall: 500, putWall: 480, gammaFlip: 470 },
  ], '2026-07-16');

  assert.deepEqual(data.callWall, [{ time: '2026-07-16', value: 500 }]);
  assert.deepEqual(data.putWall, [{ time: '2026-07-16', value: 480 }]);
  assert.deepEqual(data.gammaFlip, [{ time: '2026-07-16', value: 470 }]);
});

test('missing provider values break the line instead of inventing continuity', () => {
  const data = buildGexDexLevelData([
    { date: '2026-07-10', gammaFlip: 290 },
    { date: '2026-07-11', gammaFlip: null },
    { date: '2026-07-12', gammaFlip: 292 },
  ], '2026-07-12');
  assert.deepEqual(data.gammaFlip, [
    { time: '2026-07-10', value: 290 },
    { time: '2026-07-11' },
    { time: '2026-07-12', value: 292 },
  ]);
});

test('Gamma Flip is the independent default group and all other levels are optional', () => {
  assert.equal(hasGexDexLevelGroup([{ gammaFlip: 290 }], 'main'), true);
  assert.equal(hasGexDexLevelGroup([{ callWall: 300 }], 'main'), false);
  assert.equal(hasGexDexLevelGroup([{ callWall: 300 }], 'more'), true);
  assert.equal(hasGexDexLevelGroup([{ dexSupport: 280 }], 'more'), true);
  assert.equal(GEX_DEX_LEVEL_DEFINITIONS.gammaFlip.dashed, true);
});
