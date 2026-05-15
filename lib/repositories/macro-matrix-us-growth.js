import { fetchFredSeries } from '../sources/fred.js';
import {
  buildMacroMatrixUsGrowth,
  MACRO_MATRIX_US_GROWTH_DEFINITIONS,
  transformMacroSeriesToMonthlyObservations,
} from '../indicators/macro-matrix-us-growth.js';

const CACHE_TTL_MS = 30 * 60 * 1000;
const HISTORY_YEARS = 8;
const DEFAULT_MONTH_COUNT = 25;
const DEFAULT_QUARTER_COUNT = 2;

const cachedSnapshots = new Map();

function getHistoryCutoffDate() {
  const cutoff = new Date();
  cutoff.setUTCFullYear(cutoff.getUTCFullYear() - HISTORY_YEARS);
  cutoff.setUTCDate(1);
  return cutoff.toISOString().slice(0, 10);
}

async function fetchDefinitionRows(definition) {
  const rows = await fetchFredSeries(definition.seriesId);
  const cutoffDate = getHistoryCutoffDate();

  return rows
    .filter((row) => row.date >= cutoffDate)
    .map((row) => ({
      date: row.date,
      value: row.value,
    }));
}

function getCacheKey(options) {
  return JSON.stringify({
    monthCount: options.monthCount ?? DEFAULT_MONTH_COUNT,
    quarterCount: options.quarterCount ?? DEFAULT_QUARTER_COUNT,
  });
}

export async function getMacroMatrixUsGrowthSnapshot(options = {}) {
  const cacheKey = getCacheKey(options);
  const cached = cachedSnapshots.get(cacheKey);

  if (cached && (Date.now() - cached.cachedAt) < CACHE_TTL_MS) {
    return cached.snapshot;
  }

  const results = await Promise.allSettled(
    MACRO_MATRIX_US_GROWTH_DEFINITIONS.map(async (definition) => ({
      key: definition.key,
      rows: transformMacroSeriesToMonthlyObservations(await fetchDefinitionRows(definition), definition),
    }))
  );

  const observationsByKey = {};
  const unavailableKeys = [];

  for (let index = 0; index < results.length; index += 1) {
    const definition = MACRO_MATRIX_US_GROWTH_DEFINITIONS[index];
    const result = results[index];

    if (result.status === 'fulfilled') {
      observationsByKey[result.value.key] = result.value.rows;
      continue;
    }

    observationsByKey[definition.key] = [];
    unavailableKeys.push(definition.key);
  }

  const matrix = buildMacroMatrixUsGrowth(observationsByKey, {
    monthCount: options.monthCount ?? DEFAULT_MONTH_COUNT,
    quarterCount: options.quarterCount ?? DEFAULT_QUARTER_COUNT,
  });
  const snapshot = {
    ...matrix,
    unavailableKeys,
    availableRowCount: MACRO_MATRIX_US_GROWTH_DEFINITIONS.length - unavailableKeys.length,
    totalRowCount: MACRO_MATRIX_US_GROWTH_DEFINITIONS.length,
  };

  cachedSnapshots.set(cacheKey, {
    snapshot,
    cachedAt: Date.now(),
  });

  return snapshot;
}
