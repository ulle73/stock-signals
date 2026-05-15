import { query } from '../db.js';
import {
  GLOBAL_MANUFACTURING_PMI_DEFINITIONS,
  fetchGlobalManufacturingPmiValues,
} from '../sources/trading-economics-pmi.js';
import { colorBucketFromHeatmapScore, getMacroMatrixColorMetrics } from '../utils/macro-matrix-colors.js';

const CACHE_TTL_MS = 30 * 60 * 1000;
const DEFAULT_MONTH_COUNT = 27;
const DEFAULT_QUARTER_COUNT = 0;

const cachedSnapshots = new Map();

function normalizeNumber(value, digits = 4) {
  if (value === null || value === undefined) return null;
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  return Number(number.toFixed(digits));
}

function getMonthStart(date = new Date()) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-01`;
}

function addMonths(periodDate, monthDelta) {
  const [year, month] = periodDate.split('-').map(Number);
  const utcDate = new Date(Date.UTC(year, month - 1 + monthDelta, 1));
  return `${utcDate.getUTCFullYear()}-${String(utcDate.getUTCMonth() + 1).padStart(2, '0')}-01`;
}

function getTrailingMonths(latestMonth, monthCount) {
  const count = Math.max(1, Number(monthCount) || DEFAULT_MONTH_COUNT);
  return Array.from({ length: count }, (_, index) => addMonths(latestMonth, index - count + 1));
}

function getQuarterKey(periodDate) {
  const [year, month] = periodDate.split('-').map(Number);
  return `${year}-Q${Math.floor((month - 1) / 3) + 1}`;
}

function formatQuarterLabel(quarterKey) {
  const [year, quarter] = quarterKey.split('-');
  return `${quarter}-${year.slice(-2)}`;
}

function average(values) {
  const validValues = values.filter((value) => value !== null && value !== undefined && Number.isFinite(Number(value)));
  if (!validValues.length) return null;
  return normalizeNumber(validValues.reduce((sum, value) => sum + Number(value), 0) / validValues.length);
}

function classifyPmiRegime({ macroGrowthScore, percentPositive, percentNegative }) {
  if (macroGrowthScore === null || percentPositive === null || percentNegative === null) {
    return { macroGrowthRegime: 'insufficient_data', macroGrowthRiskAction: 'WAIT' };
  }

  if (macroGrowthScore >= 0.6 && percentPositive >= 65) {
    return { macroGrowthRegime: 'global_pmi_expansion', macroGrowthRiskAction: 'RISK_ON' };
  }

  if (macroGrowthScore >= 0.2 && percentPositive >= 50) {
    return { macroGrowthRegime: 'global_pmi_stable_positive', macroGrowthRiskAction: 'NEUTRAL_TO_RISK_ON' };
  }

  if (macroGrowthScore <= -0.6 && percentNegative >= 65) {
    return { macroGrowthRegime: 'global_pmi_contraction', macroGrowthRiskAction: 'REDUCE_RISK' };
  }

  if (macroGrowthScore < -0.2 || percentNegative >= 50) {
    return { macroGrowthRegime: 'global_pmi_deteriorating', macroGrowthRiskAction: 'NO_NEW_BUYS' };
  }

  return { macroGrowthRegime: 'global_pmi_mixed', macroGrowthRiskAction: 'NEUTRAL' };
}

function buildEmptyObservation(definition, periodDate) {
  return {
    key: definition.key,
    label: definition.label,
    category: definition.category ?? 'global_manufacturing_pmi',
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

function toObservationRows(rowsByKey, definition, months) {
  const valuesByMonth = new Map((rowsByKey.get(definition.key) ?? []).map((row) => [row.period_date, Number(row.value)]));

  return months.map((periodDate) => {
    const value = valuesByMonth.has(periodDate) ? normalizeNumber(valuesByMonth.get(periodDate)) : null;
    const previousValue = valuesByMonth.has(addMonths(periodDate, -1)) ? normalizeNumber(valuesByMonth.get(addMonths(periodDate, -1))) : null;
    const metrics = getMacroMatrixColorMetrics({
      value,
      previousValue,
      type: 'pmi',
      direction: 'pmi',
      neutralLevel: 50,
      normalMonthlyMove: 1,
      pmiLevelScale: 5,
      pmiChangeWeight: 0.75,
    });

    return {
      key: definition.key,
      label: definition.label,
      category: 'global_manufacturing_pmi',
      periodDate,
      rawValue: value,
      transformedValue: value,
      momChange: metrics.momChange === null ? null : normalizeNumber(metrics.momChange),
      zScore36m: null,
      directionScore: metrics.directionScore,
      heatmapScore: metrics.heatmapScore,
      colorBucket: metrics.colorBucket,
    };
  });
}

export async function upsertGlobalManufacturingPmiRows(rows) {
  let inserted = 0;

  for (const row of rows) {
    await query(
      `insert into global_manufacturing_pmi_monthly
         (country_key, country_label, period_date, value, source_url, source_snippet, observed_at)
       values ($1, $2, $3, $4, $5, $6, $7)
       on conflict (country_key, period_date)
       do update set
         country_label = excluded.country_label,
         value = excluded.value,
         source_url = excluded.source_url,
         source_snippet = excluded.source_snippet,
         observed_at = excluded.observed_at,
         updated_at = now()`,
      [row.key, row.label, row.periodDate ?? getMonthStart(new Date(row.observedAt)), row.value, row.sourceUrl, row.sourceSnippet, row.observedAt]
    );
    inserted += 1;
  }

  return inserted;
}

export async function fetchAndStoreGlobalManufacturingPmi() {
  const result = await fetchGlobalManufacturingPmiValues();
  const periodDate = getMonthStart();
  const rows = result.rows.map((row) => ({ ...row, periodDate }));
  const inserted = await upsertGlobalManufacturingPmiRows(rows);

  cachedSnapshots.clear();

  return { ...result, inserted, periodDate };
}

async function readStoredRows() {
  const result = await query(
    `select
       country_key,
       country_label,
       period_date::text,
       value::text,
       source_url,
       observed_at
     from global_manufacturing_pmi_monthly
     order by period_date asc, country_key asc`
  );

  return result.rows.map((row) => ({
    ...row,
    value: Number(row.value),
  }));
}

export function buildGlobalManufacturingPmiMatrix(storedRows, { monthCount = DEFAULT_MONTH_COUNT, quarterCount = DEFAULT_QUARTER_COUNT } = {}) {
  const availableMonths = [...new Set(storedRows.map((row) => row.period_date))].sort((left, right) => left.localeCompare(right));
  const latestMonth = availableMonths.at(-1) ?? getMonthStart();
  const months = getTrailingMonths(latestMonth, monthCount);

  const rowsByKey = new Map();
  for (const row of storedRows) {
    const rows = rowsByKey.get(row.country_key) ?? [];
    rows.push(row);
    rowsByKey.set(row.country_key, rows);
  }

  const quarterKeys = [...new Set(months.map(getQuarterKey))].slice(-quarterCount);
  const quarters = quarterKeys.map((quarterKey) => ({
    key: quarterKey,
    label: formatQuarterLabel(quarterKey),
    periodDates: months.filter((periodDate) => getQuarterKey(periodDate) === quarterKey),
  }));

  const rows = GLOBAL_MANUFACTURING_PMI_DEFINITIONS.map((definition) => {
    const cells = toObservationRows(rowsByKey, definition, months);
    const quarterlyCells = quarters.map((quarter) => {
      const quarterCells = cells.filter((cell) => quarter.periodDates.includes(cell.periodDate) && cell.transformedValue !== null);
      const transformedValue = average(quarterCells.map((cell) => cell.transformedValue));
      const heatmapScore = average(quarterCells.map((cell) => cell.heatmapScore));
      const direction = average(quarterCells.map((cell) => cell.directionScore));

      return {
        quarterKey: quarter.key,
        label: quarter.label,
        transformedValue,
        heatmapScore,
        directionScore: direction,
        colorBucket: colorBucketFromHeatmapScore(heatmapScore),
      };
    });
    const latestCell = cells.at(-1) ?? buildEmptyObservation(definition, null);

    return {
      key: definition.key,
      label: definition.label,
      category: 'global_manufacturing_pmi',
      cells,
      quarterlyCells,
      delta: latestCell.momChange,
      deltaDirection: latestCell.momChange === null ? 'flat' : latestCell.momChange > 0 ? 'up' : latestCell.momChange < 0 ? 'down' : 'flat',
    };
  });

  const summaryByMonth = months.map((periodDate, index) => {
    const validCells = rows
      .map((row) => row.cells[index])
      .filter((cell) => cell.transformedValue !== null && cell.momChange !== null);
    const positiveCount = validCells.filter((cell) => cell.directionScore > 0).length;
    const negativeCount = validCells.filter((cell) => cell.directionScore < 0).length;
    const neutralCount = validCells.filter((cell) => cell.directionScore === 0).length;
    const validRowCount = validCells.length;
    const percentPositive = validRowCount ? normalizeNumber((positiveCount / validRowCount) * 100) : null;
    const percentNegative = validRowCount ? normalizeNumber((negativeCount / validRowCount) * 100) : null;
    const macroGrowthScore = validRowCount ? normalizeNumber(validCells.reduce((sum, cell) => sum + (cell.heatmapScore ?? 0), 0) / validRowCount) : null;

    return {
      periodDate,
      validRowCount,
      positiveCount,
      neutralCount,
      negativeCount,
      percentPositive,
      percentNegative,
      macroGrowthScore,
      isPartial: validRowCount < Math.max(3, Math.ceil(rows.length * 0.35)),
      ...classifyPmiRegime({ macroGrowthScore, percentPositive, percentNegative }),
    };
  });

  const summaryByQuarter = quarters.map((quarter) => {
    const quarterMonths = summaryByMonth.filter((item) => quarter.periodDates.includes(item.periodDate));
    return {
      quarterKey: quarter.key,
      label: quarter.label,
      percentPositive: average(quarterMonths.map((item) => item.percentPositive)),
      macroGrowthScore: average(quarterMonths.map((item) => item.macroGrowthScore)),
    };
  });

  const latestAvailable = summaryByMonth.at(-1) ?? null;
  const latest = [...summaryByMonth].reverse().find((item) => !item.isPartial && item.validRowCount > 0) ?? latestAvailable;

  return {
    title: 'Global Manufacturing PMI',
    description: 'Trading Economics HTML-scrape av senaste manufacturing PMI per land. Värden sparas per månad och bygger historik framåt utan betalt API.',
    months,
    quarters,
    rows,
    summaryByMonth,
    summaryByQuarter,
    latestAvailable,
    latest,
    availableRowCount: rows.filter((row) => row.cells.some((cell) => cell.transformedValue !== null)).length,
    totalRowCount: GLOBAL_MANUFACTURING_PMI_DEFINITIONS.length,
    unavailableKeys: rows.filter((row) => !row.cells.some((cell) => cell.transformedValue !== null)).map((row) => row.key),
  };
}

function getCacheKey(options) {
  return JSON.stringify({
    monthCount: options.monthCount ?? DEFAULT_MONTH_COUNT,
    quarterCount: options.quarterCount ?? DEFAULT_QUARTER_COUNT,
  });
}

export async function getGlobalManufacturingPmiMatrixSnapshot(options = {}) {
  const cacheKey = getCacheKey(options);
  const cached = cachedSnapshots.get(cacheKey);

  if (cached && (Date.now() - cached.cachedAt) < CACHE_TTL_MS) {
    return cached.snapshot;
  }

  try {
    const storedRows = await readStoredRows();
    const snapshot = buildGlobalManufacturingPmiMatrix(storedRows, {
      monthCount: options.monthCount ?? DEFAULT_MONTH_COUNT,
      quarterCount: options.quarterCount ?? DEFAULT_QUARTER_COUNT,
    });
    cachedSnapshots.set(cacheKey, {
      snapshot,
      cachedAt: Date.now(),
    });
    return snapshot;
  } catch (error) {
    return null;
  }
}
