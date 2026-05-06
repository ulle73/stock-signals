import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildBenchmarkPriceUpsertStatements,
  upsertBenchmarkDailyPrices,
} from '../lib/repositories/benchmark-prices.js';

test('buildBenchmarkPriceUpsertStatements batches benchmark rows with stable params and benchmark conflict updates', () => {
  const rows = [
    {
      ticker: 'SPY',
      date: '2026-01-02',
      open: 580.12,
      high: 582.34,
      low: 579.56,
      close: 581.78,
      adj_close: 581.65,
      volume: 101234500,
    },
    {
      ticker: 'SPY',
      date: '2026-01-05',
      open: 582.11,
      high: 583.45,
      low: 580.9,
      close: 581.33,
      adj_close: 581.2,
      volume: 99887766,
    },
    {
      ticker: 'QQQ',
      date: '2026-01-05',
      open: 512.5,
      high: 515.25,
      low: 510.75,
      close: 514.8,
      adj_close: 514.62,
      volume: 45678901,
    },
  ];

  const statements = buildBenchmarkPriceUpsertStatements(rows, { batchSize: 2 });

  assert.equal(statements.length, 2);
  assert.match(statements[0].sql, /insert into benchmark_daily_prices/i);
  assert.match(statements[0].sql, /values \(\$1,\s*\$2,\s*\$3,\s*\$4,\s*\$5,\s*\$6,\s*\$7,\s*\$8,\s*'yahoo', now\(\)\), \(\$9,\s*\$10,\s*\$11,\s*\$12,\s*\$13,\s*\$14,\s*\$15,\s*\$16,\s*'yahoo', now\(\)\)/i);
  assert.match(statements[0].sql, /on conflict \(ticker, date\) do update set/i);
  assert.match(statements[0].sql, /open = excluded\.open/i);
  assert.match(statements[0].sql, /high = excluded\.high/i);
  assert.match(statements[0].sql, /low = excluded\.low/i);
  assert.match(statements[0].sql, /close = excluded\.close/i);
  assert.match(statements[0].sql, /adj_close = excluded\.adj_close/i);
  assert.match(statements[0].sql, /volume = excluded\.volume/i);
  assert.match(statements[0].sql, /source = excluded\.source/i);
  assert.match(statements[0].sql, /updated_at = now\(\)/i);
  assert.deepEqual(statements[0].params, [
    'SPY', '2026-01-02', 580.12, 582.34, 579.56, 581.78, 581.65, 101234500,
    'SPY', '2026-01-05', 582.11, 583.45, 580.9, 581.33, 581.2, 99887766,
  ]);
  assert.deepEqual(statements[1].params, [
    'QQQ', '2026-01-05', 512.5, 515.25, 510.75, 514.8, 514.62, 45678901,
  ]);
});

test('upsertBenchmarkDailyPrices executes each chunked statement through the provided client', async () => {
  const rows = [
    {
      ticker: 'SPY',
      date: '2026-01-02',
      open: 580.12,
      high: 582.34,
      low: 579.56,
      close: 581.78,
      adj_close: 581.65,
      volume: 101234500,
    },
    {
      ticker: 'SPY',
      date: '2026-01-05',
      open: 582.11,
      high: 583.45,
      low: 580.9,
      close: 581.33,
      adj_close: 581.2,
      volume: 99887766,
    },
    {
      ticker: 'QQQ',
      date: '2026-01-05',
      open: 512.5,
      high: 515.25,
      low: 510.75,
      close: 514.8,
      adj_close: 514.62,
      volume: 45678901,
    },
  ];
  const clientCalls = [];
  const client = {
    query: async (sql, params) => {
      clientCalls.push({ sql, params });
      return { rowCount: 1 };
    },
  };

  const inserted = await upsertBenchmarkDailyPrices(client, rows, { batchSize: 2 });

  assert.equal(inserted, rows.length);
  assert.equal(clientCalls.length, 2);
  assert.deepEqual(
    clientCalls.map((call) => call.params),
    buildBenchmarkPriceUpsertStatements(rows, { batchSize: 2 }).map((statement) => statement.params)
  );
});
