import { fetchFredSeries } from '../sources/fred.js';
import {
  buildMacroMatrixUsGrowth,
  MACRO_MATRIX_US_GROWTH_DEFINITIONS,
  transformMacroSeriesToMonthlyObservations,
} from '../indicators/macro-matrix-us-growth.js';
import { getGlobalManufacturingPmiMatrixSnapshot } from './global-manufacturing-pmi.js';

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

function makeEmptyCell(row, periodDate) {
  return {
    key: row.key,
    label: row.label,
    category: row.category,
    periodDate,
    rawValue: null,
    transformedValue: null,
    momChange: null,
    zScore36m: null,
    directionScore: 0,
    heatmapScore: null,
    colorBucket: 'missing',
  };
}

function makeEmptyQuarterCell(row, quarter) {
  return {
    quarterKey: quarter.key,
    label: quarter.label,
    transformedValue: null,
    heatmapScore: null,
    directionScore: 0,
    colorBucket: 'missing',
  };
}

function alignGlobalPmiRowsToBaseMatrix(baseMatrix, globalPmiMatrix) {
  if (!globalPmiMatrix?.rows?.length) {
    return [];
  }

  return globalPmiMatrix.rows.map((row) => {
    const cellsByPeriod = new Map(row.cells.map((cell) => [cell.periodDate, cell]));
    const quarterlyCellsByKey = new Map(row.quarterlyCells.map((cell) => [cell.quarterKey, cell]));
    const alignedCells = baseMatrix.months.map((periodDate) => cellsByPeriod.get(periodDate) ?? makeEmptyCell(row, periodDate));
    const alignedQuarterlyCells = baseMatrix.quarters.map((quarter) => quarterlyCellsByKey.get(quarter.key) ?? makeEmptyQuarterCell(row, quarter));
    const latestCell = [...alignedCells].reverse().find((cell) => cell.transformedValue !== null) ?? alignedCells.at(-1);

    return {
      ...row,
      key: `global_pmi_${row.key}`,
      label: `Global PMI · ${row.label}`,
      cells: alignedCells,
      quarterlyCells: alignedQuarterlyCells,
      delta: latestCell?.momChange ?? null,
      deltaDirection: latestCell?.momChange === null || latestCell?.momChange === undefined
        ? 'flat'
        : latestCell.momChange > 0
          ? 'up'
          : latestCell.momChange < 0
            ? 'down'
            : 'flat',
    };
  });
}

async function appendGlobalPmiRows(matrix, snapshot) {
  const globalPmiMatrix = await getGlobalManufacturingPmiMatrixSnapshot();
  const globalRows = alignGlobalPmiRowsToBaseMatrix(matrix, globalPmiMatrix);

  if (!globalRows.length) {
    return { ...snapshot, globalManufacturingPmiMatrix: globalPmiMatrix };
  }

  return {
    ...snapshot,
    rows: [...snapshot.rows, ...globalRows],
    availableRowCount: snapshot.availableRowCount + globalRows.filter((row) => row.cells.some((cell) => cell.transformedValue !== null)).length,
    totalRowCount: snapshot.totalRowCount + globalRows.length,
    globalManufacturingPmiMatrix: globalPmiMatrix,
  };
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
  const snapshot = await appendGlobalPmiRows(matrix, {
    ...matrix,
    unavailableKeys,
    availableRowCount: MACRO_MATRIX_US_GROWTH_DEFINITIONS.length - unavailableKeys.length,
    totalRowCount: MACRO_MATRIX_US_GROWTH_DEFINITIONS.length,
  });

  cachedSnapshot = snapshot;
  cachedAt = Date.now();

  return snapshot;
}
