import test from 'node:test';
import assert from 'node:assert/strict';
import { buildImpliedVolatilityRatioDashboardView } from '../lib/utils/implied-volatility-ratio-dashboard-view.js';

test('buildImpliedVolatilityRatioDashboardView sorts rows, compacts labels, and maps values onto the fixed chart scale', () => {
  const viewModel = buildImpliedVolatilityRatioDashboardView([
    {
      date: '2026-05-13',
      asset_key: 'qqq_nasdaq',
      asset_name: 'Invesco QQQ Trust',
      source_symbol: 'QQQ',
      source_status: 'active',
      ivol_rvol_ratio_z_1y: '0.5',
      ivol_rvol_ratio_z_1w_ago: '-0.5',
      ivol_rvol_ratio_z_1y_min: '-2',
      ivol_rvol_ratio_z_1y_max: '3',
    },
    {
      date: '2026-05-13',
      asset_key: 'spy_sp500',
      asset_name: 'SPDR S&P 500 SPY',
      source_symbol: 'SPY',
      source_status: 'active',
      ivol_rvol_ratio_z_1y: '2',
      ivol_rvol_ratio_z_1w_ago: '1',
      ivol_rvol_ratio_z_1y_min: '-1',
      ivol_rvol_ratio_z_1y_max: '5',
    },
    {
      date: '2026-05-13',
      asset_key: 'uso_oil',
      asset_name: 'United States Oil Fund',
      source_symbol: 'USO',
      source_status: 'missing',
      ivol_rvol_ratio_z_1y: null,
      ivol_rvol_ratio_z_1w_ago: null,
      ivol_rvol_ratio_z_1y_min: null,
      ivol_rvol_ratio_z_1y_max: null,
    },
  ]);

  assert.equal(viewModel.date, '2026-05-13');
  assert.equal(viewModel.domain.minimum, -4);
  assert.equal(viewModel.domain.maximum, 10);
  assert.deepEqual(
    viewModel.ticks.map((tick) => ({ value: tick.value, positionPct: tick.positionPct })),
    [
      { value: -4, positionPct: 0 },
      { value: -2, positionPct: 14.29 },
      { value: 0, positionPct: 28.57 },
      { value: 2, positionPct: 42.86 },
      { value: 4, positionPct: 57.14 },
      { value: 6, positionPct: 71.43 },
      { value: 8, positionPct: 85.71 },
      { value: 10, positionPct: 100 },
    ]
  );

  assert.deepEqual(
    viewModel.rows.map((row) => row.displayLabel),
    ['SPDR S&P 500 SPY: 2.0', 'PowerShares QQQ: 0.5']
  );

  assert.deepEqual(viewModel.rows[0], {
    assetKey: 'spy_sp500',
    assetName: 'SPDR S&P 500 SPY',
    displayName: 'SPDR S&P 500 SPY',
    displayLabel: 'SPDR S&P 500 SPY: 2.0',
    currentZScore: 2,
    oneWeekAgoZScore: 1,
    rangeMin: -1,
    rangeMax: 5,
    currentPositionPct: 42.86,
    oneWeekAgoPositionPct: 35.71,
    rangeStartPct: 21.43,
    rangeWidthPct: 42.86,
  });

  assert.equal(viewModel.rows.length, 2);
});
