import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('workspace shares one strike payload with the chart and options panel', async () => {
  const workspace = await readFile(new URL('../app/chart/chart-workspace.js', import.meta.url), 'utf8');

  assert.match(workspace, /\/api\/gex-dex-strikes\?ticker=/);
  assert.match(workspace, /gexDexStrikes=\{strikePayload\.strikes/);
  assert.match(workspace, /strikePayload=\{strikePayload\}/);
  assert.match(workspace, /strikeStatus=\{strikeStatus\}/);
});

test('financial chart attaches a price-scale-linked primitive capped at thirty percent', async () => {
  const chart = await readFile(new URL('../app/chart/financial-chart.js', import.meta.url), 'utf8');

  assert.match(chart, /GexDexInlineBarsPrimitive/);
  assert.match(chart, /maxWidthRatio:\s*0\.30/);
  assert.match(chart, /priceSeries\.attachPrimitive\(inlineExposurePrimitive\)/);
  assert.match(chart, /priceSeries\.detachPrimitive\(inlineExposurePrimitive\)/);
  assert.match(chart, /gexDexStrikes\s*=\s*\[\]/);
});

test('options panel accepts shared strike data without requiring a duplicate request', async () => {
  const component = await readFile(new URL('../app/chart/options-ladder.js', import.meta.url), 'utf8');

  assert.match(component, /strikePayload:\s*providedStrikePayload/);
  assert.match(component, /strikeStatus:\s*providedStrikeStatus/);
  assert.match(component, /providedStrikePayload\s*\?\?/);
  assert.match(component, /if \(providedStrikePayload\) return undefined/);
});
