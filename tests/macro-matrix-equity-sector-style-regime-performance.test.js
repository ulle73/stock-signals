import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateEquitySectorStyleMonthlyReturns,
  calculateEquitySectorStyleRegimeStats,
  classifyEquitySectorStyleAllocationBias,
  scoreEquitySectorStylesForCurrentRegime,
} from '../lib/indicators/macro-matrix-equity-sector-style-regime-performance.js';

const assets = [
  { key: 'omxs30', label: 'OMXS30', group: 'region_index', region: 'Sweden' },
  { key: 'leader', label: 'Leader', group: 'sector', region: 'US' },
  { key: 'laggard', label: 'Laggard', group: 'sector', region: 'US' },
];

test('calculateEquitySectorStyleMonthlyReturns uses monthly last adjusted close', () => {
  const returns = calculateEquitySectorStyleMonthlyReturns(assets.slice(0, 1), {
    omxs30: [
      { date: '2025-01-15', close: 99, adj_close: 99 },
      { date: '2025-01-31', close: 100, adj_close: 100 },
      { date: '2025-02-28', close: 110, adj_close: 110 },
      { date: '2025-03-31', close: 99, adj_close: 99 },
    ],
  });

  assert.deepEqual(
    returns.map((row) => ({ periodDate: row.periodDate, closeValue: row.closeValue, monthlyReturnPct: row.monthlyReturnPct })),
    [
      { periodDate: '2025-01-01', closeValue: 100, monthlyReturnPct: null },
      { periodDate: '2025-02-01', closeValue: 110, monthlyReturnPct: 10 },
      { periodDate: '2025-03-01', closeValue: 99, monthlyReturnPct: -10 },
    ]
  );
});

test('calculateEquitySectorStyleRegimeStats calculates stats by regime and beta', () => {
  const monthlyReturns = [
    { assetKey: 'omxs30', periodDate: '2025-01-01', monthlyReturnPct: 1 },
    { assetKey: 'omxs30', periodDate: '2025-02-01', monthlyReturnPct: 2 },
    { assetKey: 'leader', periodDate: '2025-01-01', monthlyReturnPct: 2 },
    { assetKey: 'leader', periodDate: '2025-02-01', monthlyReturnPct: 4 },
    { assetKey: 'laggard', periodDate: '2025-01-01', monthlyReturnPct: -1 },
    { assetKey: 'laggard', periodDate: '2025-02-01', monthlyReturnPct: -2 },
  ];
  const regimes = [
    { periodDate: '2025-01-01', regime: 'expansion' },
    { periodDate: '2025-02-01', regime: 'expansion' },
  ];

  const stats = calculateEquitySectorStyleRegimeStats(assets, monthlyReturns, regimes, { benchmarkAssetKey: 'omxs30' });
  const leader = stats.find((row) => row.assetKey === 'leader');

  assert.equal(leader.regimeStats.expansion.avgReturn, 3);
  assert.equal(leader.regimeStats.expansion.medianReturn, 3);
  assert.equal(leader.regimeStats.expansion.winRatio, 100);
  assert.equal(leader.regimeStats.expansion.observations, 2);
  assert.equal(leader.regimeStats.expansion.beta, 2);
});

test('scoreEquitySectorStylesForCurrentRegime ranks leaders and maps allocation bias', () => {
  const statsRows = [
    {
      assetKey: 'leader',
      assetName: 'Leader',
      regimeStats: { expansion: { avgReturn: 3, medianReturn: 3, sharpe: 2, winRatio: 100, volatility: 1, observations: 12 } },
    },
    {
      assetKey: 'laggard',
      assetName: 'Laggard',
      regimeStats: { expansion: { avgReturn: -2, medianReturn: -2, sharpe: -1, winRatio: 0, volatility: 5, observations: 12 } },
    },
  ];

  const scored = scoreEquitySectorStylesForCurrentRegime(statsRows, 'expansion');
  const leader = scored.find((row) => row.assetKey === 'leader');
  const laggard = scored.find((row) => row.assetKey === 'laggard');

  assert.equal(leader.currentRegimeBucket, 'top_regime_leader');
  assert.equal(leader.allocationBias, 'OVERWEIGHT');
  assert.equal(laggard.currentRegimeBucket, 'avoid_regime_laggard');
  assert.equal(classifyEquitySectorStyleAllocationBias('weak_regime_fit'), 'UNDERWEIGHT');
});
