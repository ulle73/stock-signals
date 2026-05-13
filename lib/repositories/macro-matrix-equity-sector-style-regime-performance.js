import {
  buildEquitySectorStyleRegimePerformanceMatrix,
  EQUITY_SECTOR_STYLE_ASSET_DEFINITIONS,
  mapEquityMacroRegimeLabels,
} from '../indicators/macro-matrix-equity-sector-style-regime-performance.js';
import { getMacroMatrixPmiGrowthSnapshot } from './macro-matrix-pmi-growth.js';
import { fetchYahooRowsInBatches } from './yahoo-batch.js';

const CACHE_TTL_MS = 30 * 60 * 1000;
const YAHOO_REQUEST = { range: '10y' };
const REGIME_MONTH_COUNT = 120;

let cachedSnapshot = null;
let cachedAt = 0;

function getUniqueYahooSymbols() {
  return [
    ...new Set(
      EQUITY_SECTOR_STYLE_ASSET_DEFINITIONS
        .filter((asset) => asset.source === 'yahoo' && asset.sourceSymbol && asset.sourceStatus !== 'missing')
        .map((asset) => asset.sourceSymbol)
    ),
  ];
}

async function fetchYahooRowsBySymbol() {
  return fetchYahooRowsInBatches(getUniqueYahooSymbols(), YAHOO_REQUEST);
}

export async function getEquitySectorStyleRegimePerformanceSnapshot() {
  if (cachedSnapshot && (Date.now() - cachedAt) < CACHE_TTL_MS) {
    return cachedSnapshot;
  }

  const [rowsBySymbol, pmiGrowthMatrix] = await Promise.all([
    fetchYahooRowsBySymbol(),
    getMacroMatrixPmiGrowthSnapshot({ monthCount: REGIME_MONTH_COUNT, quarterCount: 12 }),
  ]);
  const dailyRowsByAssetKey = new Map();
  const unavailableKeys = [];

  for (const asset of EQUITY_SECTOR_STYLE_ASSET_DEFINITIONS) {
    const rows = rowsBySymbol.get(asset.sourceSymbol) ?? [];
    dailyRowsByAssetKey.set(asset.key, rows);
    if (!rows.length) unavailableKeys.push(asset.key);
  }

  const regimes = mapEquityMacroRegimeLabels(pmiGrowthMatrix.summaryByMonth, 'macro_matrix_pmi_growth');
  const currentRegime = regimes.at(-1)?.regime ?? 'slowdown';
  const matrix = buildEquitySectorStyleRegimePerformanceMatrix({
    dailyRowsByAssetKey,
    regimes,
    currentRegime,
    benchmarkAssetKey: 'omxs30',
  });

  cachedSnapshot = {
    ...matrix,
    asOfDate: regimes.at(-1)?.periodDate ?? null,
    unavailableKeys,
  };
  cachedAt = Date.now();

  return cachedSnapshot;
}
