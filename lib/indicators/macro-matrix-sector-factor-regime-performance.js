import {
  buildRegimePerformanceMatrix,
  calculateMonthlyReturnsFromDailyRows,
  calculateRegimePerformanceStats,
  classifyAllocationBias,
  mapMacroRegimeLabels,
  scoreAssetsForCurrentRegime,
} from './regime-performance-core.js';

export const SECTOR_FACTOR_REGIME_ASSET_DEFINITIONS = [
  { key: 'sp500', label: 'S&P 500', assetType: 'equity_index', region: 'US', source: 'yahoo', sourceSymbol: 'SPY', sourceStatus: 'active' },
  { key: 'nasdaq_100', label: 'Nasdaq 100', assetType: 'equity_index', region: 'US', source: 'yahoo', sourceSymbol: 'QQQ', sourceStatus: 'active' },
  { key: 'russell_2000', label: 'Russell 2000', assetType: 'equity_index', region: 'US', source: 'yahoo', sourceSymbol: 'IWM', sourceStatus: 'active' },
  { key: 'dow_jones_transport', label: 'Dow Jones Transport', assetType: 'equity_index', region: 'US', source: 'yahoo', sourceSymbol: 'IYT', sourceStatus: 'proxy' },
  { key: 'shanghai_composite', label: 'Shanghai Composite', assetType: 'equity_index', region: 'China', source: 'yahoo', sourceSymbol: 'ASHR', sourceStatus: 'proxy' },
  { key: 'renewable_energy_global', label: 'Renewable Energy Global', assetType: 'thematic_equity', region: 'Global', source: 'yahoo', sourceSymbol: 'ICLN', sourceStatus: 'proxy' },
  { key: 'semiconductors_global', label: 'Semiconductors Global', assetType: 'thematic_equity', region: 'Global', source: 'yahoo', sourceSymbol: 'SMH', sourceStatus: 'proxy' },
  { key: 'gsci_commodities', label: 'GSCI Commodities', assetType: 'commodity_index', region: 'Global', source: 'yahoo', sourceSymbol: 'GSG', sourceStatus: 'proxy' },
  { key: 'gsci_industrial_metals', label: 'GSCI Industrial Metals', assetType: 'commodity_index', region: 'Global', source: 'yahoo', sourceSymbol: 'DBB', sourceStatus: 'proxy' },
  { key: 'gsci_precious_metals', label: 'GSCI Precious Metals', assetType: 'commodity_index', region: 'Global', source: 'yahoo', sourceSymbol: 'GLTR', sourceStatus: 'proxy' },
  { key: 'gsci_softs', label: 'GSCI Softs', assetType: 'commodity_index', region: 'Global', source: 'yahoo', sourceSymbol: 'DBA', sourceStatus: 'proxy' },
  { key: 'gold', label: 'Gold', assetType: 'commodity', region: 'Global', source: 'yahoo', sourceSymbol: 'GLD', sourceStatus: 'proxy' },
  { key: 'silver', label: 'Silver', assetType: 'commodity', region: 'Global', source: 'yahoo', sourceSymbol: 'SLV', sourceStatus: 'proxy' },
  { key: 'palladium', label: 'Palladium', assetType: 'commodity', region: 'Global', source: 'yahoo', sourceSymbol: 'PALL', sourceStatus: 'proxy' },
  { key: 'platinum', label: 'Platinum', assetType: 'commodity', region: 'Global', source: 'yahoo', sourceSymbol: 'PPLT', sourceStatus: 'proxy' },
  { key: 'copper', label: 'Copper', assetType: 'commodity', region: 'Global', source: 'yahoo', sourceSymbol: 'CPER', sourceStatus: 'proxy' },
  { key: 'brent', label: 'Brent', assetType: 'commodity', region: 'Global', source: 'yahoo', sourceSymbol: 'BNO', sourceStatus: 'proxy' },
  { key: 'natural_gas', label: 'Natural Gas', assetType: 'commodity', region: 'Global', source: 'yahoo', sourceSymbol: 'UNG', sourceStatus: 'proxy' },
  { key: 'lumber', label: 'Lumber', assetType: 'commodity', region: 'Global', source: 'yahoo', sourceSymbol: 'WOOD', sourceStatus: 'proxy' },
  { key: 'cocoa', label: 'Cocoa', assetType: 'commodity', region: 'Global', source: 'yahoo', sourceSymbol: 'CC=F', sourceStatus: 'proxy' },
  { key: 'coffee', label: 'Coffee', assetType: 'commodity', region: 'Global', source: 'yahoo', sourceSymbol: 'KC=F', sourceStatus: 'proxy' },
  { key: 'wheat', label: 'Wheat', assetType: 'commodity', region: 'Global', source: 'yahoo', sourceSymbol: 'WEAT', sourceStatus: 'proxy' },
  { key: 'bitcoin', label: 'Bitcoin', assetType: 'crypto', region: 'Global', source: 'yahoo', sourceSymbol: 'BTC-USD', sourceStatus: 'proxy' },
  { key: 'cboe_vix_volatility', label: 'CBOE VIX Volatility', assetType: 'volatility', region: 'US', source: 'yahoo', sourceSymbol: '^VIX', sourceStatus: 'active' },
  { key: 'cboe_gold_volatility', label: 'CBOE Gold Volatility', assetType: 'volatility', region: 'US', source: 'yahoo', sourceSymbol: '^GVZ', sourceStatus: 'active' },
  { key: 'cboe_oil_volatility', label: 'CBOE Oil Volatility', assetType: 'volatility', region: 'US', source: 'yahoo', sourceSymbol: '^OVX', sourceStatus: 'active' },
  { key: 'high_yield_hyg', label: 'High Yield HYG', assetType: 'credit', region: 'US', source: 'yahoo', sourceSymbol: 'HYG', sourceStatus: 'active' },
  { key: 'tips_5y', label: 'TIPS 5Y', assetType: 'inflation_linked_bond', region: 'US', source: 'yahoo', sourceSymbol: 'STIP', sourceStatus: 'proxy' },
  { key: 'us_30y_gov_bond', label: 'US30Y Gov. Bond', assetType: 'government_bond', region: 'US', source: 'yahoo', sourceSymbol: 'TLT', sourceStatus: 'proxy' },
  { key: 'us_10y_gov_bond', label: 'US10Y Gov. Bond', assetType: 'government_bond', region: 'US', source: 'yahoo', sourceSymbol: 'IEF', sourceStatus: 'proxy' },
  { key: 'us_2y_gov_bond', label: 'US2Y Gov. Bond', assetType: 'government_bond', region: 'US', source: 'yahoo', sourceSymbol: 'SHY', sourceStatus: 'proxy' },
  { key: 'omrx_bench_treasury_bonds', label: 'OMRX Bench. Treasury Bonds', assetType: 'bond_index', region: 'Sweden', source: 'yahoo', sourceSymbol: 'BWX', sourceStatus: 'proxy' },
  { key: 'omrx_bench_real_interest', label: 'OMRX Bench. Real Interest', assetType: 'bond_index', region: 'Sweden', source: 'yahoo', sourceSymbol: 'SCHP', sourceStatus: 'proxy' },
  { key: 'omrx_bench_trsy_bills', label: 'OMRX Bench. Trsy Bills', assetType: 'bond_index', region: 'Sweden', source: 'yahoo', sourceSymbol: 'BIL', sourceStatus: 'proxy' },
  { key: 'omrx_mortgage_5y_index', label: 'OMRX Mortgage 5Y Index', assetType: 'bond_index', region: 'Sweden', source: 'yahoo', sourceSymbol: 'MBB', sourceStatus: 'proxy' },
  { key: 'dollar_index', label: 'Dollar Index', assetType: 'currency_index', region: 'US', source: 'yahoo', sourceSymbol: 'UUP', sourceStatus: 'proxy' },
  { key: 'emerging_markets_fx', label: 'Emerging Markets FX', assetType: 'fx_basket', region: 'EM', source: 'yahoo', sourceSymbol: 'CEW', sourceStatus: 'proxy' },
  { key: 'aud_usd', label: 'AUD/USD', assetType: 'fx', region: 'Australia', source: 'yahoo', sourceSymbol: 'AUDUSD=X', sourceStatus: 'active' },
  { key: 'usd_cad', label: 'USD/CAD', assetType: 'fx', region: 'Canada', source: 'yahoo', sourceSymbol: 'CAD=X', sourceStatus: 'active' },
  { key: 'usd_gbp', label: 'USD/GBP', assetType: 'fx', region: 'UK', source: 'yahoo', sourceSymbol: 'GBPUSD=X', sourceStatus: 'proxy' },
  { key: 'usd_jpy', label: 'USD/JPY', assetType: 'fx', region: 'Japan', source: 'yahoo', sourceSymbol: 'JPY=X', sourceStatus: 'active' },
  { key: 'usd_sek', label: 'USD/SEK', assetType: 'fx', region: 'Sweden', source: 'yahoo', sourceSymbol: 'SEK=X', sourceStatus: 'active' },
];

