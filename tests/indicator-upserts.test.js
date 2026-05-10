import test from 'node:test';
import assert from 'node:assert/strict';
import { buildStockDailyIndicatorUpsertStatements } from '../lib/repositories/indicators.js';

test('buildStockDailyIndicatorUpsertStatements batches multiple indicator rows into one statement', () => {
  const rows = [
    {
      ticker: 'AAPL',
      date: '2026-01-01',
      indicator_price: 101.25,
      daily_return_pct: null,
      avg_volume20: null,
      relative_volume20: null,
      volume_z20: null,
      trend_20d_pct: null,
      range_pct: null,
      body_pct: null,
      pct_from_52w_high: null,
      pct_from_52w_low: null,
      sma5: null,
      sma10: null,
      sma20: null,
      sma50: null,
      sma200: null,
      ryd_obv: 0,
      ryd_obv_zscore_80: null,
      ryd_obv_buy_signal: false,
      ryd_obv_sell_signal: false,
      volume_event: 'normal',
      volume_event_tone: 'neutral',
      ryd_obv_signal: 'none',
    },
    {
      ticker: 'AAPL',
      date: '2026-01-02',
      indicator_price: 102.5,
      daily_return_pct: 1.23,
      avg_volume20: 5000000,
      relative_volume20: 1.15,
      volume_z20: 0.75,
      trend_20d_pct: 4.4,
      range_pct: 2.2,
      body_pct: 1.1,
      pct_from_52w_high: -2.5,
      pct_from_52w_low: 18.8,
      sma5: '99.5',
      sma10: '98.1',
      sma20: 100.1,
      sma50: null,
      sma200: null,
      ryd_obv: 5000000,
      ryd_obv_zscore_80: 2.812345,
      ryd_obv_buy_signal: true,
      ryd_obv_sell_signal: false,
      volume_event: 'accumulation',
      volume_event_tone: 'positive',
      ryd_obv_signal: 'buy',
    },
    {
      ticker: 'AAPL',
      date: '2026-01-03',
      indicator_price: 103.75,
      daily_return_pct: -0.45,
      avg_volume20: 5100000,
      relative_volume20: 0.92,
      volume_z20: -0.25,
      trend_20d_pct: -3.1,
      range_pct: 1.4,
      body_pct: 0.8,
      pct_from_52w_high: -1.25,
      pct_from_52w_low: 20.1,
      sma5: '100.2',
      sma10: '99.7',
      sma20: 101.4,
      sma50: null,
      sma200: null,
      ryd_obv: 4200000,
      ryd_obv_zscore_80: 2.612345,
      ryd_obv_buy_signal: false,
      ryd_obv_sell_signal: true,
      volume_event: 'distribution',
      volume_event_tone: 'danger',
      ryd_obv_signal: 'sell',
    },
  ];

  const statements = buildStockDailyIndicatorUpsertStatements(rows, 2);

  assert.equal(statements.length, 2);
  assert.match(statements[0].sql, /insert into stock_daily_indicators/i);
  assert.match(statements[0].sql, /volume_event/i);
  assert.match(statements[0].sql, /volume_event_tone/i);
  assert.deepEqual(statements[0].params, [
    'AAPL', '2026-01-01', '101.25', null, null, null, null, null, null, null, null, null, null, null, null, null, null, '0', null, 'adj_close_or_close', false, false, 'normal', 'neutral', 'none',
    'AAPL', '2026-01-02', '102.5', '1.23', '5000000', '1.15', '0.75', '4.4', '2.2', '1.1', '-2.5', '18.8', '99.5', '98.1', '100.1', null, null, '5000000', '2.812345', 'adj_close_or_close', true, false, 'accumulation', 'positive', 'buy',
  ]);
  assert.deepEqual(statements[1].params, [
    'AAPL', '2026-01-03', '103.75', '-0.45', '5100000', '0.92', '-0.25', '-3.1', '1.4', '0.8', '-1.25', '20.1', '100.2', '99.7', '101.4', null, null, '4200000', '2.612345', 'adj_close_or_close', false, true, 'distribution', 'danger', 'sell',
  ]);
});
