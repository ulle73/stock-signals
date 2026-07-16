import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeChartRows } from '../lib/chart/normalize-chart-data.js';

const company = { ticker: 'AAPL', company_name: 'Apple Inc.', sector: 'Information Technology' };

function baseRow(overrides = {}) {
  return {
    date: '2026-07-10', open: '210', high: '215', low: '209', close: '214',
    adj_close: '214', volume: '11', ...overrides,
  };
}

test('normalizeChartRows sorts ascending and keeps the last duplicate date', () => {
  const payload = normalizeChartRows({
    ticker: 'AAPL', company, period: '1Y',
    rows: [
      baseRow({ close: '213', adj_close: '213', high: '214', volume: '10', sma20: '205' }),
      { date: '2026-07-09', open: '208', high: '211', low: '207', close: '210', adj_close: '210', volume: '9', sma20: null },
      baseRow({ sma20: '206' }),
    ],
  });
  assert.deepEqual(payload.bars, [
    { time: '2026-07-09', open: 208, high: 211, low: 207, close: 210, volume: 9 },
    { time: '2026-07-10', open: 210, high: 215, low: 209, close: 214, volume: 11, sma20: 206 },
  ]);
  assert.equal(payload.latestDate, '2026-07-10');
  assert.equal(payload.dailyChangePct, 1.9048);
});

test('normalizeChartRows adjusts all OHLC values to the adjusted-close scale', () => {
  const payload = normalizeChartRows({
    ticker: 'AAPL', company, period: 'ALL',
    rows: [{ date: '2020-08-31', open: '500', high: '520', low: '480', close: '500', adj_close: '125', volume: '100', sma20: '120' }],
  });
  assert.deepEqual(payload.bars[0], {
    time: '2020-08-31', open: 125, high: 130, low: 120, close: 125, volume: 100, sma20: 120,
  });
});

test('normalizeChartRows rejects invalid OHLC rows but preserves zero and optional MA gaps', () => {
  const payload = normalizeChartRows({
    ticker: 'AAPL', company, period: '3M',
    rows: [
      { date: '2026-07-08', open: '0', high: '1', low: '0', close: '0.5', adj_close: '0.5', volume: '-2', sma5: '' },
      { date: '2026-07-09', open: 'bad', high: '2', low: '1', close: '1.5', adj_close: '1.5', volume: '5' },
      { date: 'invalid', open: '1', high: '2', low: '0', close: '1', adj_close: '1', volume: '5' },
    ],
  });
  assert.deepEqual(payload.bars, [{ time: '2026-07-08', open: 0, high: 1, low: 0, close: 0.5, volume: 0 }]);
});

test('normalizeChartRows preserves stored RYD OBV values and warmup gaps', () => {
  const payload = normalizeChartRows({
    ticker: 'AAPL', company, period: '1Y',
    rows: [
      { date: '2026-07-09', open: '208', high: '211', low: '207', close: '210', adj_close: '210', volume: '9', ryd_obv: '1000000', ryd_obv_zscore_80: null, ryd_obv_buy_signal: false, ryd_obv_sell_signal: false, ryd_obv_signal: 'none' },
      baseRow({ ryd_obv: '1250000.5', ryd_obv_zscore_80: '-2.6', ryd_obv_buy_signal: true, ryd_obv_sell_signal: false, ryd_obv_signal: 'buy' }),
    ],
  });
  assert.equal(payload.bars[0].ryd_obv, 1000000);
  assert.equal(payload.bars[0].ryd_obv_zscore_80, undefined);
  assert.equal(payload.bars[1].ryd_obv_zscore_80, -2.6);
  assert.equal(payload.bars[1].ryd_obv_signal, 'buy');
});

test('normalizeChartRows preserves stored TF Sync states and sanitizes unknown labels', () => {
  const payload = normalizeChartRows({
    ticker: 'AAPL', company, period: '1Y',
    rows: [
      baseRow({ tf_sync_buy_signal: 'true', tf_sync_sell_signal: false, tf_sync_buy_active: 1, tf_sync_sell_active: 0, tf_sync_signal: 'buy' }),
      { date: '2026-07-11', open: '214', high: '216', low: '212', close: '215', adj_close: '215', volume: '12', tf_sync_buy_signal: false, tf_sync_sell_signal: true, tf_sync_buy_active: false, tf_sync_sell_active: true, tf_sync_signal: 'unexpected' },
    ],
  });
  assert.equal(payload.bars[0].tf_sync_buy_signal, true);
  assert.equal(payload.bars[0].tf_sync_signal, 'buy');
  assert.equal(payload.bars[1].tf_sync_sell_signal, true);
  assert.equal(payload.bars[1].tf_sync_signal, 'none');
});

test('normalizeChartRows preserves PLCE threshold values and stored signal booleans', () => {
  const payload = normalizeChartRows({
    ticker: 'AAPL', company, period: '1Y',
    rows: [baseRow({
      plce_threshold_value: '3123456.75',
      plce_threshold_buy_signal: 'true',
      plce_threshold_signal: 'buy',
    })],
  });
  assert.equal(payload.bars[0].plce_threshold_value, 3123456.75);
  assert.equal(payload.bars[0].plce_threshold_buy_signal, true);
  assert.equal(payload.bars[0].plce_threshold_signal, 'buy');
});

test('normalizeChartRows returns an explicit empty payload', () => {
  assert.deepEqual(normalizeChartRows({ ticker: 'AAPL', company: null, period: '1Y', rows: [] }), {
    ticker: 'AAPL', companyName: 'AAPL', sector: null, currency: 'USD', period: '1Y', latestDate: null,
    latestPrice: null, previousClose: null, dailyChange: null, dailyChangePct: null, bars: [],
  });
});
