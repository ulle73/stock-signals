import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../app/chart/chart-context-strip.js', import.meta.url), 'utf8');

test('context strip contains the four approved insight cards', () => {
  assert.match(source, /label="Relativ styrka"/);
  assert.match(source, /63d-percentil/);
  assert.match(source, /label="Bredd"/);
  assert.match(source, /SMA50/);
  assert.match(source, /label="Volatilitet"/);
  assert.match(source, /ATR-percentil/);
  assert.match(source, /label="Optionsläge"/);
  assert.match(source, /Net GEX/);
  assert.match(source, /Net DEX/);
});

test('next earnings remains a compact context event rather than a future chart point', () => {
  assert.match(source, /className="chart-next-event"/);
  assert.match(source, /Nästa rapport/);
  assert.doesNotMatch(source, /createSeriesMarkers/);
});
