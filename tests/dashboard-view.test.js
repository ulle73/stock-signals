import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildMarketSeriesCards,
  normalizeTickerInput,
} from '../lib/utils/dashboard-view.js';

test('normalizeTickerInput uppercases, trims, and falls back to AAPL', () => {
  assert.equal(normalizeTickerInput(' msft '), 'MSFT');
  assert.equal(normalizeTickerInput(''), 'AAPL');
  assert.equal(normalizeTickerInput(undefined), 'AAPL');
});

test('buildMarketSeriesCards returns fixed cards and fills missing series with null', () => {
  const cards = buildMarketSeriesCards([
    { series_id: 'VIXCLS', date: '2026-05-04', value: '24.11' },
    { series_id: 'SP500', date: '2026-05-05', value: '5123.45' },
  ]);

  assert.deepEqual(cards, [
    {
      seriesId: 'SP500',
      label: 'S&P 500',
      description: 'Index close',
      value: '5123.45',
      date: '2026-05-05',
    },
    {
      seriesId: 'VIXCLS',
      label: 'VIX',
      description: 'Volatility index',
      value: '24.11',
      date: '2026-05-04',
    },
    {
      seriesId: 'BAMLH0A0HYM2',
      label: 'HY Spread',
      description: 'Credit stress',
      value: null,
      date: null,
    },
  ]);
});
