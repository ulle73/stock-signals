import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSignalDataQualityUpsertStatements } from '../lib/repositories/signal-data-quality.js';

test('buildSignalDataQualityUpsertStatements stores generic gate payloads with date + gate key upserts', () => {
  const rows = [
    {
      date: '2026-06-24',
      gate_key: 'stock_daily_prices_freshness',
      status: 'pass',
      reason_code: 'current',
      summary: 'Stock daily prices are current for 2026-06-24.',
      details: {
        expected_date: '2026-06-24',
        latest_date: '2026-06-24',
        stale_by_market_days: 0,
      },
    },
    {
      date: '2026-06-24',
      gate_key: 'occ_volume_totals_freshness',
      status: 'warn',
      reason_code: 'stale_warn',
      summary: 'OCC daily volume totals are stale by 1 US market day for expected date 2026-06-24.',
      details: {
        expected_date: '2026-06-24',
        latest_date: '2026-06-23',
        stale_by_market_days: 1,
      },
    },
  ];

  const statements = buildSignalDataQualityUpsertStatements(rows, 2);

  assert.equal(statements.length, 1);
  assert.match(statements[0].sql, /insert into signal_data_quality_daily/i);
  assert.match(statements[0].sql, /on conflict \(date, gate_key\) do update set/i);
  assert.deepEqual(statements[0].params, [
    '2026-06-24',
    'stock_daily_prices_freshness',
    'pass',
    'current',
    'Stock daily prices are current for 2026-06-24.',
    JSON.stringify({
      expected_date: '2026-06-24',
      latest_date: '2026-06-24',
      stale_by_market_days: 0,
    }),
    '2026-06-24',
    'occ_volume_totals_freshness',
    'warn',
    'stale_warn',
    'OCC daily volume totals are stale by 1 US market day for expected date 2026-06-24.',
    JSON.stringify({
      expected_date: '2026-06-24',
      latest_date: '2026-06-23',
      stale_by_market_days: 1,
    }),
  ]);
});
