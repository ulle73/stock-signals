import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildTfSyncIndicatorUpsertStatements,
  upsertTfSyncIndicatorRows,
} from '../lib/repositories/tf-sync-indicator.js';

test('buildTfSyncIndicatorUpsertStatements stores TF Sync daily rows with raw state fields', () => {
  const rows = [
    {
      ticker: 'AAPL',
      date: '2026-05-08',
      intraday_60m_candle_at: '2026-05-08T19:30:00.000Z',
      tf_sync_weekly_open: 100,
      tf_sync_weekly_close: 98,
      tf_sync_daily_green: false,
      tf_sync_daily_red: true,
      tf_sync_weekly_green: false,
      tf_sync_weekly_red: true,
      tf_sync_intraday_green: false,
      tf_sync_intraday_red: true,
      tf_sync_buy_condition: false,
      tf_sync_sell_condition: true,
      tf_sync_buy_signal: false,
      tf_sync_sell_signal: false,
      tf_sync_buy_active: false,
      tf_sync_sell_active: true,
      tf_sync_signal: 'sell_active',
    },
  ];

  const statements = buildTfSyncIndicatorUpsertStatements(rows, 10);

  assert.equal(statements.length, 1);
  assert.match(statements[0].sql, /insert into tf_sync_indicator_daily/i);
  assert.match(statements[0].sql, /on conflict \(ticker, date\) do update set/i);
  assert.deepEqual(statements[0].params, [
    'AAPL',
    '2026-05-08',
    '2026-05-08T19:30:00.000Z',
    '100',
    '98',
    false,
    true,
    false,
    true,
    false,
    true,
    false,
    true,
    false,
    false,
    false,
    true,
    'sell_active',
  ]);
});

test('upsertTfSyncIndicatorRows executes each TF Sync statement through the provided client', async () => {
  const rows = [
    {
      ticker: 'AAPL',
      date: '2026-05-07',
      intraday_60m_candle_at: '2026-05-07T19:30:00.000Z',
      tf_sync_weekly_open: 100,
      tf_sync_weekly_close: 99,
      tf_sync_daily_green: false,
      tf_sync_daily_red: true,
      tf_sync_weekly_green: false,
      tf_sync_weekly_red: true,
      tf_sync_intraday_green: false,
      tf_sync_intraday_red: true,
      tf_sync_buy_condition: false,
      tf_sync_sell_condition: true,
      tf_sync_buy_signal: false,
      tf_sync_sell_signal: true,
      tf_sync_buy_active: false,
      tf_sync_sell_active: true,
      tf_sync_signal: 'sell',
    },
    {
      ticker: 'AAPL',
      date: '2026-05-08',
      intraday_60m_candle_at: '2026-05-08T19:30:00.000Z',
      tf_sync_weekly_open: 100,
      tf_sync_weekly_close: 98,
      tf_sync_daily_green: false,
      tf_sync_daily_red: true,
      tf_sync_weekly_green: false,
      tf_sync_weekly_red: true,
      tf_sync_intraday_green: false,
      tf_sync_intraday_red: true,
      tf_sync_buy_condition: false,
      tf_sync_sell_condition: true,
      tf_sync_buy_signal: false,
      tf_sync_sell_signal: false,
      tf_sync_buy_active: false,
      tf_sync_sell_active: true,
      tf_sync_signal: 'sell_active',
    },
  ];
  const calls = [];
  const client = {
    query: async (sql, params) => {
      calls.push({ sql, params });
      return { rowCount: 1 };
    },
  };

  const inserted = await upsertTfSyncIndicatorRows(client, rows, 1);

  assert.equal(inserted, rows.length);
  assert.equal(calls.length, 2);
  assert.deepEqual(
    calls.map((call) => call.params),
    buildTfSyncIndicatorUpsertStatements(rows, 1).map((statement) => statement.params)
  );
});
