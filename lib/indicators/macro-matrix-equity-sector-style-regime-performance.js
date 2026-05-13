import {
  buildRegimePerformanceMatrix,
  calculateMonthlyReturnsFromDailyRows,
  calculateRegimePerformanceStats,
  classifyAllocationBias,
  mapMacroRegimeLabels,
  scoreAssetsForCurrentRegime,
} from './regime-performance-core.js';

export const EQUITY_SECTOR_STYLE_ASSET_DEFINITIONS = [
  { key: 'euro_stoxx', label: 'Euro Stoxx', group: 'region_index', region: 'Europe', source: 'yahoo', sourceSymbol: 'FEZ', sourceStatus: 'proxy' },
  { key: 'euro_stoxx_auto_parts', label: 'Euro Stoxx Auto & Parts', group: 'sector', region: 'Europe', source: 'yahoo', sourceSymbol: 'CARZ', sourceStatus: 'proxy' },
  { key: 'euro_stoxx_basic_resources', label: 'Euro Stoxx Basic Resources', group: 'sector', region: 'Europe', source: 'yahoo', sourceSymbol: 'PICK', sourceStatus: 'proxy' },
  { key: 'euro_stoxx_banks', label: 'Euro Stoxx Banks', group: 'sector', region: 'Europe', source: 'yahoo', sourceSymbol: 'EUFN', sourceStatus: 'proxy' },
  { key: 'euro_stoxx_basic_materials', label: 'Euro Stoxx Basic Materials', group: 'sector', region: 'Europe', source: 'yahoo', sourceSymbol: 'MXI', sourceStatus: 'proxy' },
  { key: 'euro_stoxx_construction_materials', label: 'Euro Stoxx Constr & Mat', group: 'sector', region: 'Europe', source: 'yahoo', sourceSymbol: 'PKB', sourceStatus: 'proxy' },
  { key: 'euro_stoxx_cyclicals', label: 'Euro Stoxx Cyclicals', group: 'style_group', region: 'Europe', source: 'yahoo', sourceSymbol: 'CARZ', sourceStatus: 'proxy' },
  { key: 'euro_stoxx_defensives', label: 'Euro Stoxx Defensives', group: 'style_group', region: 'Europe', source: 'yahoo', sourceSymbol: 'DEF', sourceStatus: 'proxy' },
  { key: 'euro_stoxx_energy', label: 'Euro Stoxx Energy', group: 'sector', region: 'Europe', source: 'yahoo', sourceSymbol: 'XLE', sourceStatus: 'proxy' },
  { key: 'euro_stoxx_financials', label: 'Euro Stoxx Financials', group: 'sector', region: 'Europe', source: 'yahoo', sourceSymbol: 'EUFN', sourceStatus: 'proxy' },
  { key: 'euro_stoxx_growth', label: 'Euro Stoxx Growth', group: 'factor_style', region: 'Europe', source: 'yahoo', sourceSymbol: 'EFG', sourceStatus: 'proxy' },
  { key: 'euro_stoxx_health_care', label: 'Euro Stoxx Health Care', group: 'sector', region: 'Europe', source: 'yahoo', sourceSymbol: 'IXJ', sourceStatus: 'proxy' },
  { key: 'euro_stoxx_industrials', label: 'Euro Stoxx Industrials', group: 'sector', region: 'Europe', source: 'yahoo', sourceSymbol: 'EXI', sourceStatus: 'proxy' },
  { key: 'euro_stoxx_insurance', label: 'Euro Stoxx Insurance', group: 'sector', region: 'Europe', source: 'yahoo', sourceSymbol: 'KIE', sourceStatus: 'proxy' },
  { key: 'euro_stoxx_large_cap', label: 'Euro Stoxx Large Cap', group: 'size_style', region: 'Europe', source: 'yahoo', sourceSymbol: 'VGK', sourceStatus: 'proxy' },
  { key: 'euro_stoxx_minimum_volatility', label: 'Euro Stoxx Minimum Volatility', group: 'factor_style', region: 'Europe', source: 'yahoo', sourceSymbol: 'EFAV', sourceStatus: 'proxy' },
  { key: 'euro_stoxx_momentum', label: 'Euro Stoxx Momentum', group: 'factor_style', region: 'Europe', source: 'yahoo', sourceSymbol: 'IMTM', sourceStatus: 'proxy' },
  { key: 'euro_stoxx_oil_gas', label: 'Euro Stoxx Oil & Gas', group: 'sector', region: 'Europe', source: 'yahoo', sourceSymbol: 'XLE', sourceStatus: 'proxy' },
  { key: 'euro_stoxx_real_estate', label: 'Euro Stoxx Real Estate', group: 'sector', region: 'Europe', source: 'yahoo', sourceSymbol: 'VNQI', sourceStatus: 'proxy' },
  { key: 'euro_stoxx_retail', label: 'Euro Stoxx Retail', group: 'sector', region: 'Europe', source: 'yahoo', sourceSymbol: 'XRT', sourceStatus: 'proxy' },
  { key: 'euro_stoxx_small_cap', label: 'Euro Stoxx Small Cap', group: 'size_style', region: 'Europe', source: 'yahoo', sourceSymbol: 'IEUS', sourceStatus: 'proxy' },
  { key: 'euro_stoxx_sustainability', label: 'Euro Stoxx Sustainability', group: 'factor_style', region: 'Europe', source: 'yahoo', sourceSymbol: 'ESGD', sourceStatus: 'proxy' },
  { key: 'euro_stoxx_tech', label: 'Euro Stoxx Tech', group: 'sector', region: 'Europe', source: 'yahoo', sourceSymbol: 'IXN', sourceStatus: 'proxy' },
  { key: 'euro_stoxx_telecom', label: 'Euro Stoxx Telecom', group: 'sector', region: 'Europe', source: 'yahoo', sourceSymbol: 'IXP', sourceStatus: 'proxy' },
  { key: 'euro_stoxx_travel_leisure', label: 'Euro Stoxx Travel & Leisure', group: 'sector', region: 'Europe', source: 'yahoo', sourceSymbol: 'JETS', sourceStatus: 'proxy' },
  { key: 'euro_stoxx_utilities', label: 'Euro Stoxx Utilities', group: 'sector', region: 'Europe', source: 'yahoo', sourceSymbol: 'JXI', sourceStatus: 'proxy' },
  { key: 'euro_stoxx_value', label: 'Euro Stoxx Value', group: 'factor_style', region: 'Europe', source: 'yahoo', sourceSymbol: 'EFV', sourceStatus: 'proxy' },
  { key: 'omxs30', label: 'OMXS30', group: 'region_index', region: 'Sweden', source: 'yahoo', sourceSymbol: 'EWD', sourceStatus: 'proxy' },
  { key: 'omx_banks', label: 'OMX Banks', group: 'sector', region: 'Sweden', source: 'yahoo', sourceSymbol: 'EUFN', sourceStatus: 'proxy' },
  { key: 'omx_basic_materials', label: 'OMX Basic Materials', group: 'sector', region: 'Sweden', source: 'yahoo', sourceSymbol: 'MXI', sourceStatus: 'proxy' },
  { key: 'omx_consumer_staples', label: 'OMX Consumer Staples', group: 'sector', region: 'Sweden', source: 'yahoo', sourceSymbol: 'KXI', sourceStatus: 'proxy' },
  { key: 'omx_financials', label: 'OMX Financials', group: 'sector', region: 'Sweden', source: 'yahoo', sourceSymbol: 'EUFN', sourceStatus: 'proxy' },
  { key: 'omx_health_care', label: 'OMX Health Care', group: 'sector', region: 'Sweden', source: 'yahoo', sourceSymbol: 'IXJ', sourceStatus: 'proxy' },
  { key: 'omx_industrials', label: 'OMX Industrials', group: 'sector', region: 'Sweden', source: 'yahoo', sourceSymbol: 'EXI', sourceStatus: 'proxy' },
  { key: 'omx_real_estate', label: 'OMX Real Estate', group: 'sector', region: 'Sweden', source: 'yahoo', sourceSymbol: 'VNQI', sourceStatus: 'proxy' },
  { key: 'omx_tech_equal', label: 'OMX Tech Equal', group: 'sector', region: 'Sweden', source: 'yahoo', sourceSymbol: 'IXN', sourceStatus: 'proxy' },
  { key: 'omx_technology', label: 'OMX Technology', group: 'sector', region: 'Sweden', source: 'yahoo', sourceSymbol: 'IXN', sourceStatus: 'proxy' },
  { key: 'omx_telecom', label: 'OMX Telecom', group: 'sector', region: 'Sweden', source: 'yahoo', sourceSymbol: 'IXP', sourceStatus: 'proxy' },
  { key: 'sp500', label: 'S&P 500', group: 'region_index', region: 'US', source: 'yahoo', sourceSymbol: 'SPY', sourceStatus: 'active' },
  { key: 'sp500_banks', label: 'S&P 500 Banks', group: 'sector', region: 'US', source: 'yahoo', sourceSymbol: 'KBE', sourceStatus: 'active' },
  { key: 'sp500_buybacks', label: 'S&P 500 Buybacks', group: 'factor_style', region: 'US', source: 'yahoo', sourceSymbol: 'PKW', sourceStatus: 'active' },
  { key: 'sp500_consumer_discretionary', label: 'S&P 500 Consumer Discretionary', group: 'sector', region: 'US', source: 'yahoo', sourceSymbol: 'XLY', sourceStatus: 'active' },
  { key: 'sp500_consumer_staples', label: 'S&P 500 Consumer Staples', group: 'sector', region: 'US', source: 'yahoo', sourceSymbol: 'XLP', sourceStatus: 'active' },
  { key: 'sp500_cyclicals', label: 'S&P 500 Cyclicals', group: 'style_group', region: 'US', source: 'yahoo', sourceSymbol: 'XLY', sourceStatus: 'proxy' },
  { key: 'sp500_energy', label: 'S&P 500 Energy', group: 'sector', region: 'US', source: 'yahoo', sourceSymbol: 'XLE', sourceStatus: 'active' },
  { key: 'sp500_growth', label: 'S&P 500 Growth', group: 'factor_style', region: 'US', source: 'yahoo', sourceSymbol: 'IVW', sourceStatus: 'active' },
  { key: 'sp500_health_care', label: 'S&P 500 Health Care', group: 'sector', region: 'US', source: 'yahoo', sourceSymbol: 'XLV', sourceStatus: 'active' },
  { key: 'sp500_high_beta', label: 'S&P 500 High Beta', group: 'factor_style', region: 'US', source: 'yahoo', sourceSymbol: 'SPHB', sourceStatus: 'active' },
  { key: 'sp500_high_dividend', label: 'S&P 500 High Dividend', group: 'factor_style', region: 'US', source: 'yahoo', sourceSymbol: 'SPYD', sourceStatus: 'active' },
  { key: 'sp500_industrials', label: 'S&P 500 Industrials', group: 'sector', region: 'US', source: 'yahoo', sourceSymbol: 'XLI', sourceStatus: 'active' },
  { key: 'sp500_low_volatility', label: 'S&P 500 Low Volatility', group: 'factor_style', region: 'US', source: 'yahoo', sourceSymbol: 'SPLV', sourceStatus: 'active' },
  { key: 'sp500_materials', label: 'S&P 500 Materials', group: 'sector', region: 'US', source: 'yahoo', sourceSymbol: 'XLB', sourceStatus: 'active' },
  { key: 'sp500_momentum', label: 'S&P 500 Momentum', group: 'factor_style', region: 'US', source: 'yahoo', sourceSymbol: 'MTUM', sourceStatus: 'active' },
  { key: 'sp500_quality', label: 'S&P 500 Quality', group: 'factor_style', region: 'US', source: 'yahoo', sourceSymbol: 'QUAL', sourceStatus: 'active' },
  { key: 'sp500_real_estate', label: 'S&P 500 Real Estate', group: 'sector', region: 'US', source: 'yahoo', sourceSymbol: 'XLRE', sourceStatus: 'active' },
  { key: 'sp500_semiconductors', label: 'S&P 500 Semiconductors', group: 'industry', region: 'US', source: 'yahoo', sourceSymbol: 'SMH', sourceStatus: 'proxy' },
  { key: 'sp500_tech', label: 'S&P 500 Tech', group: 'sector', region: 'US', source: 'yahoo', sourceSymbol: 'XLK', sourceStatus: 'active' },
  { key: 'sp500_value', label: 'S&P 500 Value', group: 'factor_style', region: 'US', source: 'yahoo', sourceSymbol: 'IVE', sourceStatus: 'active' },
];

export const calculateEquitySectorStyleMonthlyReturns = calculateMonthlyReturnsFromDailyRows;
export const mapEquityMacroRegimeLabels = mapMacroRegimeLabels;
export const calculateEquitySectorStyleRegimeStats = calculateRegimePerformanceStats;
export const scoreEquitySectorStylesForCurrentRegime = scoreAssetsForCurrentRegime;
export const classifyEquitySectorStyleAllocationBias = classifyAllocationBias;

export function buildEquitySectorStyleRegimePerformanceMatrix({
  assetDefinitions = EQUITY_SECTOR_STYLE_ASSET_DEFINITIONS,
  dailyRowsByAssetKey,
  regimes,
  currentRegime,
  benchmarkAssetKey = 'omxs30',
}) {
  const monthlyReturns = calculateEquitySectorStyleMonthlyReturns(assetDefinitions, dailyRowsByAssetKey);
  return {
    title: 'Equity Sector & Style Regime Performance',
    description: 'Monthly equity sector/style performance split by recovery, expansion, slowdown and contraction regimes.',
    ...buildRegimePerformanceMatrix({
      assetDefinitions,
      monthlyReturns,
      regimes,
      currentRegime,
      benchmarkAssetKey,
    }),
  };
}
