import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildImpliedVolatilityProxySourceRows,
  buildImpliedVolatilityProxySourceUpsertStatements,
  IMPLIED_VOLATILITY_PROXY_ASSET_DEFINITIONS,
} from '../lib/repositories/implied-volatility-proxy-source.js';
import { buildImpliedVolatilityRatioSignalUpsertStatements } from '../lib/repositories/implied-volatility-ratio-signals.js';

test('IMPLIED_VOLATILITY_PROXY_ASSET_DEFINITIONS includes the expanded cross-asset proxy universe', () => {
  const byKey = new Map(
    IMPLIED_VOLATILITY_PROXY_ASSET_DEFINITIONS.map((item) => [item.assetKey, item])
  );

  assert.deepEqual(
    [
      byKey.get('iwm_russell2000'),
      byKey.get('xle_energy'),
      byKey.get('smh_semiconductors'),
      byKey.get('arkk_innovation'),
      byKey.get('gdx_gold_miners'),
      byKey.get('fxe_euro'),
      byKey.get('uup_us_dollar'),
    ],
    [
      {
        assetKey: 'iwm_russell2000',
        assetName: 'iShares Russell 2000 ETF',
        assetType: 'equity_index',
        sourceSymbol: 'IWM',
        impliedVolatilitySymbol: '^VIX',
      },
      {
        assetKey: 'xle_energy',
        assetName: 'SPDR Energy Select Sector ETF',
        assetType: 'equity_sector',
        sourceSymbol: 'XLE',
        impliedVolatilitySymbol: '^OVX',
      },
      {
        assetKey: 'smh_semiconductors',
        assetName: 'VanEck Semiconductor ETF',
        assetType: 'equity_sector',
        sourceSymbol: 'SMH',
        impliedVolatilitySymbol: '^VXN',
      },
      {
        assetKey: 'arkk_innovation',
        assetName: 'ARK Innovation ETF',
        assetType: 'equity_index',
        sourceSymbol: 'ARKK',
        impliedVolatilitySymbol: '^VXN',
      },
      {
        assetKey: 'gdx_gold_miners',
        assetName: 'VanEck Gold Miners ETF',
        assetType: 'equity_sector',
        sourceSymbol: 'GDX',
        impliedVolatilitySymbol: '^GVZ',
      },
      {
        assetKey: 'fxe_euro',
        assetName: 'CurrencyShares Euro Trust',
        assetType: 'currency_etf',
        sourceSymbol: 'FXE',
        impliedVolatilitySymbol: '^EVZ',
      },
      {
        assetKey: 'uup_us_dollar',
        assetName: 'Invesco DB US Dollar Index Bullish Fund',
        assetType: 'currency_etf',
        sourceSymbol: 'UUP',
        impliedVolatilitySymbol: '^EVZ',
      },
    ]
  );
});

test('buildImpliedVolatilityProxySourceRows merges asset candles with IV proxy rows and preserves missing-IV dates', () => {
  const definition = {
    assetKey: 'spy_sp500',
    assetName: 'SPDR S&P 500 SPY',
    assetType: 'equity_index',
    sourceSymbol: 'SPY',
    impliedVolatilitySymbol: '^VIX',
  };

  const sourceRows = buildImpliedVolatilityProxySourceRows(
    definition,
    [
      {
        date: '2026-05-12',
        close: 581.72,
        adj_close: 581.72,
        volume: 71234000,
      },
      {
        date: '2026-05-13',
        close: 585.11,
        adj_close: 585.11,
        volume: 75432000,
      },
    ],
    [
      {
        date: '2026-05-12',
        close: 18.03,
      },
    ]
  );

  assert.deepEqual(sourceRows, [
    {
      date: '2026-05-12',
      asset_key: 'spy_sp500',
      asset_name: 'SPDR S&P 500 SPY',
      asset_type: 'equity_index',
      source_symbol: 'SPY',
      implied_volatility_symbol: '^VIX',
      close: 581.72,
      adj_close: 581.72,
      volume: 71234000,
      implied_volatility: 18.03,
      source_status: 'active',
      price_source: 'yahoo',
      implied_volatility_source: 'yahoo_cboe_proxy',
      price_source_url: 'https://query1.finance.yahoo.com/v8/finance/chart/SPY?range=800d&interval=1d',
      implied_volatility_source_url: 'https://query1.finance.yahoo.com/v8/finance/chart/%5EVIX?range=800d&interval=1d',
    },
    {
      date: '2026-05-13',
      asset_key: 'spy_sp500',
      asset_name: 'SPDR S&P 500 SPY',
      asset_type: 'equity_index',
      source_symbol: 'SPY',
      implied_volatility_symbol: '^VIX',
      close: 585.11,
      adj_close: 585.11,
      volume: 75432000,
      implied_volatility: null,
      source_status: 'missing',
      price_source: 'yahoo',
      implied_volatility_source: 'yahoo_cboe_proxy',
      price_source_url: 'https://query1.finance.yahoo.com/v8/finance/chart/SPY?range=800d&interval=1d',
      implied_volatility_source_url: 'https://query1.finance.yahoo.com/v8/finance/chart/%5EVIX?range=800d&interval=1d',
    },
  ]);
});

