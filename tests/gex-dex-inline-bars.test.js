import test from 'node:test';
import assert from 'node:assert/strict';

async function loadModule() {
  try {
    return await import('../lib/chart/gex-dex-inline-bars.js');
  } catch {
    return {};
  }
}

test('inline exposure rows normalize finite strike data and deduplicate strikes', async () => {
  const module = await loadModule();
  assert.equal(typeof module.buildInlineExposureRows, 'function');

  const rows = module.buildInlineExposureRows([
    { strike: '330', net_gex: '10', net_dex: '-5' },
    { strike: 335, netGex: 20, netDex: 15 },
    { strike: 330, netGex: 12, netDex: -7 },
    { strike: null, netGex: 99, netDex: 99 },
    { strike: 340, netGex: 'bad', netDex: 4 },
  ]);

  assert.deepEqual(rows, [
    { strike: 340, netGex: 0, netDex: 4 },
    { strike: 335, netGex: 20, netDex: 15 },
    { strike: 330, netGex: 12, netDex: -7 },
  ]);
});

test('inline geometry keeps GEX left, DEX right and caps each bar at thirty percent', async () => {
  const module = await loadModule();
  assert.equal(typeof module.buildInlineExposureGeometry, 'function');

  const geometry = module.buildInlineExposureGeometry({
    rows: [
      { strike: 340, netGex: 100, netDex: -200 },
      { strike: 330, netGex: -50, netDex: 100 },
      { strike: 320, netGex: 25, netDex: 50 },
    ],
    paneWidth: 1000,
    paneHeight: 500,
    maxWidthRatio: 0.30,
    priceToCoordinate: (price) => ({ 340: 40, 330: 250, 320: 520 }[price] ?? null),
  });

  assert.equal(geometry.length, 2);
  assert.deepEqual(geometry.map((row) => row.strike), [340, 330]);
  assert.equal(geometry[0].gex.width, 300);
  assert.equal(geometry[0].dex.width, 300);
  assert.equal(geometry[1].gex.width, 150);
  assert.equal(geometry[1].dex.width, 150);
  assert.equal(geometry.every((row) => row.gex.x === 0), true);
  assert.equal(geometry.every((row) => row.dex.x + row.dex.width === 1000), true);
  assert.equal(geometry.every((row) => row.gex.width <= 300 && row.dex.width <= 300), true);
});

test('GEX and DEX use independent exposure scales', async () => {
  const module = await loadModule();
  const geometry = module.buildInlineExposureGeometry({
    rows: [
      { strike: 110, netGex: 1_000, netDex: 10 },
      { strike: 100, netGex: 500, netDex: 5 },
    ],
    paneWidth: 900,
    paneHeight: 400,
    priceToCoordinate: (price) => (price === 110 ? 80 : 160),
  });

  assert.equal(geometry[0].gex.width, 270);
  assert.equal(geometry[0].dex.width, 270);
  assert.equal(geometry[1].gex.width, 135);
  assert.equal(geometry[1].dex.width, 135);
});

test('primitive exposes a stable pane view and never changes autoscale', async () => {
  const module = await loadModule();
  assert.equal(typeof module.GexDexInlineBarsPrimitive, 'function');

  const primitive = new module.GexDexInlineBarsPrimitive({ maxWidthRatio: 0.30 });
  const firstViews = primitive.paneViews();
  const secondViews = primitive.paneViews();

  assert.equal(firstViews, secondViews);
  assert.equal(firstViews.length, 1);
  assert.equal(firstViews[0].zOrder(), 'bottom');
  assert.equal(primitive.autoscaleInfo(), null);
});
