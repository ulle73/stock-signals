import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateRealisedVolatility30d,
  calculateIvolRvolZScore,
  classifyIvolRvolSignal,
  rankIvolRvolAssets,
} from '../lib/indicators/implied-volatility-ratio-rvol-short-squeeze.js';

function buildAssetRowsFromReturns(returns, {
  assetKey = 'spy_sp500',
  assetName = 'SPDR S&P 500 SPY',
  assetType = 'equity_index',
  sourceSymbol = 'SPY',
  startPrice = 100,
  startDate = '2025-01-01',
  volume = 1000000,
} = {}) {
  const start = new Date(`${startDate}T00:00:00Z`);
  const rows = [{
    date: start.toISOString().slice(0, 10),
    asset_key: assetKey,
    asset_name: assetName,
    asset_type: assetType,
    source_symbol: sourceSymbol,
    close: startPrice,
    adj_close: startPrice,
    volume,
  }];

  let price = startPrice;

  returns.forEach((dailyReturn, index) => {
    price *= (1 + dailyReturn);
    const date = new Date(start);
    date.setUTCDate(start.getUTCDate() + index + 1);
    rows.push({
      date: date.toISOString().slice(0, 10),
      asset_key: assetKey,
      asset_name: assetName,
      asset_type: assetType,
      source_symbol: sourceSymbol,
      close: Number(price.toFixed(8)),
      adj_close: Number(price.toFixed(8)),
      volume,
    });
  });

  return rows;
}

function calculateExpectedAnnualisedVolatilityPct(returns) {
  const logReturns = returns.map((dailyReturn) => Math.log(1 + dailyReturn));
  const mean = logReturns.reduce((sum, value) => sum + value, 0) / logReturns.length;
  const variance = logReturns.reduce((sum, value) => sum + ((value - mean) ** 2), 0) / logReturns.length;
  return Math.sqrt(variance) * Math.sqrt(252) * 100;
}

test('calculateRealisedVolatility30d annualises 30-day log-return volatility', () => {
  const returns = Array.from({ length: 30 }, (_, index) => (
    index % 2 === 0 ? 0.012 : -0.0075
  ));
  const rows = buildAssetRowsFromReturns(returns);

  const enrichedRows = calculateRealisedVolatility30d(rows);
  const latestRow = enrichedRows.at(-1);
  const expectedVolatility = calculateExpectedAnnualisedVolatilityPct(returns);

  assert.equal(enrichedRows[29].realised_volatility_30d, null);
  assert.ok(Math.abs(latestRow.realised_volatility_30d - expectedVolatility) < 0.0001);
});

test('calculateIvolRvolZScore requires 126 valid observations and exposes 1-week-ago z-score', () => {
  const start = new Date('2025-01-01T00:00:00Z');
  const rows = Array.from({ length: 140 }, (_, index) => {
    const date = new Date(start);
    date.setUTCDate(start.getUTCDate() + index);
    return {
      date: date.toISOString().slice(0, 10),
      ivol_rvol_ratio: index + 1,
    };
  });

  const zRows = calculateIvolRvolZScore(rows);
  const firstValidRow = zRows[125];
  const latestRow = zRows.at(-1);
  const oneWeekAgoRow = zRows.at(-6);

  const firstValidWindow = rows.slice(0, 126).map((row) => row.ivol_rvol_ratio);
  const mean = firstValidWindow.reduce((sum, value) => sum + value, 0) / firstValidWindow.length;
  const variance = firstValidWindow.reduce((sum, value) => sum + ((value - mean) ** 2), 0) / firstValidWindow.length;
  const expectedZ = (126 - mean) / Math.sqrt(variance);

  assert.equal(zRows[124].ivol_rvol_ratio_z_1y, null);
  assert.ok(Math.abs(firstValidRow.ivol_rvol_ratio_z_1y - expectedZ) < 0.0001);
  assert.equal(latestRow.ivol_rvol_ratio_z_1w_ago, oneWeekAgoRow.ivol_rvol_ratio_z_1y);
  assert.equal(
    latestRow.ivol_rvol_ratio_z_1w_change,
    Number((latestRow.ivol_rvol_ratio_z_1y - oneWeekAgoRow.ivol_rvol_ratio_z_1y).toFixed(6))
  );
  assert.equal(latestRow.ivol_rvol_ratio_z_1y_min, Math.min(...zRows.filter((row) => row.ivol_rvol_ratio_z_1y !== null).map((row) => row.ivol_rvol_ratio_z_1y)));
  assert.equal(latestRow.ivol_rvol_ratio_z_1y_max, Math.max(...zRows.filter((row) => row.ivol_rvol_ratio_z_1y !== null).map((row) => row.ivol_rvol_ratio_z_1y)));
});