test('buildImpliedVolatilityProxySourceUpsertStatements stores raw price and implied-volatility proxy inputs', () => {
  const rows = [
    {
      date: '2026-05-12',
      asset_key: 'spy_sp500',
      asset_name: 'SPDR S&P 500 SPY',
      asset_type: 'equity_index',
      source_symbol: 'SPY',
      implied_volatility_symbol: '^VIX',
      close: 581.72,
      adj_close: 581.72,
      volume: 71234000,
      implied_volatility: 18.03,
      source_status: 'active',
      price_source: 'yahoo',
      implied_volatility_source: 'yahoo_cboe_proxy',
      price_source_url: 'https://query1.finance.yahoo.com/v8/finance/chart/SPY?range=800d&interval=1d',
      implied_volatility_source_url: 'https://query1.finance.yahoo.com/v8/finance/chart/%5EVIX?range=800d&interval=1d',
    },
  ];

  const statements = buildImpliedVolatilityProxySourceUpsertStatements(rows, 10);

  assert.equal(statements.length, 1);
  assert.match(statements[0].sql, /insert into implied_volatility_proxy_source_daily/i);
  assert.deepEqual(statements[0].params, [
    '2026-05-12',
    'spy_sp500',
    'SPDR S&P 500 SPY',
    'equity_index',
    'SPY',
    '^VIX',
    '581.72',
    '581.72',
    '71234000',
    '18.03',
    'active',
    'yahoo',
    'yahoo_cboe_proxy',
    'https://query1.finance.yahoo.com/v8/finance/chart/SPY?range=800d&interval=1d',
    'https://query1.finance.yahoo.com/v8/finance/chart/%5EVIX?range=800d&interval=1d',
  ]);
});

test('buildImpliedVolatilityRatioSignalUpsertStatements stores calculated IVOL/RVOL signal rows', () => {
  const rows = [
    {
      date: '2026-05-12',
      asset_key: 'spy_sp500',
      asset_name: 'SPDR S&P 500 SPY',
      asset_type: 'equity_index',
      source_symbol: 'SPY',
      source_status: 'active',
      close: 581.72,
      implied_volatility: 18.03,
      realised_volatility_30d: 14.12,
      realised_volatility_30d_5d_change: -1.15,
      realised_volatility_30d_rising_sharply: false,
      ivol_rvol_ratio: 1.27762,
      ivol_rvol_ratio_z_1y: 2.144231,
      ivol_rvol_ratio_z_1w_ago: 2.511245,
      ivol_rvol_ratio_z_1w_change: -0.367014,
      ivol_rvol_ratio_z_1y_min: -1.242312,
      ivol_rvol_ratio_z_1y_max: 3.114522,
      rvol_20d: 0.71,
      rvol_bucket: 'low_rvol',
      close_above_ma20: true,
      close_above_ma50: true,
      close_above_ma200: true,
      ma20_slope_20d: 12.5,
      ma50_slope_20d: 18.2,
      trend_regime: 'short_term_uptrend',
      range_position_20d: 0.84,
      range_bucket: 'upper_range',
      ivol_rvol_level: 'very_high',
      signal: 'SHORT_SQUEEZE_BUY',
      action: 'BUY',
      opportunity_score: 94.107014,
      ivol_rvol_rank: 1,
      ivol_rvol_percentile: 100,
      row_values: {
        asset_key: 'spy_sp500',
        signal: 'SHORT_SQUEEZE_BUY',
        action: 'BUY',
      },
    },
  ];

  const statements = buildImpliedVolatilityRatioSignalUpsertStatements(rows, 10);

  assert.equal(statements.length, 1);
  assert.match(statements[0].sql, /insert into implied_volatility_ratio_signals_daily/i);
  assert.deepEqual(statements[0].params, [
    '2026-05-12',
    'spy_sp500',
    'SPDR S&P 500 SPY',
    'equity_index',
    'SPY',
    'active',
    '581.72',
    '18.03',
    '14.12',
    '-1.15',
    false,
    '1.27762',
    '2.144231',
    '2.511245',
    '-0.367014',
    '-1.242312',
    '3.114522',
    '0.71',
    'low_rvol',
    true,
    true,
    true,
    '12.5',
    '18.2',
    'short_term_uptrend',
    '0.84',
    'upper_range',
    'very_high',
    'SHORT_SQUEEZE_BUY',
    'BUY',
    '94.107014',
    1,
    '100',
    '{"asset_key":"spy_sp500","signal":"SHORT_SQUEEZE_BUY","action":"BUY"}',
  ]);
});
