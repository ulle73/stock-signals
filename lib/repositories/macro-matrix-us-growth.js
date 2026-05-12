import { fetchFredSeries } from '../sources/fred.js';
import {
  buildMacroMatrixUsGrowth,
  MACRO_MATRIX_US_GROWTH_DEFINITIONS,
  transformMacroSeriesToMonthlyObservations,
} from '../indicators/macro-matrix-us-growth.js';

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

export async function getMacroMatrixUsGrowthSnapshot() {
  if (cachedSnapshot && (Date.now() - cachedAt) < CACHE_TTL_MS) {
    return cachedSnapshot;
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

  const matrix = buildMacroMatrixUsGrowth(observationsByKey);
  const snapshot = {
    ...matrix,
    unavailableKeys,
    availableRowCount: MACRO_MATRIX_US_GROWTH_DEFINITIONS.length - unavailableKeys.length,
    totalRowCount: MACRO_MATRIX_US_GROWTH_DEFINITIONS.length,
  };

  cachedSnapshot = snapshot;
  cachedAt = Date.now();

  return snapshot;
}
