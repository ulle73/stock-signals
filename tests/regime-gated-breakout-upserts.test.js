import test from 'node:test';
import assert from 'node:assert/strict';
import { buildRegimeGatedBreakoutUpsertStatements } from '../lib/repositories/regime-gated-breakout.js';

test('buildRegimeGatedBreakoutUpsertStatements stores breakout decision rows with JSON metadata', () => {
  const rows = [
    {
      date: '2026-06-24',
      ticker: 'NVDA',
      company_name: 'NVIDIA Corporation',
      sector: 'Information Technology',
      market_signal: 'neutral',
      market_regime_score: 2,
      sector_signal: 'improving',
      breakout_20d_high: 150,
      indicator_price: 154,
      relative_volume20: 1.8,
      rs_63d_vs_spy: 18.25,
      rs_rank_63d: 24,
      rs_percentile_63d: 95.2,
      data_quality_status: 'warn',
      regime_confirmed: true,
      sector_confirmed: true,
      volume_confirmed: true,
      rs_confirmed: true,
      qualifies: true,
      decision: 'trigger',
      setup_score: 4,
      reason_summary: 'quality_warn:stock_daily_price_coverage|market_neutral|sector_improving|volume_confirmed|rs_confirmed',
      row_values: {
        warning_gate_keys: ['stock_daily_price_coverage'],
        earnings_filter_status: 'clear',
        earnings_reason: 'earnings_clear',
        earnings_date: '2026-07-30',
        days_to_earnings: 26,
      },
    },
  ];

  const statements = buildRegimeGatedBreakoutUpsertStatements(rows, 10);

  assert.equal(statements.length, 1);
  assert.match(statements[0].sql, /insert into regime_gated_breakout_daily/i);
  assert.match(statements[0].sql, /on conflict \(date, ticker\) do update set/i);
  assert.deepEqual(statements[0].params, [
    '2026-06-24',
    'NVDA',
    'NVIDIA Corporation',
    'Information Technology',
    'neutral',
    '2',
    'improving',
    '150',
    '154',
    '1.8',
    '18.25',
    24,
    '95.2',
    'warn',
    true,
    true,
    true,
    true,
    true,
    'trigger',
    4,
    'quality_warn:stock_daily_price_coverage|market_neutral|sector_improving|volume_confirmed|rs_confirmed',
    JSON.stringify({
      warning_gate_keys: ['stock_daily_price_coverage'],
      earnings_filter_status: 'clear',
      earnings_reason: 'earnings_clear',
      earnings_date: '2026-07-30',
      days_to_earnings: 26,
    }),
  ]);
});
