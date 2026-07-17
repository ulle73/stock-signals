import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const chart = await readFile(new URL('../app/chart/financial-chart.js', import.meta.url), 'utf8');
const legend = await readFile(new URL('../app/chart/crosshair-legend.js', import.meta.url), 'utf8');

test('financial chart passes all visibility arrays to the crosshair legend', () => {
  assert.match(chart, /<CrosshairLegend[\s\S]*visibleOverlays=\{visibleOverlays\}/);
  assert.match(chart, /<CrosshairLegend[\s\S]*visibleIndicators=\{visibleIndicators\}/);
  assert.match(chart, /<CrosshairLegend[\s\S]*visibleSignals=\{visibleSignals\}/);
});

test('crosshair legend fails open when a visibility array is omitted', () => {
  assert.match(legend, /visibleIndicators = \[\]/);
  assert.match(legend, /visibleOverlays = \[\]/);
  assert.match(legend, /visibleSignals = \[\]/);
});
