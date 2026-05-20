import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildHistoricalEdgeByDate,
  buildHistoricalEdgeFingerprint,
  classifyMarkovState,
} from '../lib/utils/historical-edge.js';

function addDays(startDate, offset) {
  const date = new Date(`${startDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

function buildRows(count, {
  startClose = 100,
  dailyReturn = 0.004,
  market_regime_score = 1,
  pct_above_50 = 52,
  spx_14d_change = 1,
  vix = 18,
  advancers = 260,
  decliners = 220,
} = {}) {
  let close = startClose;

  return Array.from({ length: count }, (_, index) => {
    close *= 1 + dailyReturn;

    return {
      date: addDays('2026-01-01', index),
      spx_close: close,
      spx_3d_change: 0.5,
      spx_14d_change,
      pct_above_50,
      pct_above_200: 55,
      ad_line_14d_change: 10,
      advancers,
      decliners,
      vix,
      market_regime_score,
      divergence_status: 'none',
      short_divergence_status: 'none',
    };
  });
}

test('classifyMarkovState maps 20-day returns to bull, sideways, and bear', () => {
  assert.equal(classifyMarkovState(0.051), 'bull');
  assert.equal(classifyMarkovState(0.01), 'sideways');
  assert.equal(classifyMarkovState(-0.051), 'bear');
});

test('buildHistoricalEdgeFingerprint combines trend, breadth, and volatility buckets', () => {
  assert.equal(
    buildHistoricalEdgeFingerprint({
      market_regime_score: 4,
      spx_14d_change: 2.2,
      pct_above_50: 65,
      advancers: 320,
      decliners: 180,
      vix: 17,
    }),
    'bull_strong_calm'
  );
});

test('buildHistoricalEdgeByDate exposes active bullish edge from historical transitions and forward returns', () => {
  const rows = buildRows(90);
  const byDate = buildHistoricalEdgeByDate(rows);
  const latest = byDate.get(rows.at(-1).date);

  assert.equal(latest.markov_state, 'bull');
  assert.equal(latest.historical_edge_direction, 'bullish');
  assert.ok(latest.markov_edge > 0.3);
  assert.ok(latest.forward_5d_win_rate >= 0.55);
  assert.ok(latest.forward_sample_size >= 20);
});
