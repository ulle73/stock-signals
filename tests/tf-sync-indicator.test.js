import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTfSyncIndicatorRows } from '../lib/indicators/tf-sync.js';

test('buildTfSyncIndicatorRows derives daily, weekly and latest 60m color states and persists active bias until opposite trigger', () => {
  const rows = [
    {
      ticker: 'AAPL',
      date: '2026-05-04',
      daily_open: '100',
      daily_close: '103',
      intraday_60m_candle_at: '2026-05-04T19:30:00.000Z',
      intraday_open: '102',
      intraday_close: '103',
    },
    {
      ticker: 'AAPL',
      date: '2026-05-05',
      daily_open: '103',
      daily_close: '105',
      intraday_60m_candle_at: '2026-05-05T19:30:00.000Z',
      intraday_open: '104',
      intraday_close: '105',
    },
    {
      ticker: 'AAPL',
      date: '2026-05-06',
      daily_open: '105',
      daily_close: '101',
      intraday_60m_candle_at: '2026-05-06T19:30:00.000Z',
      intraday_open: '102',
      intraday_close: '101',
    },
    {
      ticker: 'AAPL',
      date: '2026-05-07',
      daily_open: '101',
      daily_close: '99',
      intraday_60m_candle_at: '2026-05-07T19:30:00.000Z',
      intraday_open: '100',
      intraday_close: '99',
    },
    {
      ticker: 'AAPL',
      date: '2026-05-08',
      daily_open: '99',
      daily_close: '98',
      intraday_60m_candle_at: '2026-05-08T19:30:00.000Z',
      intraday_open: '99',
      intraday_close: '98',
    },
  ];

  const indicatorRows = buildTfSyncIndicatorRows(rows);

  assert.deepEqual(
    indicatorRows.map((row) => ({
      date: row.date,
      tf_sync_daily_green: row.tf_sync_daily_green,
      tf_sync_weekly_green: row.tf_sync_weekly_green,
      tf_sync_intraday_green: row.tf_sync_intraday_green,
      tf_sync_buy_condition: row.tf_sync_buy_condition,
      tf_sync_sell_condition: row.tf_sync_sell_condition,
      tf_sync_buy_signal: row.tf_sync_buy_signal,
      tf_sync_sell_signal: row.tf_sync_sell_signal,
      tf_sync_buy_active: row.tf_sync_buy_active,
      tf_sync_sell_active: row.tf_sync_sell_active,
      tf_sync_signal: row.tf_sync_signal,
    })),
    [
      {
        date: '2026-05-04',
        tf_sync_daily_green: true,
        tf_sync_weekly_green: true,
        tf_sync_intraday_green: true,
        tf_sync_buy_condition: true,
        tf_sync_sell_condition: false,
        tf_sync_buy_signal: true,
        tf_sync_sell_signal: false,
        tf_sync_buy_active: true,
        tf_sync_sell_active: false,
        tf_sync_signal: 'buy',
      },
      {
        date: '2026-05-05',
        tf_sync_daily_green: true,
        tf_sync_weekly_green: true,
        tf_sync_intraday_green: true,
        tf_sync_buy_condition: true,
        tf_sync_sell_condition: false,
        tf_sync_buy_signal: false,
        tf_sync_sell_signal: false,
        tf_sync_buy_active: true,
        tf_sync_sell_active: false,
        tf_sync_signal: 'buy_active',
      },
      {
        date: '2026-05-06',
        tf_sync_daily_green: false,
        tf_sync_weekly_green: true,
        tf_sync_intraday_green: false,
        tf_sync_buy_condition: false,
        tf_sync_sell_condition: false,
        tf_sync_buy_signal: false,
        tf_sync_sell_signal: false,
        tf_sync_buy_active: true,
        tf_sync_sell_active: false,
        tf_sync_signal: 'buy_active',
      },
      {
        date: '2026-05-07',
        tf_sync_daily_green: false,
        tf_sync_weekly_green: false,
        tf_sync_intraday_green: false,
        tf_sync_buy_condition: false,
        tf_sync_sell_condition: true,
        tf_sync_buy_signal: false,
        tf_sync_sell_signal: true,
        tf_sync_buy_active: false,
        tf_sync_sell_active: true,
        tf_sync_signal: 'sell',
      },
      {
        date: '2026-05-08',
        tf_sync_daily_green: false,
        tf_sync_weekly_green: false,
        tf_sync_intraday_green: false,
        tf_sync_buy_condition: false,
        tf_sync_sell_condition: true,
        tf_sync_buy_signal: false,
        tf_sync_sell_signal: false,
        tf_sync_buy_active: false,
        tf_sync_sell_active: true,
        tf_sync_signal: 'sell_active',
      },
    ]
  );
});

test('buildTfSyncIndicatorRows skips output rows until a latest 60m candle exists but still uses earlier daily rows for weekly context', () => {
  const rows = [
    {
      ticker: 'MSFT',
      date: '2026-05-04',
      daily_open: '200',
      daily_close: '198',
      intraday_60m_candle_at: null,
      intraday_open: null,
      intraday_close: null,
    },
    {
      ticker: 'MSFT',
      date: '2026-05-05',
      daily_open: '198',
      daily_close: '199',
      intraday_60m_candle_at: '2026-05-05T19:30:00.000Z',
      intraday_open: '198.5',
      intraday_close: '199',
    },
  ];

  const indicatorRows = buildTfSyncIndicatorRows(rows);

  assert.equal(indicatorRows.length, 1);
  assert.equal(indicatorRows[0].date, '2026-05-05');
  assert.equal(indicatorRows[0].tf_sync_weekly_open, 200);
  assert.equal(indicatorRows[0].tf_sync_weekly_close, 199);
  assert.equal(indicatorRows[0].tf_sync_buy_condition, false);
  assert.equal(indicatorRows[0].tf_sync_sell_condition, false);
  assert.equal(indicatorRows[0].tf_sync_signal, 'none');
});
