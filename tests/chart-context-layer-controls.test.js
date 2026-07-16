import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const registry = await readFile(new URL('../lib/chart/series-registry.js', import.meta.url), 'utf8');
const toolbar = await readFile(new URL('../app/chart/chart-toolbar.js', import.meta.url), 'utf8');
const workspace = await readFile(new URL('../app/chart/chart-workspace.js', import.meta.url), 'utf8');
const chart = await readFile(new URL('../app/chart/financial-chart.js', import.meta.url), 'utf8');

test('main GEX DEX and earnings are the only default context layers', () => {
  assert.match(registry, /DEFAULT_VISIBLE_CONTEXT_LAYERS = Object\.freeze\(\['gexDex', 'earnings'\]\)/);
  assert.match(registry, /CONTEXT_LAYER_KEYS = Object\.freeze\(\['gexDex', 'gexDexMore', 'earnings'\]\)/);
  assert.match(toolbar, /<span>Kontext<\/span>/);
  assert.match(toolbar, /keys=\{CONTEXT_LAYER_KEYS\}/);
});

test('workspace passes context payloads without creating extra panes', () => {
  assert.match(workspace, /<ChartContextStrip/);
  assert.match(workspace, /gexDexSnapshots=\{payload\.gexDexSnapshots\}/);
  assert.match(workspace, /earningsEvents=\{payload\.earningsEvents\}/);
  assert.doesNotMatch(workspace, /contextPane/);
});

test('financial chart uses step lines and independent context visibility', () => {
  assert.match(chart, /lineType: LineType\.WithSteps/);
  assert.match(chart, /definition\.group === 'main' \? 'gexDex' : 'gexDexMore'/);
  assert.match(chart, /visibleContextLayers\.includes\('earnings'\)/);
});
