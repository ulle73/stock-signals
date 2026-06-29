import test from 'node:test';
import assert from 'node:assert/strict';
import { buildStockEarningsCalendarUpsertStatements } from '../lib/repositories/stock-earnings-calendar.js';

test('buildStockEarningsCalendarUpsertStatements stores snapshot earnings rows with JSON details', () => {
  const rows = [
    {
      date: '2026-06-26',
      ticker: 'AAPL',
      yahoo_ticker: 'AAPL',
      company_name: 'Apple Inc.',
      earnings_date: '2026-07-30',
      confirmed: false,
      source: 'yahoo_quote_page',
      source_status: 'active',
      source_url: 'https://finance.yahoo.com/quote/AAPL/',
      details: {
        is_earnings_date_estimate: true,
      },
    },
  ];

  const statements = buildStockEarningsCalendarUpsertStatements(rows, 10);

  assert.equal(statements.length, 1);
  assert.match(statements[0].sql, /insert into stock_earnings_calendar_daily/i);
  assert.match(statements[0].sql, /on conflict \(date, ticker\) do update set/i);
  assert.deepEqual(statements[0].params, [
    '2026-06-26',
    'AAPL',
    'AAPL',
    'Apple Inc.',
    '2026-07-30',
    false,
    'yahoo_quote_page',
    'active',
    'https://finance.yahoo.com/quote/AAPL/',
    JSON.stringify({
      is_earnings_date_estimate: true,
    }),
  ]);
});
