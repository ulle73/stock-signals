import test from 'node:test';
import assert from 'node:assert/strict';
import { getChartTheme } from '../lib/chart/chart-theme.js';

test('the initial chart leaves twelve bars of space after the latest candle', () => {
  assert.equal(getChartTheme().timeScale.rightOffset, 12);
});
