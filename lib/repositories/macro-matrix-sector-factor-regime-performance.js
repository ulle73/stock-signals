import {
  buildSectorFactorRegimePerformanceMatrix,
  calculateSectorFactorMonthlyReturns,
  mapSectorFactorMacroRegimeLabels,
  SECTOR_FACTOR_REGIME_ASSET_DEFINITIONS,
} from '../indicators/macro-matrix-sector-factor-regime-performance.js';
import { getMacroMatrixPmiGrowthSnapshot } from './macro-matrix-pmi-growth.js';
import { getMacroMatrixYahooProxyRowsBySymbol } from './macro-matrix-yahoo-proxy-source.js';

const CACHE_TTL_MS = 30 * 60 * 1000;
const REGIME_MONTH_COUNT = 120;
const OMXS30_BENCHMARK_ASSET = {
  key: 'omxs30_benchmark',
  label: 'OMXS30',
  assetType: 'equity_index',
  region: 'Sweden',
  source: 'yahoo',
  sourceStatus: 'proxy',
};
const OMXS30_BENCHMARK_SYMBOLS = ['^OMX', 'XACT-OMXS30.ST'];

let cachedSnapshot = null;
let cachedAt = 0;

function getUniqueYahooSymbols() {
  return [
    ...new Set(
      [
        ...SECTOR_FACTOR_REGIME_ASSET_DEFINITIONS
          .filter((asset) => asset.source === 'yahoo' && asset.sourceSymbol && asset.sourceStatus !== 'missing')
          .map((asset) => asset.sourceSymbol),
        ...OMXS30_BENCHMARK_SYMBOLS,
      ]
    ),
  ];
}

function resolveOmxs30Benchmark(rowsBySymbol) {
  for (const sourceSymbol of OMXS30_BENCHMARK_SYMBOLS) {
    const rows = rowsBySymbol.get(sourceSymbol) ?? [];
    if (!rows.length) continue;

    return {
      asset: {
        ...OMXS30_BENCHMARK_ASSET,
        sourceSymbol,
      },
      rows,
    };
  }

  return null;
}

export async function getSectorFactorRegimePerformanceSnapshot() {
  if (cachedSnapshot && (Date.now() - cachedAt) < CACHE_TTL_MS) {
    return cachedSnapshot;
  }

  const [rowsBySymbol, pmiGrowthMatrix] = await Promise.all([
    getMacroMatrixYahooProxyRowsBySymbol(getUniqueYahooSymbols()),
    getMacroMatrixPmiGrowthSnapshot({ monthCount: REGIME_MONTH_COUNT, quarterCount: 12 }),
  ]);
  const dailyRowsByAssetKey = new Map();
  const unavailableKeys = [];

  for (const asset of SECTOR_FACTOR_REGIME_ASSET_DEFINITIONS) {
    const rows = rowsBySymbol.get(asset.sourceSymbol) ?? [];
    dailyRowsByAssetKey.set(asset.key, rows);
    if (!rows.length) unavailableKeys.push(asset.key);
  }

  const regimes = mapSectorFactorMacroRegimeLabels(pmiGrowthMatrix.summaryByMonth, 'macro_matrix_pmi_growth');
  const currentRegime = regimes.at(-1)?.regime ?? 'slowdown';
  const omxs30Benchmark = resolveOmxs30Benchmark(rowsBySymbol);
  const extraMonthlyReturns = omxs30Benchmark
    ? calculateSectorFactorMonthlyReturns(
      [omxs30Benchmark.asset],
      new Map([[omxs30Benchmark.asset.key, omxs30Benchmark.rows]])
    )
    : [];
  const matrix = buildSectorFactorRegimePerformanceMatrix({
    dailyRowsByAssetKey,
    extraMonthlyReturns,
    regimes,
    currentRegime,
    benchmarkAssetKey: omxs30Benchmark ? omxs30Benchmark.asset.key : 'sp500',
  });

  cachedSnapshot = {
    ...matrix,
    asOfDate: regimes.at(-1)?.periodDate ?? null,
    benchmarkLabel: omxs30Benchmark ? `OMXS30 proxy (${omxs30Benchmark.asset.sourceSymbol})` : 'S&P 500 (fallback)',
    benchmarkSourceSymbol: omxs30Benchmark?.asset.sourceSymbol ?? 'SPY',
    unavailableKeys,
  };
  cachedAt = Date.now();

  return cachedSnapshot;
}
