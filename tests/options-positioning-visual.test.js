import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('options positioning uses a dense professional table treatment', async () => {
  const css = await readFile(new URL('../app/chart/options-positioning-polish.css', import.meta.url), 'utf8');

  assert.match(css, /--options-row-height:\s*34px/);
  assert.match(css, /\.options-positioning-row\s*\{[^}]*border-bottom:/s);
  assert.match(css, /\.options-positioning-row\.is-spot\s*\{[^}]*outline:/s);
  assert.match(css, /\.options-positioning-combined-head\s*\{[^}]*text-transform:/s);
  assert.match(css, /\.options-positioning-strike-cell > strong\s*\{[^}]*font-size:\s*0\.72rem/s);
  assert.match(css, /\.options-positioning-bar-zero\s*\{[^}]*box-shadow:/s);
  assert.match(css, /\.options-positioning-value\s*\{[^}]*font-weight:\s*800/s);
});

test('options positioning values use colored text without colored backgrounds', async () => {
  const css = await readFile(new URL('../app/chart/options-positioning-polish.css', import.meta.url), 'utf8');

  assert.match(css, /\.options-positioning-value\[class\*=["']tone-["']\]\s*\{[^}]*background:\s*transparent/s);
  assert.match(css, /\.options-positioning-value\.tone-positive\s*\{[^}]*color:\s*var\(--accent\)/s);
  assert.match(css, /\.options-positioning-value\.tone-danger\s*\{[^}]*color:\s*var\(--danger\)/s);
});
