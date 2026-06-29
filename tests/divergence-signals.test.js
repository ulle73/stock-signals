import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildMarketSignalRows,
  calculateMarketRegimeScore,
  classifyMarketSignal,
  classifyLongDivergence,
  classifyShortDivergence,
} from '../lib/utils/divergence-signals.js';

test('classifyLongDivergence returns bearish_warning_strong when breadth weakens under a rising index with confirmation', () => {
  assert.equal(
    classifyLongDivergence({
      spx14dChange: 2.4,
      pctAbove50_14dChange: -7.2,
      adLine14dChange: -15,
      newHighs: 8,
      newHighs14dAgo: 20,
      vix: 25,
      vix14dAgo: 18,
    }),
    'bearish_warning_strong'
  );
});

test('classifyLongDivergence returns bearish_warning without secondary confirmation', () => {
  assert.equal(
    classifyLongDivergence({
      spx14dChange: 1.5,
      pctAbove50_14dChange: -5.5,
      adLine14dChange: 3,
      newHighs: 22,
      newHighs14dAgo: 20,
      vix: 17,
      vix14dAgo: 18,
    }),
    'bearish_warning'
  );
});

test('classifyLongDivergence returns bullish_divergence when breadth improves under a weak index', () => {
  assert.equal(
    classifyLongDivergence({
      spx14dChange: -2.2,
      pctAbove50_14dChange: 8.1,
      adLine14dChange: 12,
      newHighs: 14,
      newHighs14dAgo: 6,
      vix: 19,
      vix14dAgo: 26,
    }),
    'bullish_divergence'
  );
});

test('classifyShortDivergence returns short-negative and short-positive labels', () => {
  assert.equal(
    classifyShortDivergence({
      spx3dChange: 0.8,
      pctAbove50_3dChange: -2.1,
    }),
    'short_negative'
  );

  assert.equal(
    classifyShortDivergence({
      spx3dChange: -1.3,
      pctAbove50_3dChange: 1.2,
    }),
    'short_positive'
  );
});

test('calculateMarketRegimeScore and classifyMarketSignal map the combined state into risk buckets', () => {
  const riskOnScore = calculateMarketRegimeScore({
    pctAbove50: 61,
    pctAbove200: 58,
    spx14dChange: 2.5,
    adLine14dChange: 120,
    newHighs: 35,
    newLows: 7,
    vix: 16.2,
    divergenceStatus: 'none',
    shortDivergenceStatus: 'short_positive',
  });
  const riskOffScore = calculateMarketRegimeScore({
    pctAbove50: 42,
    pctAbove200: 39,
    spx14dChange: -3.5,
    adLine14dChange: -80,
    newHighs: 5,
    newLows: 28,
    vix: 29.5,
    divergenceStatus: 'bearish_warning_strong',
    shortDivergenceStatus: 'short_negative',
  });

  assert.equal(riskOnScore, 6.5);
  assert.equal(classifyMarketSignal(riskOnScore), 'risk_on');
  assert.equal(riskOffScore, -8.5);
  assert.equal(classifyMarketSignal(riskOffScore), 'risk_off');
  assert.equal(classifyMarketSignal(1.5), 'neutral');
});

test('buildMarketSignalRows computes rolling changes, AD line, and divergence statuses', () => {
  const rows = Array.from({ length: 15 }, (_, index) => ({
    date: `2026-01-${String(index + 1).padStart(2, '0')}`,
    spx_close: 100 + index,
    pct_above_50: 70 - index,
    pct_above_200: 60 - index * 0.5,
    advancers: index < 14 ? 8 : 3,
    decliners: index < 14 ? 7 : 12,
    new_highs: index < 14 ? 20 - index : 4,
    new_lows: index < 14 ? index : 14,
    vix: index < 14 ? 14 + index * 0.2 : 22,
  }));

  const signalRows = buildMarketSignalRows(rows);
  const latest = signalRows.at(-1);

  assert.equal(signalRows.length, 15);
  assert.equal(latest.date, '2026-01-15');
  assert.equal(latest.ad_line, 5);
  assert.equal(latest.ad_line_14d_change, 4);
  assert.equal(latest.divergence_status, 'bearish_warning_strong');
  assert.equal(latest.short_divergence_status, 'short_negative');
  assert.equal(latest.market_regime_score, 0.5);
  assert.equal(latest.signal, 'neutral');
  assert.equal(latest.spx_14d_change, 14);
  assert.equal(latest.spx_3d_change, 2.702703);
  assert.equal(latest.pct_above_50_14d_change, -14);
  assert.equal(latest.pct_above_200_14d_change, -7);
});
