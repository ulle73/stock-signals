import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildSectorFactorRegimePerformanceMatrix,
  calculateSectorFactorMonthlyReturns,
  SECTOR_FACTOR_REGIME_ASSET_DEFINITIONS,
} from '../lib/indicators/macro-matrix-sector-factor-regime-performance.js';

test('SECTOR_FACTOR_REGIME_ASSET_DEFINITIONS includes the requested cross-asset groups with fetchable proxies', () => {
  const keys = new Set(SECTOR_FACTOR_REGIME_ASSET_DEFINITIONS.map((asset) => asset.key));

  for (const key of ['sp500', 'gold', 'bitcoin', 'cboe_vix_volatility', 'us_10y_gov_bond', 'usd_sek']) {
    assert.equal(keys.has(key), true);
  }

  assert.equal(SECTOR_FACTOR_REGIME_ASSET_DEFINITIONS.every((asset) => asset.sourceSymbol), true);
});

test('buildSectorFactorRegimePerformanceMatrix scores cross-asset rows for the current regime', () => {
  const assetDefinitions = [
    { key: 'sp500', label: 'S&P 500', assetType: 'equity_index', region: 'US' },
    { key: 'gold', label: 'Gold', assetType: 'commodity', region: 'Global' },
  ];
  const dailyRowsByAssetKey = {
    sp500: [
      { date: '2025-01-31', adj_close: 100 },
      { date: '2025-02-28', adj_close: 110 },
      { date: '2025-03-31', adj_close: 121 },
    ],
    gold: [
      { date: '2025-01-31', adj_close: 100 },
      { date: '2025-02-28', adj_close: 98 },
      { date: '2025-03-31', adj_close: 96 },
    ],
  };
  const regimes = [
    { periodDate: '2025-02-01', regime: 'expansion' },
    { periodDate: '2025-03-01', regime: 'expansion' },
  ];
  const monthlyReturns = calculateSectorFactorMonthlyReturns(assetDefinitions, dailyRowsByAssetKey);

  assert.equal(monthlyReturns.filter((row) => row.monthlyReturnPct !== null).length, 4);

  const matrix = buildSectorFactorRegimePerformanceMatrix({
    assetDefinitions,
    dailyRowsByAssetKey,
    regimes,
    currentRegime: 'expansion',
    benchmarkAssetKey: 'sp500',
  });

  assert.equal(matrix.rows.length, 2);
  assert.equal(matrix.rows.find((row) => row.key === 'sp500').allocationBias, 'OVERWEIGHT');
  assert.equal(matrix.rows.find((row) => row.key === 'gold').allocationBias, 'AVOID');
});

test('buildSectorFactorRegimePerformanceMatrix can use a hidden OMXS30 benchmark without rendering it as a visible row', () => {
  const assetDefinitions = [
    { key: 'sp500', label: 'S&P 500', assetType: 'equity_index', region: 'US' },
    { key: 'gold', label: 'Gold', assetType: 'commodity', region: 'Global' },
  ];
  const dailyRowsByAssetKey = {
    sp500: [
      { date: '2025-01-31', adj_close: 100 },
      { date: '2025-02-28', adj_close: 110 },
      { date: '2025-03-31', adj_close: 121 },
      { date: '2025-04-30', adj_close: 115 },
    ],
    gold: [
      { date: '2025-01-31', adj_close: 100 },
      { date: '2025-02-28', adj_close: 102 },
      { date: '2025-03-31', adj_close: 104 },
      { date: '2025-04-30', adj_close: 108 },
    ],
  };
  const regimes = [
    { periodDate: '2025-02-01', regime: 'expansion' },
    { periodDate: '2025-03-01', regime: 'expansion' },
    { periodDate: '2025-04-01', regime: 'expansion' },
  ];
  const monthlyReturns = [
    ...calculateSectorFactorMonthlyReturns(assetDefinitions, dailyRowsByAssetKey),
    {
      assetKey: 'omxs30_benchmark',
      assetName: 'OMXS30',
      assetGroup: 'equity_index',
      region: 'Sweden',
      source: 'yahoo',
      sourceSymbol: '^OMX',
      sourceStatus: 'proxy',
      periodDate: '2025-02-01',
      closeValue: 100,
      monthlyReturnPct: 8,
    },
    {
      assetKey: 'omxs30_benchmark',
      assetName: 'OMXS30',
      assetGroup: 'equity_index',
      region: 'Sweden',
      source: 'yahoo',
      sourceSymbol: '^OMX',
      sourceStatus: 'proxy',
      periodDate: '2025-03-01',
      closeValue: 108,
      monthlyReturnPct: 6,
    },
    {
      assetKey: 'omxs30_benchmark',
      assetName: 'OMXS30',
      assetGroup: 'equity_index',
      region: 'Sweden',
      source: 'yahoo',
      sourceSymbol: '^OMX',
      sourceStatus: 'proxy',
      periodDate: '2025-04-01',
      closeValue: 114.48,
      monthlyReturnPct: -4,
    },
  ];

  const matrix = buildSectorFactorRegimePerformanceMatrix({
    assetDefinitions,
    dailyRowsByAssetKey,
    monthlyReturns,
    regimes,
    currentRegime: 'expansion',
    benchmarkAssetKey: 'omxs30_benchmark',
  });

  assert.equal(matrix.rows.length, 2);
  assert.equal(matrix.rows.some((row) => row.key === 'omxs30_benchmark'), false);
  assert.equal(matrix.rows.every((row) => row.regimeCells.every((cell) => 'metricBuckets' in cell)), true);
  assert.equal(matrix.rows.some((row) => row.regimeCells.some((cell) => cell.beta !== null)), true);
});
