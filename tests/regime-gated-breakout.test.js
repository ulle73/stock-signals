import test from 'node:test';
import assert from 'node:assert/strict';
import { buildRegimeGatedBreakoutRowsFromSources } from '../lib/utils/regime-gated-breakout.js';

function buildQualityGateRows(date, statuses) {
  return Object.entries(statuses).map(([gate_key, status]) => ({ date, gate_key, status }));
}

test('buildRegimeGatedBreakoutRowsFromSources allows warning-quality breakouts when all setup gates confirm', () => {
  const rows = buildRegimeGatedBreakoutRowsFromSources({
    breakoutRows: [
      {
        date: '2026-06-24',
        ticker: 'NVDA',
        company_name: 'NVIDIA Corporation',
        sector: 'Information Technology',
        breakout_20d_high: '150',
        indicator_price: '154',
        relative_volume20: '1.8',
      },
    ],
    marketSignalRows: [
      { date: '2026-06-24', signal: 'neutral', market_regime_score: '2' },
    ],
    sectorSignalRows: [
      { date: '2026-06-24', sector: 'Information Technology', signal: 'improving' },
    ],
    relativeStrengthRows: [
      {
        date: '2026-06-24',
        ticker: 'NVDA',
        rs_63d_vs_spy: '18.25',
        rs_rank_63d: 24,
        rs_percentile_63d: '95.2',
      },
    ],
    qualityGateRows: buildQualityGateRows('2026-06-24', {
      stock_daily_prices_freshness: 'pass',
      benchmark_spy_freshness: 'pass',
      market_signal_freshness: 'pass',
      relative_strength_freshness: 'pass',
      stock_daily_price_coverage: 'warn',
      relative_strength_coverage: 'pass',
    }),
    earningsCalendarRows: [],
  });

  assert.equal(rows.length, 1);
  assert.deepEqual(rows[0], {
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
    reason_summary: 'quality_warn:stock_daily_price_coverage|market_neutral|sector_improving|volume_confirmed|rs_confirmed|earnings_not_available',
    row_values: {
      breakout_signal: 'buy',
      blocking_gate_keys: [],
      warning_gate_keys: ['stock_daily_price_coverage'],
      missing_gate_keys: [],
      quality_gate_statuses: {
        stock_daily_prices_freshness: 'pass',
        benchmark_spy_freshness: 'pass',
        market_signal_freshness: 'pass',
        relative_strength_freshness: 'pass',
        stock_daily_price_coverage: 'warn',
        relative_strength_coverage: 'pass',
      },
      minimum_relative_volume20: 1.5,
      minimum_rs_percentile_63d: 80,
      earnings_filter_status: 'not_available',
      earnings_reason: 'earnings_not_available',
      earnings_date: null,
      days_to_earnings: null,
      earnings_confirmed: null,
      earnings_source_status: null,
      earnings_snapshot_date: null,
      is_near_earnings: false,
      safe_to_open_new_position: true,
      earnings_pre_window_market_days: 5,
      earnings_post_window_market_days: 1,
    },
  });
});

test('buildRegimeGatedBreakoutRowsFromSources blocks risk-off and quality-blocked breakouts', () => {
  const rows = buildRegimeGatedBreakoutRowsFromSources({
    breakoutRows: [
      {
        date: '2026-06-25',
        ticker: 'AAPL',
        company_name: 'Apple Inc.',
        sector: 'Information Technology',
        breakout_20d_high: '205',
        indicator_price: '209',
        relative_volume20: '2.1',
      },
      {
        date: '2026-06-26',
        ticker: 'MSFT',
        company_name: 'Microsoft Corporation',
        sector: 'Information Technology',
        breakout_20d_high: '510',
        indicator_price: '517',
        relative_volume20: '1.9',
      },
    ],
    marketSignalRows: [
      { date: '2026-06-25', signal: 'risk_off', market_regime_score: '-2' },
      { date: '2026-06-26', signal: 'risk_on', market_regime_score: '5' },
    ],
    sectorSignalRows: [
      { date: '2026-06-25', sector: 'Information Technology', signal: 'leading' },
      { date: '2026-06-26', sector: 'Information Technology', signal: 'leading' },
    ],
    relativeStrengthRows: [
      { date: '2026-06-25', ticker: 'AAPL', rs_63d_vs_spy: '9', rs_rank_63d: 88, rs_percentile_63d: '82' },
      { date: '2026-06-26', ticker: 'MSFT', rs_63d_vs_spy: '11', rs_rank_63d: 55, rs_percentile_63d: '89' },
    ],
    qualityGateRows: [
      ...buildQualityGateRows('2026-06-25', {
        stock_daily_prices_freshness: 'pass',
        benchmark_spy_freshness: 'pass',
        market_signal_freshness: 'pass',
        relative_strength_freshness: 'pass',
        stock_daily_price_coverage: 'pass',
        relative_strength_coverage: 'pass',
      }),
      ...buildQualityGateRows('2026-06-26', {
        stock_daily_prices_freshness: 'block',
        benchmark_spy_freshness: 'pass',
        market_signal_freshness: 'pass',
        relative_strength_freshness: 'pass',
        stock_daily_price_coverage: 'pass',
        relative_strength_coverage: 'pass',
      }),
    ],
    earningsCalendarRows: [],
  });

  assert.equal(rows[0].decision, 'blocked');
  assert.equal(rows[0].qualifies, false);
  assert.match(rows[0].reason_summary, /market_risk_off/);

  assert.equal(rows[1].decision, 'blocked');
  assert.equal(rows[1].data_quality_status, 'block');
  assert.match(rows[1].reason_summary, /quality_block:stock_daily_prices_freshness/);
});

test('buildRegimeGatedBreakoutRowsFromSources blocks buy setups inside the earnings window', () => {
  const rows = buildRegimeGatedBreakoutRowsFromSources({
    breakoutRows: [
      {
        date: '2026-07-28',
        ticker: 'AAPL',
        company_name: 'Apple Inc.',
        sector: 'Information Technology',
        breakout_20d_high: '205',
        indicator_price: '209',
        relative_volume20: '2.1',
      },
    ],
    marketSignalRows: [
      { date: '2026-07-28', signal: 'risk_on', market_regime_score: '5' },
    ],
    sectorSignalRows: [
      { date: '2026-07-28', sector: 'Information Technology', signal: 'leading' },
    ],
    relativeStrengthRows: [
      { date: '2026-07-28', ticker: 'AAPL', rs_63d_vs_spy: '9', rs_rank_63d: 88, rs_percentile_63d: '82' },
    ],
    qualityGateRows: buildQualityGateRows('2026-07-28', {
      stock_daily_prices_freshness: 'pass',
      benchmark_spy_freshness: 'pass',
      market_signal_freshness: 'pass',
      relative_strength_freshness: 'pass',
      stock_daily_price_coverage: 'pass',
      relative_strength_coverage: 'pass',
    }),
    earningsCalendarRows: [
      {
        date: '2026-07-28',
        ticker: 'AAPL',
        earnings_date: '2026-07-30',
        confirmed: false,
        source_status: 'active',
      },
    ],
  });

  assert.equal(rows[0].decision, 'blocked');
  assert.equal(rows[0].qualifies, false);
  assert.equal(rows[0].row_values.earnings_filter_status, 'blocked');
  assert.equal(rows[0].row_values.days_to_earnings, 2);
  assert.match(rows[0].reason_summary, /earnings_pre_window_2d/);
});
