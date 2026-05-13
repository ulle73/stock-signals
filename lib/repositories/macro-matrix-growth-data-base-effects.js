import {
  buildGrowthDataBaseEffectsMatrix,
  MACRO_MATRIX_GROWTH_DATA_BASE_EFFECTS_DEFINITIONS,
  transformGrowthDataBaseEffectSeriesToMonthlyObservations,
} from '../indicators/macro-matrix-growth-data-base-effects.js';
import { fetchFredSeries } from '../sources/fred.js';

const CACHE_TTL_MS = 30 * 60 * 1000;
const HISTORY_YEARS = 8;

let cachedSnapshot = null;
let cachedAt = 0;

function getHistoryCutoffDate() {
  const cutoff = new Date();
  cutoff.setUTCFullYear(cutoff.getUTCFullYear() - HISTORY_YEARS);
  cutoff.setUTCDate(1);
  return cutoff.toISOString().slice(0, 10);
}

function getUniqueFredSeriesIds() {
  return [
    ...new Set(
      MACRO_MATRIX_GROWTH_DATA_BASE_EFFECTS_DEFINITIONS
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

export async function getGrowthDataBaseEffectsMatrixSnapshot() {
  if (cachedSnapshot && (Date.now() - cachedAt) < CACHE_TTL_MS) {
    return cachedSnapshot;
  }

  const rowsBySeriesId = await fetchFredRowsBySeriesId();
  const observationsByKey = {};
  const unavailableKeys = [];

  for (const definition of MACRO_MATRIX_GROWTH_DATA_BASE_EFFECTS_DEFINITIONS) {
    const sourceRows = rowsBySeriesId.get(definition.sourceSeriesId) ?? [];
    observationsByKey[definition.key] = transformGrowthDataBaseEffectSeriesToMonthlyObservations(sourceRows, definition);

    if (!sourceRows.length) {
      unavailableKeys.push(definition.key);
    }
  }

  const matrix = buildGrowthDataBaseEffectsMatrix(observationsByKey);
  const snapshot = {
    ...matrix,
    unavailableKeys,
    availableRowCount: matrix.rows.filter((row) => row.cells.some((cell) => cell.transformedValue !== null)).length,
    totalRowCount: MACRO_MATRIX_GROWTH_DATA_BASE_EFFECTS_DEFINITIONS.length,
  };

  cachedSnapshot = snapshot;
  cachedAt = Date.now();

  return snapshot;
}
