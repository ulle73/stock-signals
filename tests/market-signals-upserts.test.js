import test from 'node:test';
import assert from 'node:assert/strict';
import { buildMarketSignalUpsertStatements } from '../lib/repositories/market-signals.js';

test('buildMarketSignalUpsertStatements batches market signal rows into one statement', () => {
  const rows = [
    {
      date: '2026-01-14',
      spx_close: 113,
      spx_3d_change: 2,
      spx_14d_change: null,
      pct_above_50: 57,
      pct_above_50_3d_change: -3,
      pct_above_50_14d_change: null,
      pct_above_200: 53.5,
      pct_above_200_14d_change: null,
      ad_line: 14,
      ad_line_14d_change: null,
      new_highs: 7,
      new_lows: 13,
      vix: 16.6,
      market_regime_score: null,
      signal: null,
      divergence_status: 'none',
      short_divergence_status: 'short_negative',
    },
    {
      date: '2026-01-15',
      spx_close: 114,
      spx_3d_change: 2.702703,
      spx_14d_change: 14,
      pct_above_50: 56,
      pct_above_50_3d_change: -3,
      pct_above_50_14d_change: -14,
      pct_above_200: 53,
      pct_above_200_14d_change: -7,
      ad_line: 5,
      ad_line_14d_change: 4,
      new_highs: 4,
      new_lows: 14,
      vix: 22,
      market_regime_score: null,
      signal: null,
      divergence_status: 'bearish_warning_strong',
      short_divergence_status: 'short_negative',
    },
  ];

  const statements = buildMarketSignalUpsertStatements(rows, 2);

  assert.equal(statements.length, 1);
  assert.match(statements[0].sql, /insert into market_signal_daily/i);
  assert.match(statements[0].sql, /on conflict \(date\) do update set/i);
  assert.deepEqual(statements[0].params, [
    '2026-01-14', '113', '2', null, '57', '-3', null, '53.5', null, '14', null, 7, 13, '16.6', null, null, 'none', 'short_negative',
    '2026-01-15', '114', '2.702703', '14', '56', '-3', '-14', '53', '-7', '5', '4', 4, 14, '22', null, null, 'bearish_warning_strong', 'short_negative',
  ]);
});
