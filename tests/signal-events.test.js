import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildSignalEventStatusUpdateStatement,
  buildSignalEventUpsertStatements,
} from '../lib/repositories/signal-events.js';
import {
  buildMarketRegimeChangeSignalEvents,
  buildRegimeGatedBreakoutSignalEvents,
} from '../lib/utils/signal-events.js';

test('buildSignalEventUpsertStatements batches signal events without resetting status fields on conflict', () => {
  const rows = [
    {
      event_date: '2026-06-10',
      asset_key: 'MARKET',
      ticker: null,
      signal_key: 'market_regime_change',
      signal_name: 'Market regime changed to neutral',
      signal_type: 'state_change',
      timeframe: 'daily',
      direction: 'neutral',
      severity: 'medium',
      category: 'market_regime',
      channel_key: null,
      source_table: 'market_signal_daily',
      source_payload: {
        previous_signal: 'risk_on',
        signal: 'neutral',
        market_regime_score: 1,
      },
    },
  ];

  const statements = buildSignalEventUpsertStatements(rows, 10);

  assert.equal(statements.length, 1);
  assert.match(statements[0].sql, /insert into signal_events/i);
  assert.match(statements[0].sql, /on conflict \(event_date, asset_key, signal_key\) do update set/i);
  assert.doesNotMatch(statements[0].sql, /\bstatus\s*=/i);
  assert.deepEqual(statements[0].params, [
    '2026-06-10',
    'MARKET',
    null,
    'market_regime_change',
    'Market regime changed to neutral',
    'state_change',
    'daily',
    'neutral',
    'medium',
    'market_regime',
    null,
    'market_signal_daily',
    JSON.stringify({
      previous_signal: 'risk_on',
      signal: 'neutral',
      market_regime_score: 1,
    }),
  ]);
});

test('buildSignalEventStatusUpdateStatement sets sent timestamp when marking events sent', () => {
  const statement = buildSignalEventStatusUpdateStatement({
    id: 42,
    status: 'sent',
    changed_at: '2026-06-10T22:30:00.000Z',
  });

  assert.match(statement.sql, /update signal_events set/i);
  assert.match(statement.sql, /sent_at = coalesce\(\$3, now\(\)\)/i);
  assert.deepEqual(statement.params, [
    42,
    'sent',
    '2026-06-10T22:30:00.000Z',
  ]);
});

test('buildMarketRegimeChangeSignalEvents only emits rows on regime changes after the first observed state', () => {
  const rows = [
    {
      date: '2026-06-01',
      signal: 'risk_on',
      market_regime_score: '4',
      divergence_status: 'none',
      short_divergence_status: 'none',
    },
    {
      date: '2026-06-02',
      signal: 'risk_on',
      market_regime_score: '3.5',
      divergence_status: 'none',
      short_divergence_status: 'none',
    },
    {
      date: '2026-06-03',
      signal: 'neutral',
      market_regime_score: '1',
      divergence_status: 'bearish_warning',
      short_divergence_status: 'none',
    },
    {
      date: '2026-06-04',
      signal: 'neutral',
      market_regime_score: '0.5',
      divergence_status: 'bearish_warning',
      short_divergence_status: 'short_negative',
    },
    {
      date: '2026-06-05',
      signal: 'risk_off',
      market_regime_score: '-3',
      divergence_status: 'bearish_warning_strong',
      short_divergence_status: 'short_negative',
    },
  ];

  const events = buildMarketRegimeChangeSignalEvents(rows);

  assert.deepEqual(events, [
    {
      event_date: '2026-06-03',
      asset_key: 'MARKET',
      ticker: null,
      signal_key: 'market_regime_change',
      signal_name: 'Market regime changed to neutral',
      signal_type: 'state_change',
      timeframe: 'daily',
      direction: 'neutral',
      severity: 'medium',
      category: 'market_regime',
      channel_key: null,
      source_table: 'market_signal_daily',
      source_payload: {
        previous_signal: 'risk_on',
        signal: 'neutral',
        previous_market_regime_score: 3.5,
        market_regime_score: 1,
        divergence_status: 'bearish_warning',
        short_divergence_status: 'none',
      },
    },
    {
      event_date: '2026-06-05',
      asset_key: 'MARKET',
      ticker: null,
      signal_key: 'market_regime_change',
      signal_name: 'Market regime changed to risk_off',
      signal_type: 'state_change',
      timeframe: 'daily',
      direction: 'bearish',
      severity: 'high',
      category: 'market_regime',
      channel_key: null,
      source_table: 'market_signal_daily',
      source_payload: {
        previous_signal: 'neutral',
        signal: 'risk_off',
        previous_market_regime_score: 0.5,
        market_regime_score: -3,
        divergence_status: 'bearish_warning_strong',
        short_divergence_status: 'short_negative',
      },
    },
  ]);
});

test('buildRegimeGatedBreakoutSignalEvents only emits bullish breakout triggers with structured payloads', () => {
  const events = buildRegimeGatedBreakoutSignalEvents([
    {
      date: '2026-06-24',
      ticker: 'NVDA',
      company_name: 'NVIDIA Corporation',
      sector: 'Information Technology',
      market_signal: 'risk_on',
      market_regime_score: '4.5',
      sector_signal: 'leading',
      breakout_20d_high: '150',
      indicator_price: '154',
      relative_volume20: '1.8',
      rs_63d_vs_spy: '18.25',
      rs_rank_63d: 24,
      rs_percentile_63d: '95.2',
      data_quality_status: 'pass',
      qualifies: true,
      decision: 'trigger',
      setup_score: 4,
      reason_summary: 'quality_pass|market_risk_on|sector_leading|volume_confirmed|rs_confirmed',
      row_values: {
        warning_gate_keys: [],
        earnings_filter_status: 'clear',
        earnings_reason: 'earnings_clear',
        earnings_date: '2026-07-30',
        days_to_earnings: 26,
        earnings_confirmed: false,
      },
    },
    {
      date: '2026-06-25',
      ticker: 'AAPL',
      qualifies: false,
      decision: 'blocked',
      row_values: {},
    },
  ]);

  assert.deepEqual(events, [
    {
      event_date: '2026-06-24',
      asset_key: 'NVDA',
      ticker: 'NVDA',
      signal_key: 'regime_gated_breakout_long',
      signal_name: 'NVDA regime-gated breakout',
      signal_type: 'entry_signal',
      timeframe: 'daily',
      direction: 'bullish',
      severity: 'high',
      category: 'breakout',
      channel_key: 'breakout',
      source_table: 'regime_gated_breakout_daily',
      source_payload: {
        company_name: 'NVIDIA Corporation',
        sector: 'Information Technology',
        market_signal: 'risk_on',
        market_regime_score: 4.5,
        sector_signal: 'leading',
        breakout_20d_high: 150,
        indicator_price: 154,
        relative_volume20: 1.8,
        rs_63d_vs_spy: 18.25,
        rs_rank_63d: 24,
        rs_percentile_63d: 95.2,
        data_quality_status: 'pass',
        warning_gate_keys: [],
        reason_summary: 'quality_pass|market_risk_on|sector_leading|volume_confirmed|rs_confirmed',
        setup_score: 4,
        earnings_filter_status: 'clear',
        earnings_reason: 'earnings_clear',
        earnings_date: '2026-07-30',
        days_to_earnings: 26,
        earnings_confirmed: false,
      },
    },
  ]);
});
