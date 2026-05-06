import test from 'node:test';
import assert from 'node:assert/strict';
import { buildMarketSignalRowsFromSources } from '../lib/utils/divergence-signals.js';

test('buildMarketSignalRowsFromSources aligns breadth and market series, skips invalid dates, and calculates signal rows', () => {
  const breadthRows = [
    {
      date: '2026-01-01',
      pct_above_sma50: 60,
      pct_above_sma200: 55,
      advancers: 8,
      decliners: 7,
      new_highs_52w: 10,
      new_lows_52w: 2,
      is_valid_signal_date: true,
    },
    {
      date: '2026-01-02',
      pct_above_sma50: 59,
      pct_above_sma200: 54.5,
      advancers: 8,
      decliners: 7,
      new_highs_52w: 9,
      new_lows_52w: 3,
      is_valid_signal_date: false,
    },
    {
      date: '2026-01-03',
      pct_above_sma50: 58,
      pct_above_sma200: 54,
      advancers: 7,
      decliners: 8,
      new_highs_52w: 9,
      new_lows_52w: 3,
      is_valid_signal_date: true,
    },
    {
      date: '2026-01-04',
      pct_above_sma50: 50,
      pct_above_sma200: 49,
      advancers: 4,
      decliners: 11,
      new_highs_52w: 4,
      new_lows_52w: 8,
      is_valid_signal_date: true,
    },
  ];
  const spxRows = [
    { date: '2026-01-01', value: 100 },
    { date: '2026-01-03', value: 102 },
    { date: '2026-01-04', value: 104 },
  ];
  const vixRows = [
    { date: '2026-01-01', value: 16 },
    { date: '2026-01-03', value: 17 },
    { date: '2026-01-04', value: 20 },
  ];

  const signalRows = buildMarketSignalRowsFromSources(
    {
      breadthRows,
      spxRows,
      vixRows,
    },
    {
      shortWindow: 1,
      longWindow: 2,
    }
  );

  assert.equal(signalRows.length, 3);
  assert.deepEqual(
    signalRows.map((row) => row.date),
    ['2026-01-01', '2026-01-03', '2026-01-04']
  );

  const latest = signalRows.at(-1);
  assert.equal(latest.spx_close, 104);
  assert.equal(latest.spx_3d_change, 1.960784);
  assert.equal(latest.spx_14d_change, 4);
  assert.equal(latest.pct_above_50_14d_change, -10);
  assert.equal(latest.pct_above_200_14d_change, -6);
  assert.equal(latest.ad_line, -7);
  assert.equal(latest.ad_line_14d_change, -8);
  assert.equal(latest.divergence_status, 'bearish_warning_strong');
  assert.equal(latest.short_divergence_status, 'short_negative');
  assert.equal(latest.market_regime_score, -3.5);
  assert.equal(latest.signal, 'risk_off');
});
