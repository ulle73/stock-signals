import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildStockIntraday60mPriceUpsertStatements,
  upsertStockIntraday60mPrices,
} from '../lib/repositories/intraday-prices.js';

test('buildStockIntraday60mPriceUpsertStatements batches hourly rows with stable params', () => {
  const candles = [
    {
      candle_at: '2026-05-18T13:30:00.000Z',
      session_date: '2026-05-18',
      open: 210.12,
      high: 211.4,
      low: 209.9,
      close: 210.85,
      adj_close: 210.85,
      volume: 1455000,
    },
    {
      candle_at: '2026-05-18T14:30:00.000Z',
      session_date: '2026-05-18',
      open: 210.86,
      high: 212.1,
      low: 210.5,
      close: 211.92,
      adj_close: 211.92,
      volume: 1123400,
    },
    {
      candle_at: '2026-05-18T15:30:00.000Z',
      session_date: '2026-05-18',
      open: 211.9,
      high: 212.45,
      low: 211.2,
      close: 211.44,
      adj_close: 211.44,
      volume: 998877,
    },
  ];

  const statements = buildStockIntraday60mPriceUpsertStatements('AAPL', candles, 2);

  assert.equal(statements.length, 2);
  assert.match(statements[0].sql, /insert into stock_intraday_prices_60m/i);
  assert.match(statements[0].sql, /on conflict \(ticker, candle_at\) do update set/i);
  assert.deepEqual(statements[0].params, [
    'AAPL', '2026-05-18T13:30:00.000Z', '2026-05-18', 210.12, 211.4, 209.9, 210.85, 210.85, 1455000,
    'AAPL', '2026-05-18T14:30:00.000Z', '2026-05-18', 210.86, 212.1, 210.5, 211.92, 211.92, 1123400,
  ]);
  assert.deepEqual(statements[1].params, [
    'AAPL', '2026-05-18T15:30:00.000Z', '2026-05-18', 211.9, 212.45, 211.2, 211.44, 211.44, 998877,
  ]);
});

test('upsertStockIntraday60mPrices executes each chunked statement through the provided client', async () => {
  const candles = [
    {
      candle_at: '2026-05-18T13:30:00.000Z',
      session_date: '2026-05-18',
      open: 210.12,
      high: 211.4,
      low: 209.9,
      close: 210.85,
      adj_close: 210.85,
      volume: 1455000,
    },
    {
      candle_at: '2026-05-18T14:30:00.000Z',
      session_date: '2026-05-18',
      open: 210.86,
      high: 212.1,
      low: 210.5,
      close: 211.92,
      adj_close: 211.92,
      volume: 1123400,
    },
  ];
  const calls = [];
  const client = {
    query: async (sql, params) => {
      calls.push({ sql, params });
      return { rowCount: 1 };
    },
  };

  const inserted = await upsertStockIntraday60mPrices(client, 'AAPL', candles, 1);

  assert.equal(inserted, candles.length);
  assert.equal(calls.length, 2);
  assert.deepEqual(
    calls.map((call) => call.params),
    buildStockIntraday60mPriceUpsertStatements('AAPL', candles, 1).map((statement) => statement.params)
  );
});