export const calculateSectorFactorMonthlyReturns = calculateMonthlyReturnsFromDailyRows;
export const mapSectorFactorMacroRegimeLabels = mapMacroRegimeLabels;
export const calculateSectorFactorRegimePerformanceStats = calculateRegimePerformanceStats;
export const scoreSectorFactorsForCurrentRegime = scoreAssetsForCurrentRegime;
export const classifySectorFactorAllocationBias = classifyAllocationBias;

export function buildSectorFactorRegimePerformanceMatrix({
  assetDefinitions = SECTOR_FACTOR_REGIME_ASSET_DEFINITIONS,
  dailyRowsByAssetKey,
  monthlyReturns: providedMonthlyReturns = null,
  extraMonthlyReturns = [],
  regimes,
  currentRegime,
  benchmarkAssetKey = 'sp500',
}) {
  const monthlyReturns = providedMonthlyReturns ?? [
    ...calculateSectorFactorMonthlyReturns(assetDefinitions, dailyRowsByAssetKey),
    ...extraMonthlyReturns,
  ];
  return {
    title: 'Sector & Factor Regime Performance',
    description: 'Monthly cross-asset performance split by recovery, expansion, slowdown and contraction regimes.',
    ...buildRegimePerformanceMatrix({
      assetDefinitions,
      monthlyReturns,
      regimes,
      currentRegime,
      benchmarkAssetKey,
    }),
  };
}
