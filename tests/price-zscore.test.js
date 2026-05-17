import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPriceZscoreIndicatorRows } from '../lib/indicators/price-zscore.js';

function buildIsoDates(count, startDate = '2026-01-01') {
  const start = new Date(`${startDate}T00:00:00Z`);
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(start);
    date.setUTCDate(start.getUTCDate() + index);
    return date.toISOString().slice(0, 10);
  });
}

test('buildPriceZscoreIndicatorRows keeps z-score warming up before z-score average exists', () => {
  const dates = buildIsoDates(39);
  const rows = dates.map((date, index) => ({
    ticker: 'AAPL',
    date,
    close: String(100 + index),
    adj_close: null,
  }));

  const indicatorRows = buildPriceZscoreIndicatorRows(rows);

  assert.equal(indicatorRows[18].price_zscore_20, null);
  assert.notEqual(indicatorRows[19].price_zscore_20, null);
  assert.equal(indicatorRows[37].price_zscore_avg_20, null);
  assert.notEqual(indicatorRows[38].price_zscore_avg_20, null);
});

test('buildPriceZscoreIndicatorRows generates buy when z-score crosses above its 20-day average below -1', () => {
  const prices = [
    100, 99.06, 97.83, 96.97, 95.68, 94.74, 93.15, 91.72, 90.42, 89.35,
    88.07, 87.19, 86.25, 85.44, 84.43, 82.88, 81.5, 80.68, 79.22, 77.66,
    76.6, 75.48, 74.64, 73.28, 71.78, 70.85, 69.51, 68.52, 67.62, 66.04,
    64.87, 63.37, 62.28, 61.18, 60.25, 59.38, 58.54, 56.96, 55.95, 54.93,
    53.48, 52.27, 51.32, 50.05, 48.57, 51.19, 54.25, 56.68, 59.83, 62.73,
    65.65, 68.8, 71.36, 73.88, 76.77, 79.3, 82.34, 85.4, 88.19, 90.84,
  ];

  const rows = buildIsoDates(prices.length).map((date, index) => ({
    ticker: 'AAPL',
    date,
    close: String(prices[index]),
    adj_close: null,
  }));

  const indicatorRows = buildPriceZscoreIndicatorRows(rows);
  const signalRow = indicatorRows[42];

  assert.ok(signalRow.price_zscore_avg_20 < -1);
  assert.equal(signalRow.price_zscore_buy_signal, true);
  assert.equal(signalRow.price_zscore_sell_signal, false);
  assert.equal(signalRow.price_zscore_signal, 'buy');
});

test('buildPriceZscoreIndicatorRows generates sell when z-score crosses below its 20-day average above 1.4', () => {
  const prices = [
    100, 101.06, 102.54, 103.57, 104.88, 106.09, 107.59, 109.13, 110.19, 111.58,
    112.68, 114.19, 115.12, 116.39, 117.53, 118.75, 120.07, 121.11, 122.53, 123.35,
    124.59, 126.18, 127.13, 128.63, 129.96, 130.99, 132.14, 133.13, 134.62, 135.59,
    136.77, 137.87, 139.12, 140.27, 141.32, 142.41, 143.77, 145.29, 146.65, 147.65,
    148.91, 149.92, 151.29, 152.87, 154.39, 151.24, 148.39, 145.78, 143.12, 140.7,
    137.94, 134.84, 132.25, 129.75, 127.24, 124.48, 121.47, 118.35, 115.73, 113.01,
  ];

  const rows = buildIsoDates(prices.length).map((date, index) => ({
    ticker: 'AAPL',
    date,
    close: String(prices[index]),
    adj_close: null,
  }));

  const indicatorRows = buildPriceZscoreIndicatorRows(rows);
  const signalRow = indicatorRows[45];

  assert.ok(signalRow.price_zscore_avg_20 > 1.4);
  assert.equal(signalRow.price_zscore_buy_signal, false);
  assert.equal(signalRow.price_zscore_sell_signal, true);
  assert.equal(signalRow.price_zscore_signal, 'sell');
});