test('classifyIvolRvolSignal returns SHORT_SQUEEZE_SETUP when fear is high but trend starts improving', () => {
  assert.deepEqual(
    classifyIvolRvolSignal({
      ivol_rvol_ratio_z_1y: 2.4,
      ivol_rvol_ratio_z_1w_change: 0.25,
      rvol_20d: 0.62,
      realised_volatility_30d_rising_sharply: false,
      range_position_20d: 0.65,
      close_above_ma20: true,
      close_above_ma50: false,
      close_above_ma200: false,
      ma20_slope_20d: 1.2,
      ma50_slope_20d: 0.4,
    }),
    {
      ivol_rvol_level: 'very_high',
      signal: 'SHORT_SQUEEZE_SETUP',
      action: 'WATCH_OR_BUY',
      opportunity_score: 76.25,
    }
  );
});

test('classifyIvolRvolSignal upgrades to SHORT_SQUEEZE_BUY when trend is stronger and vol premium eases', () => {
  assert.deepEqual(
    classifyIvolRvolSignal({
      ivol_rvol_ratio_z_1y: 2.4,
      ivol_rvol_ratio_z_1w_change: -0.4,
      rvol_20d: 0.62,
      realised_volatility_30d_rising_sharply: false,
      range_position_20d: 0.8,
      close_above_ma20: true,
      close_above_ma50: true,
      close_above_ma200: true,
      ma20_slope_20d: 1.8,
      ma50_slope_20d: 0.9,
    }),
    {
      ivol_rvol_level: 'very_high',
      signal: 'SHORT_SQUEEZE_BUY',
      action: 'BUY',
      opportunity_score: 93.5,
    }
  );
});

test('classifyIvolRvolSignal returns HIGH_IVOL_RVOL_RISK_OFF when fear is high and trend is still deteriorating', () => {
  assert.deepEqual(
    classifyIvolRvolSignal({
      ivol_rvol_ratio_z_1y: 2.8,
      ivol_rvol_ratio_z_1w_change: 0.3,
      rvol_20d: 1.1,
      realised_volatility_30d_rising_sharply: true,
      range_position_20d: 0.25,
      close_above_ma20: false,
      close_above_ma50: false,
      close_above_ma200: false,
      ma20_slope_20d: -1.5,
      ma50_slope_20d: -0.7,
    }),
    {
      ivol_rvol_level: 'very_high',
      signal: 'HIGH_IVOL_RVOL_RISK_OFF',
      action: 'NO_NEW_BUYS',
      opportunity_score: 37.583333,
    }
  );
});

test('classifyIvolRvolSignal returns COMPLACENCY_BREAKDOWN_RISK when vol is cheap and trend is breaking down', () => {
  assert.deepEqual(
    classifyIvolRvolSignal({
      ivol_rvol_ratio_z_1y: -1.3,
      ivol_rvol_ratio_z_1w_change: 0.1,
      rvol_20d: 1.05,
      realised_volatility_30d_rising_sharply: false,
      range_position_20d: 0.22,
      close_above_ma20: false,
      close_above_ma50: false,
      close_above_ma200: false,
      ma20_slope_20d: -0.9,
      ma50_slope_20d: -0.4,
    }),
    {
      ivol_rvol_level: 'low',
      signal: 'COMPLACENCY_BREAKDOWN_RISK',
      action: 'REDUCE_RISK',
      opportunity_score: 13.216667,
    }
  );
});

test('rankIvolRvolAssets ranks only scorable rows and leaves missing rows unranked', () => {
  const rankedRows = rankIvolRvolAssets([
    { asset_key: 'spy_sp500', source_status: 'active', ivol_rvol_ratio_z_1y: 2.4 },
    { asset_key: 'qqq_nasdaq', source_status: 'active', ivol_rvol_ratio_z_1y: 1.2 },
    { asset_key: 'gld_gold', source_status: 'missing', ivol_rvol_ratio_z_1y: null },
    { asset_key: 'uso_oil', source_status: 'active', ivol_rvol_ratio_z_1y: -0.8 },
  ]);

  assert.deepEqual(rankedRows, [
    {
      asset_key: 'spy_sp500',
      source_status: 'active',
      ivol_rvol_ratio_z_1y: 2.4,
      ivol_rvol_rank: 1,
      ivol_rvol_percentile: 100,
    },
    {
      asset_key: 'qqq_nasdaq',
      source_status: 'active',
      ivol_rvol_ratio_z_1y: 1.2,
      ivol_rvol_rank: 2,
      ivol_rvol_percentile: 66.666667,
    },
    {
      asset_key: 'gld_gold',
      source_status: 'missing',
      ivol_rvol_ratio_z_1y: null,
      ivol_rvol_rank: null,
      ivol_rvol_percentile: null,
    },
    {
      asset_key: 'uso_oil',
      source_status: 'active',
      ivol_rvol_ratio_z_1y: -0.8,
      ivol_rvol_rank: 3,
      ivol_rvol_percentile: 33.333333,
    },
  ]);
});
