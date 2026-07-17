import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { GEX_DEX_LEVEL_DEFINITIONS } from '../lib/chart/gex-dex-levels.js';

async function loadOptionsLadderModule() {
  try {
    return await import('../lib/chart/options-ladder.js');
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

test('options ladder uses the latest snapshot and sorts available levels from highest to lowest', async () => {
  const module = await loadOptionsLadderModule();
  assert.equal(typeof module.buildOptionsLadderModel, 'function');

  const model = module.buildOptionsLadderModel({
    latestPrice: 750.72,
    snapshot: {
      sourceTimestamp: '2026-07-17T12:00:00.000Z',
      sourceStatus: 'active',
      stale: false,
      netGex: -685300000,
      netDex: 10100000,
      dexResistance: 760,
      callWall: 750,
      gammaFlip: 748,
      putWall: 740,
      dexSupport: 730,
      volTrigger: null,
    },
  });

  assert.deepEqual(model.rows.map((row) => row.key), [
    'dexResistance', 'callWall', 'gammaFlip', 'putWall', 'dexSupport',
  ]);
  assert.equal(model.state.label, 'Negativ gamma');
  assert.equal(model.state.tone, 'danger');
  assert.equal(model.rows[0].distanceValue, 9.28);
  assert.equal(model.rows[0].distancePct, 1.24);
  assert.equal(model.rows[2].distanceValue, -2.72);
  assert.equal(model.rows[2].distancePct, -0.36);
});

test('options ladder fails open when no provider snapshot exists', async () => {
  const module = await loadOptionsLadderModule();
  assert.equal(typeof module.buildOptionsLadderModel, 'function');

  assert.deepEqual(module.buildOptionsLadderModel({ latestPrice: 100, snapshot: null }), {
    state: { label: 'Ingen GEX/DEX-data', tone: 'neutral' },
    netGex: null,
    netDex: null,
    sourceTimestamp: null,
    rows: [],
  });
});

test('workspace renders a responsive Options Ladder beside the existing chart', async () => {
  const [workspace, component, css] = await Promise.all([
    readFile(new URL('../app/chart/chart-workspace.js', import.meta.url), 'utf8'),
    readFile(new URL('../app/chart/options-ladder.js', import.meta.url), 'utf8').catch(() => ''),
    readFile(new URL('../app/chart/chart.css', import.meta.url), 'utf8'),
  ]);

  assert.match(workspace, /import OptionsLadder/);
  assert.match(workspace, /className="chart-workspace-main"/);
  assert.match(workspace, /<OptionsLadder/);
  assert.match(workspace, /latestPrice=\{payload\.latestPrice\}/);
  assert.match(workspace, /snapshots=\{payload\.gexDexSnapshots\}/);

  assert.match(component, /Options Ladder/);
  assert.match(component, /Lägesöversikt/);
  assert.match(component, /Net GEX/);
  assert.match(component, /Net DEX/);
  assert.match(component, /Avstånd i % relativt aktuell kurs/);

  assert.match(css, /\.chart-workspace-main\s*\{/);
  assert.match(css, /grid-template-columns:/);
  assert.match(css, /\.options-ladder\s*\{/);
  assert.match(css, /@media \(max-width: 1180px\)/);
});
