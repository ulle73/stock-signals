import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTradingSignalRowsFromSources } from '../lib/utils/trading-signals.js';

test('buildTradingSignalRowsFromSources sequences long, cash, short, and risk-off decisions', () => {
  const marketSignalRows = [
    {
      date: '2026-01-02',
      pct_above_50: 52,
      pct_above_200: 54,
      spx_3d_change: 0.4,
      spx_14d_change: 0.8,
      ad_line_14d_change: 8,
      advancers: 240,
      decliners: 220,
      vix: 21,
      market_regime_score: 1,
      divergence_status: 'none',
      short_divergence_status: 'none',
    },
    {
      date: '2026-01-03',
      pct_above_50: 61,
      pct_above_200: 58,
      spx_3d_change: 1.2,
      spx_14d_change: 2.6,
      ad_line_14d_change: 120,
      advancers: 310,
      decliners: 180,
      vix: 17,
      market_regime_score: 4.5,
      divergence_status: 'none',
      short_divergence_status: 'none',
    },
    {
      date: '2026-01-04',
      pct_above_50: 63,
      pct_above_200: 60,
      spx_3d_change: 1.4,
      spx_14d_change: 3.1,
      ad_line_14d_change: 135,
      advancers: 320,
      decliners: 170,
      vix: 16,
      market_regime_score: 5,
      divergence_status: 'none',
      short_divergence_status: 'none',
    },
    {
      date: '2026-01-05',
      pct_above_50: 42,
      pct_above_200: 46,
      spx_3d_change: -1.5,
      spx_14d_change: -3.4,
      ad_line_14d_change: -92,
      advancers: 150,
      decliners: 320,
      vix: 27,
      market_regime_score: -3,
      divergence_status: 'bearish_warning',
      short_divergence_status: 'short_negative',
    },
    {
      date: '2026-01-06',
      pct_above_50: 40,
      pct_above_200: 44,
      spx_3d_change: -1.7,
      spx_14d_change: -4.1,
      ad_line_14d_change: -105,
      advancers: 140,
      decliners: 330,
      vix: 28,
      market_regime_score: -3.5,
      divergence_status: 'bearish_warning_strong',
      short_divergence_status: 'short_negative',
    },
    {
      date: '2026-01-07',
      pct_above_50: 37,
      pct_above_200: 35,
      spx_3d_change: -2.4,
      spx_14d_change: -5.6,
      ad_line_14d_change: -144,
      advancers: 120,
      decliners: 360,
      vix: 31,
      market_regime_score: -4.5,
      divergence_status: 'bearish_warning_strong',
      short_divergence_status: 'short_negative',
    },
  ];

  const rows = buildTradingSignalRowsFromSources({ marketSignalRows });

  assert.deepEqual(rows, [
    {
      date: '2026-01-02',
      setup: 'neutral',
      decision: 'SITT STILL',
      previous_state: 'cash',
      target_state: 'cash',
      trigger_count: 5,
      market_regime_score: 1,
      reason_summary: 'mixed_signals',
    },
    {
      date: '2026-01-03',
      setup: 'bullish',
      decision: 'KÖP SPY',
      previous_state: 'cash',
      target_state: 'long',
      trigger_count: 8,
      market_regime_score: 4.5,
      reason_summary: 'strong_bull_confirmation',
    },
    {
      date: '2026-01-04',
      setup: 'bullish',
      decision: 'BEHÅLL',
      previous_state: 'long',
      target_state: 'long',
      trigger_count: 8,
      market_regime_score: 5,
      reason_summary: 'strong_bull_confirmation',
    },
    {
      date: '2026-01-05',
      setup: 'bearish',
      decision: 'SÄLJ SPY',
      previous_state: 'long',
      target_state: 'cash',
      trigger_count: 8,
      market_regime_score: -3,
      reason_summary: 'strong_bear_confirmation',
    },
    {
      date: '2026-01-06',
      setup: 'bearish',
      decision: 'GÅ KORT SPY',
      previous_state: 'cash',
      target_state: 'short',
      trigger_count: 8,
      market_regime_score: -3.5,
      reason_summary: 'strong_bear_confirmation',
    },
    {
      date: '2026-01-07',
      setup: 'risk_off',
      decision: 'STÄNG KORT',
      previous_state: 'short',
      target_state: 'cash',
      trigger_count: 5,
      market_regime_score: -4.5,
      reason_summary: 'extreme_risk_cash',
    },
  ]);
});

test('buildTradingSignalRowsFromSources closes shorts before opening a new long', () => {
  const marketSignalRows = [
    {
      date: '2026-02-02',
      pct_above_50: 41,
      pct_above_200: 43,
      spx_3d_change: -1.1,
      spx_14d_change: -2.7,
      ad_line_14d_change: -70,
      advancers: 145,
      decliners: 305,
      vix: 26,
      market_regime_score: -2.5,
      divergence_status: 'bearish_warning',
      short_divergence_status: 'short_negative',
    },
    {
      date: '2026-02-03',
      pct_above_50: 60,
      pct_above_200: 57,
      spx_3d_change: 1.5,
      spx_14d_change: 2.8,
      ad_line_14d_change: 112,
      advancers: 300,
      decliners: 175,
      vix: 18,
      market_regime_score: 4,
      divergence_status: 'none',
      short_divergence_status: 'none',
    },
    {
      date: '2026-02-04',
      pct_above_50: 62,
      pct_above_200: 59,
      spx_3d_change: 1.6,
      spx_14d_change: 3,
      ad_line_14d_change: 118,
      advancers: 315,
      decliners: 168,
      vix: 17,
      market_regime_score: 4.5,
      divergence_status: 'none',
      short_divergence_status: 'none',
    },
  ];

  const rows = buildTradingSignalRowsFromSources({ marketSignalRows });

  assert.equal(rows[0].decision, 'GÅ KORT SPY');
  assert.equal(rows[0].target_state, 'short');
  assert.equal(rows[1].decision, 'STÄNG KORT');
  assert.equal(rows[1].target_state, 'cash');
  assert.equal(rows[2].decision, 'KÖP SPY');
  assert.equal(rows[2].target_state, 'long');
});
