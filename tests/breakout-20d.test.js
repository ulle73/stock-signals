import test from 'node:test';
import assert from 'node:assert/strict';
import { buildBreakout20dIndicatorRows } from '../lib/indicators/breakout-20d.js';

function buildIsoDates(count, startDate = '2026-04-01') {
  const start = new Date(`${startDate}T00:00:00Z`);
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(start);
    date.setUTCDate(start.getUTCDate() + index);
    return date.toISOString().slice(0, 10);
  });
}

test('buildBreakout20dIndicatorRows generates buy on 20-day high break and sell on 20-day low break', () => {
  const prices = [
    100, 101, 102, 103, 104, 105, 106, 107, 108, 109,
    110, 111, 112, 113, 114, 115, 116, 117, 118, 119,
    118, 117, 116, 115, 114, 120, 121, 122, 123, 124,
    123, 122, 121, 120, 119, 118, 117, 116, 115, 114,
    113, 112, 111, 110, 109, 108, 107, 106, 105, 104,
  ];

  const rows = buildIsoDates(prices.length).map((date, index) => ({
    ticker: 'AAPL',
    date,
    close: String(prices[index]),
    adj_close: null,
  }));

  const indicatorRows = buildBreakout20dIndicatorRows(rows);
  const buyRow = indicatorRows[25];
  const sellRow = indicatorRows[39];

  assert.equal(buyRow.breakout_20d_high, 119);
  assert.equal(buyRow.breakout_20d_buy_signal, true);
  assert.equal(buyRow.breakout_20d_sell_signal, false);
  assert.equal(buyRow.breakout_20d_signal, 'buy');

  assert.equal(sellRow.breakout_20d_low, 115);
  assert.equal(sellRow.breakout_20d_buy_signal, false);
  assert.equal(sellRow.breakout_20d_sell_signal, true);
  assert.equal(sellRow.breakout_20d_signal, 'sell');
});
