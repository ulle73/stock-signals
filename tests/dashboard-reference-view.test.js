import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildOverviewAction,
  buildReferenceMarketMetrics,
} from '../lib/utils/dashboard-reference-view.js';

test('buildOverviewAction maps existing recommendation labels to action-first dashboard copy', () => {
  assert.equal(buildOverviewAction('Strong Risk-On'), 'ÖKA EXPONERING');
  assert.equal(buildOverviewAction('Risk-On'), 'ÖKA EXPONERING');
  assert.equal(buildOverviewAction('Cautious Bullish'), 'ÖKA FÖRSIKTIGT');
  assert.equal(buildOverviewAction('Neutral'), 'AVVAKTA');
  assert.equal(buildOverviewAction('Risk Warning'), 'MINSKA EXPONERING');
  assert.equal(buildOverviewAction('Risk-Off'), 'MINSKA EXPONERING');
});

test('buildReferenceMarketMetrics uses existing recent market fields and sector strength only', () => {
  const metrics = buildReferenceMarketMetrics({
    latestSignal: {
      pct_above_50: '65',
      ad_line: '1240',
      vix: '14.8',
      new_highs: 7,
      market_regime_score: '5',
      signal: 'risk_on',
    },
    recentSignals: [
      { date: '2026-07-03', pct_above_50: '59', ad_line: '1160', vix: '16.0', new_highs: 3, market_regime_score: '3' },
      { date: '2026-07-08', pct_above_50: '62', ad_line: '1200', vix: '15.3', new_highs: 5, market_regime_score: '4' },
      { date: '2026-07-09', pct_above_50: '65', ad_line: '1240', vix: '14.8', new_highs: 7, market_regime_score: '5' },
    ],
    sectorRows: [
      { strength: 60 },
      { strength: 70 },
      { strength: null },
    ],
  });

  assert.equal(metrics.length, 6);
  assert.deepEqual(metrics[0], {
    key: 'breadth',
    icon: 'users',
    label: 'BREDD (ÖVER MA50)',
    value: 65,
    valueType: 'percent',
    oneDayChange: 3,
    oneWeekChange: 6,
    changeType: 'points',
    series: [59, 62, 65],
    tone: 'positive',
  });
  assert.equal(metrics[4].label, 'RS-STYRKA (63D)');
  assert.equal(metrics[4].value, 65);
  assert.equal(metrics[5].label, 'MARKNADSREGIM');
  assert.equal(metrics[5].value, 'risk_on');
});
