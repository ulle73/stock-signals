import test from 'node:test';
import assert from 'node:assert/strict';
import { buildRydObvIndicatorRows } from '../lib/indicators/ryd-obv-zscore.js';

function buildIsoDates(count, startDate = '2026-01-01') {
  const start = new Date(`${startDate}T00:00:00Z`);
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(start);
    date.setUTCDate(start.getUTCDate() + index);
    return date.toISOString().slice(0, 10);
  });
}

test('buildRydObvIndicatorRows starts OBV at zero and uses adj_close before close for direction', () => {
  const rows = [
    { ticker: 'AAPL', date: '2026-01-01', close: '10', adj_close: null, volume: '100' },
    { ticker: 'AAPL', date: '2026-01-02', close: '12', adj_close: '8', volume: '200' },
    { ticker: 'AAPL', date: '2026-01-03', close: '7', adj_close: null, volume: '300' },
    { ticker: 'AAPL', date: '2026-01-04', close: '7', adj_close: null, volume: '400' },
  ];

  const indicatorRows = buildRydObvIndicatorRows(rows);

  assert.deepEqual(indicatorRows.map((row) => ({
    date: row.date,
    ryd_obv: row.ryd_obv,
    ryd_obv_zscore_80: row.ryd_obv_zscore_80,
    ryd_obv_signal: row.ryd_obv_signal,
  })), [
    {
      date: '2026-01-01',
      ryd_obv: 0,
      ryd_obv_zscore_80: null,
      ryd_obv_signal: 'none',
    },
    {
      date: '2026-01-02',
      ryd_obv: -200,
      ryd_obv_zscore_80: null,
      ryd_obv_signal: 'none',
    },
    {
      date: '2026-01-03',
      ryd_obv: -500,
      ryd_obv_zscore_80: null,
      ryd_obv_signal: 'none',
    },
    {
      date: '2026-01-04',
      ryd_obv: -500,
      ryd_obv_zscore_80: null,
      ryd_obv_signal: 'none',
    },
  ]);
});

test('buildRydObvIndicatorRows keeps z-score null until 80 OBV values exist', () => {
  const dates = buildIsoDates(80);
  const rows = dates.map((date, index) => ({
    ticker: 'AAPL',
    date,
    close: String(100 + index + 1),
    adj_close: null,
    volume: '1000',
  }));

  const indicatorRows = buildRydObvIndicatorRows(rows);

  assert.equal(indicatorRows[78].ryd_obv_zscore_80, null);
  assert.notEqual(indicatorRows[79].ryd_obv_zscore_80, null);
});

test('buildRydObvIndicatorRows returns null z-score when rolling OBV stdev is zero', () => {
  const dates = buildIsoDates(80);
  const rows = dates.map((date) => ({
    ticker: 'AAPL',
    date,
    close: '100',
    adj_close: null,
    volume: '1000',
  }));

  const indicatorRows = buildRydObvIndicatorRows(rows);
  const latestRow = indicatorRows.at(-1);

  assert.equal(latestRow.ryd_obv, 0);
  assert.equal(latestRow.ryd_obv_zscore_80, null);
  assert.equal(latestRow.ryd_obv_buy_signal, false);
  assert.equal(latestRow.ryd_obv_sell_signal, false);
});

test('buildRydObvIndicatorRows generates buy when z-score crosses above -2.7 and sell when it crosses below 2.7', () => {
  const dates = buildIsoDates(83);
  const closingSteps = [
    ...Array(78).fill(0),
    -1,
    1,
    1,
    -1,
  ];

  let close = 100;
  const rows = dates.map((date, index) => {
    if (index > 0) {
      close += closingSteps[index - 1];
    }

    return {
      ticker: 'AAPL',
      date,
      close: String(close),
      adj_close: null,
      volume: '1000',
    };
  });

  const indicatorRows = buildRydObvIndicatorRows(rows);
  const buyRow = indicatorRows[80];
  const preBuyRow = indicatorRows[79];
  const preSellRow = indicatorRows[81];
  const sellRow = indicatorRows[82];

  assert.ok(preBuyRow.ryd_obv_zscore_80 <= -2.7);
  assert.ok(buyRow.ryd_obv_zscore_80 > -2.7);
  assert.equal(buyRow.ryd_obv_buy_signal, true);
  assert.equal(buyRow.ryd_obv_sell_signal, false);
  assert.equal(buyRow.ryd_obv_signal, 'buy');

  assert.ok(preSellRow.ryd_obv_zscore_80 >= 2.7);
  assert.ok(sellRow.ryd_obv_zscore_80 < 2.7);
  assert.equal(sellRow.ryd_obv_buy_signal, false);
  assert.equal(sellRow.ryd_obv_sell_signal, true);
  assert.equal(sellRow.ryd_obv_signal, 'sell');
});
