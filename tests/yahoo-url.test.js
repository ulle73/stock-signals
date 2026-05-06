import test from 'node:test';
import assert from 'node:assert/strict';
import { buildYahooChartUrl } from '../lib/sources/yahoo.js';

test('buildYahooChartUrl uses range queries by default', () => {
  assert.equal(
    buildYahooChartUrl('AAPL', { range: '400d' }),
    'https://query1.finance.yahoo.com/v8/finance/chart/AAPL?range=400d&interval=1d'
  );
});

test('buildYahooChartUrl uses period bounds for incremental fetches', () => {
  assert.equal(
    buildYahooChartUrl('BRK.B', { period1: 100, period2: 200 }),
    'https://query1.finance.yahoo.com/v8/finance/chart/BRK.B?period1=100&period2=200&interval=1d'
  );
});

test('buildYahooChartUrl uses the same daily interval for benchmark tickers', () => {
  assert.equal(
    buildYahooChartUrl('SPY', { range: '1mo' }),
    'https://query1.finance.yahoo.com/v8/finance/chart/SPY?range=1mo&interval=1d'
  );
});
