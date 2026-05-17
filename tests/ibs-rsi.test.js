import test from 'node:test';
import assert from 'node:assert/strict';
import { buildIbsRsiIndicatorRows } from '../lib/indicators/ibs-rsi.js';

function buildIsoDates(count, startDate = '2026-02-01') {
  const start = new Date(`${startDate}T00:00:00Z`);
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(start);
    date.setUTCDate(start.getUTCDate() + index);
    return date.toISOString().slice(0, 10);
  });
}

test('buildIbsRsiIndicatorRows generates a buy signal when IBS is below 20 and RSI14 is below 30', () => {
  const rows = buildIsoDates(20).map((date, index) => {
    const close = 100 - index;
    return {
      ticker: 'AAPL',
      date,
      open: String(close + 0.8),
      high: String(close + 2),
      low: String(close - 0.1),
      close: String(close),
    };
  });

  const indicatorRows = buildIbsRsiIndicatorRows(rows);
  const latestRow = indicatorRows.at(-1);

  assert.ok(latestRow.ibs_value < 20);
  assert.ok(latestRow.rsi14 < 30);
  assert.equal(latestRow.ibs_rsi_buy_signal, true);
  assert.equal(latestRow.ibs_rsi_signal, 'buy');
});

test('buildIbsRsiIndicatorRows leaves IBS null when the candle range is zero', () => {
  const rows = buildIsoDates(16).map((date, index) => ({
    ticker: 'AAPL',
    date,
    open: String(100 - index),
    high: '50',
    low: '50',
    close: '50',
  }));

  const indicatorRows = buildIbsRsiIndicatorRows(rows);
  const latestRow = indicatorRows.at(-1);

  assert.equal(latestRow.ibs_value, null);
  assert.equal(latestRow.ibs_rsi_buy_signal, false);
  assert.equal(latestRow.ibs_rsi_signal, 'none');
});
