import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildStockDailyPriceUpsertStatements,
} from '../lib/repositories/prices.js';
import {
  buildMarketSeriesUpsertStatements,
} from '../lib/repositories/market-series.js';

test('buildStockDailyPriceUpsertStatements batches multiple candles into one statement', () => {
  const candles = [
    { date: '2025-01-01', open: 1, high: 2, low: 0.5, close: 1.5, adj_close: 1.4, volume: 10 },
    { date: '2025-01-02', open: 2, high: 3, low: 1.5, close: 2.5, adj_close: 2.4, volume: 11 },
    { date: '2025-01-03', open: 3, high: 4, low: 2.5, close: 3.5, adj_close: 3.4, volume: 12 },
  ];

  const statements = buildStockDailyPriceUpsertStatements('AAPL', candles, 2);

  assert.equal(statements.length, 2);
  assert.match(statements[0].sql, /values \(\$1,\s*\$2,\s*\$3,\s*\$4,\s*\$5,\s*\$6,\s*\$7,\s*\$8,\s*'yahoo', now\(\)\), \(\$9,/i);
  assert.deepEqual(statements[0].params, [
    'AAPL', '2025-01-01', 1, 2, 0.5, 1.5, 1.4, 10,
    'AAPL', '2025-01-02', 2, 3, 1.5, 2.5, 2.4, 11,
  ]);
  assert.deepEqual(statements[1].params, [
    'AAPL', '2025-01-03', 3, 4, 2.5, 3.5, 3.4, 12,
  ]);
});

test('buildMarketSeriesUpsertStatements batches multiple rows into one statement', () => {
  const rows = [
    { date: '2025-01-01', value: 100 },
    { date: '2025-01-02', value: 101 },
  ];

  const statements = buildMarketSeriesUpsertStatements('SP500', rows, 100);

  assert.equal(statements.length, 1);
  assert.match(statements[0].sql, /insert into market_series_daily/i);
  assert.match(statements[0].sql, /values \(\$1,\s*\$2,\s*\$3,\s*'fred', now\(\)\), \(\$4,\s*\$5,\s*\$6,\s*'fred', now\(\)\)/i);
  assert.deepEqual(statements[0].params, [
    'SP500', '2025-01-01', 100,
    'SP500', '2025-01-02', 101,
  ]);
});
