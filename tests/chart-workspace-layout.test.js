import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

function firstCssBlock(css, selector) {
  const start = css.indexOf(selector);
  const end = css.indexOf('}', start);
  return css.slice(start, end + 1);
}

test('the chart uses the full row and options positioning is placed below it', async () => {
  const [chartCss, optionsCss, polishCss, workspace] = await Promise.all([
    readFile(new URL('../app/chart/chart.css', import.meta.url), 'utf8'),
    readFile(new URL('../app/chart/options-ladder.css', import.meta.url), 'utf8'),
    readFile(new URL('../app/chart/options-positioning-polish.css', import.meta.url), 'utf8'),
    readFile(new URL('../app/chart/chart-workspace.js', import.meta.url), 'utf8'),
  ]);

  assert.match(firstCssBlock(optionsCss, '.chart-workspace-main'), /grid-template-columns:\s*minmax\(0,\s*1fr\)/);
  assert.match(firstCssBlock(chartCss, '.chart-workspace-frame'), /width:\s*100%/);
  assert.match(firstCssBlock(optionsCss, '.options-positioning'), /width:\s*100%/);
  assert.match(firstCssBlock(polishCss, '.options-positioning'), /width:\s*100%/);
  assert.doesNotMatch(optionsCss, /\.options-positioning\s*\{[^}]*width:\s*clamp/s);
  assert.doesNotMatch(polishCss, /\.options-positioning\s*\{[^}]*width:\s*clamp/s);
  assert.match(workspace, /<FinancialChart[\s\S]*?<\/div>\s*\{status === 'ready' && payload \? \(\s*<OptionsLadder/s);
});
