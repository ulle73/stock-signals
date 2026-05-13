import { buildMacroMatrixPmiGrowth, MACRO_MATRIX_PMI_GROWTH_DEFINITIONS, transformPmiMacroSeriesToMonthlyObservations } from '../indicators/macro-matrix-pmi-growth.js';
import { fetchFredSeries } from '../sources/fred.js';

const CACHE_TTL_MS = 30 * 60 * 1000;
const HISTORY_YEARS = 8;

const cachedSnapshots = new Map();

function getHistoryCutoffDate() {
  const cutoff = new Date();
  cutoff.setUTCFullYear(cutoff.getUTCFullYear() - HISTORY_YEARS);
  cutoff.setUTCDate(1);
  return cutoff.toISOString().slice(0, 10);
}

function getUniqueFredSeriesIds() {
  return [
    ...new Set(
      MACRO_MATRIX_PMI_GROWTH_DEFINITIONS
        .filter((definition) => definition.source === 'fred' && definition.sourceSeriesId)
        .map((definition) => definition.sourceSeriesId)
    ),
  ];
}

async function fetchFredRowsBySeriesId() {
  const cutoffDate = getHistoryCutoffDate();
  const results = await Promise.allSettled(
    getUniqueFredSeriesIds().map(async (seriesId) => ({
      seriesId,
      rows: (await fetchFredSeries(seriesId))
        .filter((row) => row.date >= cutoffDate)
        .map((row) => ({ date: row.date, value: row.value })),
    }))
  );

  const rowsBySeriesId = new Map();

  for (const result of results) {
    if (result.status === 'fulfilled') {
      rowsBySeriesId.set(result.value.seriesId, result.value.rows);
    }
  }

  return rowsBySeriesId;
}

function getCacheKey(options) {
  return JSON.stringify({
    monthCount: options.monthCount ?? 14,
    quarterCount: options.quarterCount ?? 4,
  });
}

export async function getMacroMatrixPmiGrowthSnapshot(options = {}) {
  const cacheKey = getCacheKey(options);
  const cached = cachedSnapshots.get(cacheKey);

  if (cached && (Date.now() - cached.cachedAt) < CACHE_TTL_MS) {
    return cached.snapshot;
  }

  const rowsBySeriesId = await fetchFredRowsBySeriesId();
  const observationsByKey = {};
  const unavailableKeys = [];

  for (const definition of MACRO_MATRIX_PMI_GROWTH_DEFINITIONS) {
    const sourceRows = rowsBySeriesId.get(definition.sourceSeriesId) ?? [];
    observationsByKey[definition.key] = transformPmiMacroSeriesToMonthlyObservations(sourceRows, definition);

    if (!sourceRows.length) {
      unavailableKeys.push(definition.key);
    }
  }

  const matrix = buildMacroMatrixPmiGrowth(observationsByKey, options);
  const snapshot = {
    ...matrix,
    unavailableKeys,
    availableRowCount: matrix.rows.filter((row) => row.cells.some((cell) => cell.transformedValue !== null)).length,
    totalRowCount: MACRO_MATRIX_PMI_GROWTH_DEFINITIONS.length,
  };

  cachedSnapshots.set(cacheKey, {
    snapshot,
    cachedAt: Date.now(),
  });

  return snapshot;
}
