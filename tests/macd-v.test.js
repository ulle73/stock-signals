import test from 'node:test';
import assert from 'node:assert/strict';
import { buildMacdVIndicatorRows } from '../lib/indicators/macd-v.js';

function buildIsoDates(count, startDate = '2026-03-01') {
  const start = new Date(`${startDate}T00:00:00Z`);
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(start);
    date.setUTCDate(start.getUTCDate() + index);
    return date.toISOString().slice(0, 10);
  });
}

test('buildMacdVIndicatorRows warms up ATR26, turns active above 70, and deactivates on EMA crossunder', () => {
  let close = 100;
  const rows = buildIsoDates(80).map((date, index) => {
    close += index < 45 ? 3.2 : -4.5;
    return {
      ticker: 'AAPL',
      date,
      high: String(Number((close + 0.4).toFixed(2))),
      low: String(Number((close - 0.4).toFixed(2))),
      close: String(Number(close.toFixed(2))),
    };
  });

  const indicatorRows = buildMacdVIndicatorRows(rows);

  assert.equal(indicatorRows[24].macd_v, null);
  assert.notEqual(indicatorRows[25].macd_v, null);
  assert.equal(indicatorRows[25].macd_v_buy_signal, true);
  assert.equal(indicatorRows[25].macd_v_active, true);
  assert.equal(indicatorRows[25].macd_v_signal, 'buy');
  assert.equal(indicatorRows[56].macd_v_active, true);
  assert.equal(indicatorRows[57].macd_v_sell_signal, true);
  assert.equal(indicatorRows[57].macd_v_active, false);
  assert.equal(indicatorRows[57].macd_v_signal, 'sell');
});
