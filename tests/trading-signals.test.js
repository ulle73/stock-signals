import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTradingSignalRowsFromSources } from '../lib/utils/trading-signals.js';

function addDays(startDate, offset) {
  const date = new Date(`${startDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

function buildNeutralRowsWithPositiveHistoricalEdge(count) {
  let close = 100;

  return Array.from({ length: count }, (_, index) => {
    close *= 1.004;

    return {
      date: addDays('2026-01-01', index),
      spx_close: close,
      pct_above_50: 52,
      pct_above_200: 54,
      spx_3d_change: 0.4,
      spx_14d_change: 0.8,
      ad_line_14d_change: 8,
      advancers: 260,
      decliners: 220,
      vix: 18,
      market_regime_score: 1,
      divergence_status: 'none',
      short_divergence_status: 'none',
    };
  });
}

test('buildTradingSignalRowsFromSources sequences long, cash, short, and risk-off decisions', () => {
  const marketSignalRows = [
    {
      date: '2026-01-02',
      spx_close: 100,
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
      spx_close: 101,
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
      spx_close: 102,
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
      date: '2026-01-05',
      spx_close: 101,
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

  assert.equal(rows[0].decision, 'SITT STILL');
  assert.equal(rows[1].decision, 'KÖP SPY');
  assert.equal(rows[2].decision, 'SÄLJ SPY');
  assert.equal(rows[3].decision, 'SITT STILL');
  assert.equal(rows[1].historical_edge_direction, 'neutral');
  assert.ok(Object.hasOwn(rows[1], 'markov_edge'));
  assert.ok(Object.hasOwn(rows[1], 'historical_edge_score'));
});

test('buildTradingSignalRowsFromSources lets historical edge directly trigger buy decisions', () => {
  const marketSignalRows = buildNeutralRowsWithPositiveHistoricalEdge(90);
  const rows = buildTradingSignalRowsFromSources({ marketSignalRows });
  const latest = rows.at(-1);

  assert.equal(latest.setup, 'bullish');
  assert.equal(latest.decision, 'BEHÅLL');
  assert.equal(rows.find((row) => row.reason_summary.includes('historical_edge_bullish')).decision, 'KÖP SPY');
  assert.equal(latest.historical_edge_direction, 'bullish');
  assert.ok(latest.markov_edge > 0.3);
});
