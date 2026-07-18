import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { GEX_DEX_LEVEL_DEFINITIONS } from '../lib/chart/gex-dex-levels.js';

async function loadPositioningModule() {
  try {
    return await import('../lib/chart/options-positioning.js');
  } catch {
    return {};
  }
}

test('only Gamma Flip belongs to the default GEX/DEX chart group', () => {
  const defaultKeys = Object.entries(GEX_DEX_LEVEL_DEFINITIONS)
    .filter(([, definition]) => definition.group === 'main')
    .map(([key]) => key);
  const extraKeys = Object.entries(GEX_DEX_LEVEL_DEFINITIONS)
    .filter(([, definition]) => definition.group === 'more')
    .map(([key]) => key);

  assert.deepEqual(defaultKeys, ['gammaFlip']);
  assert.deepEqual(extraKeys, ['callWall', 'putWall', 'dexResistance', 'dexSupport', 'volTrigger']);
});

test('strike selection keeps at most thirty rows on each side and returns a descending price ladder', async () => {
  const module = await loadPositioningModule();
  assert.equal(typeof module.selectOptionsPositioningStrikes, 'function');

  const strikes = [
    ...Array.from({ length: 40 }, (_, index) => ({ strike: 60 + index, net_gex: index, net_dex: index })),
    ...Array.from({ length: 40 }, (_, index) => ({ strike: 101 + index, net_gex: index, net_dex: index })),
  ];
  const selected = module.selectOptionsPositioningStrikes({
    strikes,
    spotPrice: 100,
    maxPerSide: 30,
    keyLevels: { putWall: 60, gammaFlip: 75, callWall: 140, dexSupport: 65, dexResistance: 135 },
  });

  assert.equal(selected.filter((row) => row.strike < 100).length, 30);
  assert.equal(selected.filter((row) => row.strike > 100).length, 30);
  assert.equal(selected.length, 60);
  assert.equal(selected.some((row) => row.strike === 60), true);
  assert.equal(selected.some((row) => row.strike === 140), true);
  assert.equal(selected.some((row) => row.strike === 99), true);
  assert.equal(selected.some((row) => row.strike === 101), true);
  assert.deepEqual(selected.map((row) => row.strike), [...selected.map((row) => row.strike)].sort((a, b) => b - a));
});

test('all provider strikes are shown from highest to lowest when each side stays within the cap', async () => {
  const module = await loadPositioningModule();
  const strikes = [90, 95, 100, 105, 110].map((strike) => ({ strike, net_gex: strike, net_dex: -strike }));
  const selected = module.selectOptionsPositioningStrikes({ strikes, spotPrice: 100, maxPerSide: 30 });
  assert.deepEqual(selected.map((row) => row.strike), [110, 105, 100, 95, 90]);
});

test('options positioning model aligns GEX and DEX on the same descending strike rows', async () => {
  const module = await loadPositioningModule();
  assert.equal(typeof module.buildOptionsPositioningModel, 'function');

  const model = module.buildOptionsPositioningModel({
    latestPrice: 333.85,
    snapshots: [{
      sourceTimestamp: '2026-07-17T22:07:54.770Z',
      sourceStatus: 'active',
      stale: false,
      spotPrice: 333.85,
      netGex: 5_200_000,
      netDex: 1_600_000,
      callWall: 335,
      putWall: 325,
      gammaFlip: 312.5,
      dexResistance: 340,
      dexSupport: 330,
      volTrigger: 338,
    }],
    strikes: [
      { strike: '312.5', net_gex: '-100', net_dex: '-50' },
      { strike: '325', net_gex: '-20', net_dex: '30' },
      { strike: '330', net_gex: '40', net_dex: '80' },
      { strike: '335', net_gex: '150', net_dex: '100' },
      { strike: '338', net_gex: '90', net_dex: '120' },
      { strike: '340', net_gex: '110', net_dex: '160' },
    ],
  });

  assert.equal(model.state.label, 'Positiv gamma');
  assert.deepEqual(model.rows.map((row) => row.strike), [340, 338, 335, 330, 325, 312.5]);
  assert.equal(model.rows.find((row) => row.strike === 335).gexPct, 100);
  assert.equal(model.rows.find((row) => row.strike === 340).dexPct, 100);
  assert.deepEqual(model.gexAnnotations.get(335).map((item) => item.key), ['callWall']);
  assert.deepEqual(model.gexAnnotations.get(325).map((item) => item.key), ['putWall']);
  assert.deepEqual(model.gexAnnotations.get(312.5).map((item) => item.key), ['gammaFlip']);
  assert.deepEqual(model.dexAnnotations.get(340).map((item) => item.key), ['dexResistance']);
  assert.deepEqual(model.dexAnnotations.get(330).map((item) => item.key), ['dexSupport']);
  assert.equal(model.spotStrike, 335);
});

test('key-level history remains available for hover and keyboard tooltips', async () => {
  const module = await loadPositioningModule();
  assert.equal(typeof module.buildOptionsPositioningLevelHistory, 'function');
  const snapshots = Array.from({ length: 12 }, (_, index) => ({
    date: `2026-07-${String(index + 1).padStart(2, '0')}`,
    sourceTimestamp: `2026-07-${String(index + 1).padStart(2, '0')}T12:00:00.000Z`,
    callWall: 200 + index,
  }));
  const history = module.buildOptionsPositioningLevelHistory({ snapshots, limit: 10 });
  assert.equal(history.callWall.length, 10);
  assert.equal(history.callWall[0].value, 211);
  assert.equal(history.callWall[0].delta, 1);
  assert.equal(history.callWall.at(-1).value, 202);
});

test('chart renders one combined strike ladder with GEX left and DEX right', async () => {
  const [component, css, route, repository] = await Promise.all([
    readFile(new URL('../app/chart/options-ladder.js', import.meta.url), 'utf8'),
    readFile(new URL('../app/chart/options-ladder.css', import.meta.url), 'utf8'),
    readFile(new URL('../app/api/gex-dex-strikes/route.js', import.meta.url), 'utf8').catch(() => ''),
    readFile(new URL('../lib/repositories/gex-dex-chart-strikes.js', import.meta.url), 'utf8').catch(() => ''),
  ]);

  assert.match(component, /Optionspositionering/i);
  assert.match(component, /options-positioning-combined/);
  assert.match(component, /data-metric="gex"/);
  assert.match(component, /data-metric="dex"/);
  assert.match(component, /\/api\/gex-dex-strikes/);
  assert.doesNotMatch(component, /function ExposureChart/);
  assert.match(component, /role="tooltip"/);
  assert.match(css, /\.options-positioning-combined/);
  assert.match(css, /grid-template-columns:[^;]*strike/i);
  assert.match(css, /\.options-positioning-metric/);
  assert.match(css, /overflow-y:\s*auto/);
  assert.match(css, /@media \(max-width: 1180px\)/);
  assert.match(route, /getLatestGexDexStrikeSnapshot/);
  assert.match(repository, /from gex_dex_strike_snapshots/);
  assert.match(repository, /limit 1/);
});
