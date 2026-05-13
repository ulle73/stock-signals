import {
  colorBucketFromHeatmapScore,
  getMacroMatrixColorMetrics,
  smoothMacroMatrixColorCells,
} from '../utils/macro-matrix-colors.js';
import { normalizeNumber, sortRowsByDate, toNumber } from './statistics.js';

const DEFAULT_MONTH_COUNT = 14;
const DEFAULT_QUARTER_COUNT = 4;
const MIN_ZSCORE_HISTORY = 24;
const MAX_ZSCORE_HISTORY = 36;

export const MACRO_MATRIX_PMI_GROWTH_DEFINITIONS = [
  {
    key: 'economic_tendency_total',
    label: 'Economic Tendency Indicator Total',
    category: 'broad_cycle',
    source: 'fred',
    sourceSeriesId: 'BSCICP02USM460S',
    sourceStatus: 'active',
    sourceNote: 'OECD US manufacturing business confidence proxy',
    transform: 'raw',
    direction: 'neutral_level',
    neutralLevel: 0,
  },
  {
    key: 'economic_tendency_construction',
    label: 'Economic Tendency Indicator Construction',
    category: 'construction',
    source: 'fred',
    sourceSeriesId: 'TTLCONS',
    sourceStatus: 'active',
    sourceNote: 'US Census total construction spending proxy',
    transform: 'yoy',
    direction: 'higher_is_better',
  },
  {
    key: 'composite_leading_indicators_yoy',
    label: 'Composite Leading Indicators Y/Y',
    category: 'leading_indicators',
    source: 'fred',
    sourceSeriesId: 'USALOLITOAASTSAM',
    sourceStatus: 'active',
    sourceNote: 'OECD US CLI, amplitude adjusted',
    transform: 'yoy',
    direction: 'higher_is_better',
  },
  {
    key: 'cli_manufacturing_order_books',
    label: 'CLI Manufacturing - Order Books',
    category: 'manufacturing_leading',
    source: 'fred',
    sourceSeriesId: 'BSOBLV02USM460S',
    sourceStatus: 'active',
    sourceNote: 'OECD US manufacturing order books',
    transform: 'raw',
    direction: 'neutral_level',
    neutralLevel: 0,
  },
  {
    key: 'cli_services_demand_expectations',
    label: 'CLI Services - Demand Expectations',
    category: 'services_leading',
    source: 'fred',
    sourceSeriesId: 'USABNODTE02STSAM',
    sourceStatus: 'legacy',
    sourceNote: 'OECD US non-manufacturing order/demand tendency; history ends 2020-06',
    transform: 'raw',
    direction: 'neutral_level',
    neutralLevel: 0,
  },
  {
    key: 'exports_yoy',
    label: 'Export Y/Y',
    category: 'trade',
    source: 'fred',
    sourceSeriesId: 'BOPTEXP',
    sourceStatus: 'active',
    sourceNote: 'US BEA exports of goods and services, BOP basis',
    transform: 'yoy',
    direction: 'higher_is_better',
  },
  {
    key: 'imports_yoy',
    label: 'Import Y/Y',
    category: 'trade',
    source: 'fred',
    sourceSeriesId: 'BOPTIMP',
    sourceStatus: 'active',
    sourceNote: 'US BEA imports of goods and services, BOP basis',
    transform: 'yoy',
    direction: 'higher_is_better',
  },
  {
    key: 'industrial_production_mining_mfg_yoy',
    label: 'Industrial Production %Y/Y Mining & MFG',
    category: 'manufacturing_activity',
    source: 'fred',
    sourceSeriesId: 'IPMAN',
    sourceStatus: 'active',
    sourceNote: 'Federal Reserve industrial production manufacturing proxy',
    transform: 'yoy',
    direction: 'higher_is_better',
  },
  {
    key: 'new_motor_vehicle_registrations_yoy',
    label: 'New Motor Vehicle Registrations %Y/Y',
    category: 'consumption_cyclical',
    source: 'fred',
    sourceSeriesId: 'TOTALSA',
    sourceStatus: 'active',
    sourceNote: 'US BEA total vehicle sales proxy',
    transform: 'yoy',
    direction: 'higher_is_better',
  },
  {
    key: 'retail_sales_ex_vehicles_yoy',
    label: 'Retail Sales excl. Vehicles %Y/Y',
    category: 'consumption',
    source: 'fred',
    sourceSeriesId: 'RSFSXMV',
    sourceStatus: 'active',
    sourceNote: 'US Census retail sales excluding motor vehicles and parts',
    transform: 'yoy',
    direction: 'higher_is_better',
  },
  {
    key: 'consumer_confidence_ytd',
    label: 'Consumer Confidence Survey',
    category: 'consumer_sentiment',
    source: 'fred',
    sourceSeriesId: 'UMCSENT',
    sourceStatus: 'active',
    sourceNote: 'University of Michigan consumer sentiment proxy',
    transform: 'raw',
    direction: 'neutral_level',
    neutralLevel: 100,
  },
  {
    key: 'manufacturing_pmi_total',
    label: 'Manufacturing PMI Total SA',
    category: 'manufacturing_pmi',
    source: 'fred',
    sourceSeriesId: 'BSCICP02USM460S',
    sourceStatus: 'proxy',
    sourceNote: 'OECD US manufacturing confidence proxy; exact historical PMI CSV not available through current FRED endpoint',
    transform: 'raw',
    direction: 'neutral_level',
    neutralLevel: 0,
  },
  {
    key: 'manufacturing_pmi_new_orders',
    label: 'Manufacturing PMI New Orders SA',
    category: 'manufacturing_pmi',
    source: 'fred',
    sourceSeriesId: 'BSOBLV02USM460S',
    sourceStatus: 'proxy',
    sourceNote: 'OECD US manufacturing order books proxy',
    transform: 'raw',
    direction: 'neutral_level',
    neutralLevel: 0,
  },
  {
    key: 'manufacturing_pmi_production',
    label: 'Manufacturing PMI Production SA',
    category: 'manufacturing_pmi',
    source: 'fred',
    sourceSeriesId: 'IPMAN',
    sourceStatus: 'proxy',
    sourceNote: 'Federal Reserve industrial production manufacturing proxy',
    transform: 'yoy',
    direction: 'higher_is_better',
  },
  {
    key: 'service_pmi_new_orders',
    label: 'Service PMI New Orders SA',
    category: 'services_pmi',
    source: 'fred',
    sourceSeriesId: 'USABNODTE02STSAM',
    sourceStatus: 'legacy_proxy',
    sourceNote: 'OECD US non-manufacturing order/demand tendency proxy; history ends 2020-06',
    transform: 'raw',
    direction: 'neutral_level',
    neutralLevel: 0,
  },
  {
    key: 'service_pmi_business_activity',
    label: 'Service PMI Business Activity SA',
    category: 'services_pmi',
    source: 'fred',
    sourceSeriesId: 'PCES',
    sourceStatus: 'proxy',
    sourceNote: 'US BEA personal consumption expenditures: services proxy',
    transform: 'yoy',
    direction: 'higher_is_better',
  },
  {
    key: 'service_pmi_total',
    label: 'Service PMI Total SA',
    category: 'services_pmi',
    source: 'fred',
    sourceSeriesId: 'SRVPRD',
    sourceStatus: 'proxy',
    sourceNote: 'BLS all employees, service-providing proxy',
    transform: 'yoy',
    direction: 'higher_is_better',
  },
];

const DEFINITION_BY_KEY = new Map(MACRO_MATRIX_PMI_GROWTH_DEFINITIONS.map((definition) => [definition.key, definition]));
const CATEGORY_GROUPS = {
  manufacturingPmiScore: ['manufacturing_pmi'],
  servicesPmiScore: ['services_pmi'],
  leadingIndicatorsScore: ['leading_indicators', 'manufacturing_leading', 'services_leading'],
  broadCycleScore: ['broad_cycle', 'construction'],
  tradeScore: ['trade'],
  consumptionScore: ['consumption', 'consumption_cyclical'],
  sentimentScore: ['consumer_sentiment'],
};

function average(values) {
  const validValues = values.filter((value) => value !== null && value !== undefined && Number.isFinite(Number(value)));
  if (!validValues.length) return null;
  return normalizeNumber(validValues.reduce((sum, value) => sum + Number(value), 0) / validValues.length);
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function getMonthStart(date) {
  return `${date.slice(0, 7)}-01`;
}

function addMonths(periodDate, monthDelta) {
  const [year, month] = periodDate.split('-').map(Number);
  const utcDate = new Date(Date.UTC(year, month - 1 + monthDelta, 1));
  return `${utcDate.getUTCFullYear()}-${String(utcDate.getUTCMonth() + 1).padStart(2, '0')}-01`;
}

function getQuarterKey(periodDate) {
  const [year, month] = periodDate.split('-').map(Number);
  return `${year}-Q${Math.floor((month - 1) / 3) + 1}`;
}

function formatQuarterLabel(quarterKey) {
  const [year, quarter] = quarterKey.split('-');
  return `${quarter}-${year.slice(-2)}`;
}

function calculateZscore(validHistory) {
  if (validHistory.length < MIN_ZSCORE_HISTORY) return null;

  const window = validHistory.slice(-MAX_ZSCORE_HISTORY);
  const currentValue = window.at(-1);
  const mean = window.reduce((sum, value) => sum + value, 0) / window.length;
  const variance = window.reduce((sum, value) => sum + ((value - mean) ** 2), 0) / window.length;
  const standardDeviation = Math.sqrt(variance);

  if (!Number.isFinite(standardDeviation) || standardDeviation === 0) return null;

  return normalizeNumber((currentValue - mean) / standardDeviation);
}

function buildMonthlyAverages(rows) {
  const groupedValues = new Map();

  for (const row of sortRowsByDate(rows)) {
    const value = toNumber(row.value);
    if (value === null || !row.date) continue;

    const periodDate = getMonthStart(row.date);
    const values = groupedValues.get(periodDate) ?? [];
    values.push(value);
    groupedValues.set(periodDate, values);
  }

  return [...groupedValues.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([periodDate, values]) => ({
      periodDate,
      rawValue: average(values),
    }));
}

function computeTransformedValue(periodDate, rawValue, rawValueByPeriod, transform) {
  if (rawValue === null) return null;
  if (transform === 'raw' || !transform) return rawValue;
  if (transform !== 'yoy') return rawValue;

  const priorYearValue = rawValueByPeriod.get(addMonths(periodDate, -12));
  if (priorYearValue === null || priorYearValue === undefined || priorYearValue === 0) return null;

  return normalizeNumber(((rawValue / priorYearValue) - 1) * 100);
}

function getColorConfig(definition) {
  if (definition.direction === 'pmi') {
    return { type: 'pmi', direction: 'pmi', neutralLevel: 50, normalMonthlyMove: 1, pmiLevelScale: 5, pmiChangeWeight: 0.75 };
  }

  if (definition.direction === 'neutral_level') {
    return {
      type: 'level_momentum',
      direction: 'higher_is_better',
      neutralLevel: definition.neutralLevel ?? 0,
      levelScale: Math.abs(definition.neutralLevel ?? 0) >= 50 ? 10 : 8,
      normalMonthlyMove: Math.abs(definition.neutralLevel ?? 0) >= 50 ? 2 : 1.5,
    };
  }

  if (definition.direction === 'lower_is_better') {
    return { type: 'level_momentum', direction: 'lower_is_better', neutralLevel: 0, levelScale: 8, normalMonthlyMove: 1.5 };
  }

  if (definition.transform === 'yoy') {
    return { type: 'level_momentum', direction: 'higher_is_better', neutralLevel: 0, levelScale: 8, normalMonthlyMove: 2 };
  }

  return { type: 'momentum', direction: 'higher_is_better', normalMonthlyMove: 2 };
}

function scoreDirection(definition, currentValue, previousValue, momChange) {
  if (currentValue === null || previousValue === null || momChange === null) return 0;

  if (definition.direction === 'pmi') {
    if (currentValue >= 50 && momChange > 0) return 1;
    if (currentValue < 50 && momChange <= 0) return -1;
    return 0;
  }

  if (definition.direction === 'neutral_level') {
    const neutralLevel = definition.neutralLevel ?? 0;
    if (currentValue >= neutralLevel && momChange > 0) return 1;
    if (currentValue < neutralLevel && momChange <= 0) return -1;
    return 0;
  }

  if (definition.direction === 'lower_is_better') {
    if (momChange < 0) return 1;
    if (momChange > 0) return -1;
    return 0;
  }

  if (momChange > 0) return 1;
  if (momChange < 0) return -1;
  return 0;
}

function buildEmptyObservation(key, periodDate) {
  const definition = DEFINITION_BY_KEY.get(key) ?? { key, label: key, category: 'macro' };
  return {
    key,
    label: definition.label,
    category: definition.category,
    periodDate,
    rawValue: null,
    transformedValue: null,
    momChange: null,
    zScore36m: null,
    directionScore: 0,
    heatmapScore: null,
    colorBucket: 'missing',
    source: definition.source ?? null,
    sourceSeriesId: definition.sourceSeriesId ?? null,
    sourceStatus: definition.sourceStatus ?? 'missing',
    sourceNote: definition.sourceNote ?? null,
  };
}

export function transformPmiMacroSeriesToMonthlyObservations(rows, definition) {
  const monthlyRows = buildMonthlyAverages(rows);
  const rawValueByPeriod = new Map(monthlyRows.map((row) => [row.periodDate, row.rawValue]));
  const transformedValueByPeriod = new Map();
  const validHistory = [];

  return monthlyRows.map((row) => {
    const transformedValue = computeTransformedValue(row.periodDate, row.rawValue, rawValueByPeriod, definition.transform);
    const priorMonthPeriod = addMonths(row.periodDate, -1);
    const previousTransformedValue = transformedValueByPeriod.get(priorMonthPeriod) ?? null;
    const metrics = getMacroMatrixColorMetrics({
      value: transformedValue,
      previousValue: previousTransformedValue,
      ...getColorConfig(definition),
    });

    transformedValueByPeriod.set(row.periodDate, transformedValue);
    if (transformedValue !== null) validHistory.push(transformedValue);

    const zScore36m = transformedValue !== null ? calculateZscore(validHistory) : null;
    const momChange = metrics.momChange === null ? null : normalizeNumber(metrics.momChange);
    const directionScore = scoreDirection(definition, transformedValue, previousTransformedValue, momChange);
    const heatmapScore = zScore36m === null
      ? metrics.heatmapScore
      : clamp(zScore36m / 2, -1, 1);

    return {
      key: definition.key,
      label: definition.label,
      category: definition.category,
      periodDate: row.periodDate,
      rawValue: row.rawValue,
      transformedValue,
      momChange,
      zScore36m,
      directionScore,
      heatmapScore: heatmapScore === null ? null : normalizeNumber(heatmapScore),
      colorBucket: heatmapScore === null ? 'missing' : colorBucketFromHeatmapScore(heatmapScore),
      source: definition.source ?? null,
      sourceSeriesId: definition.sourceSeriesId ?? null,
      sourceStatus: definition.sourceStatus ?? 'active',
      sourceNote: definition.sourceNote ?? null,
    };
  });
}

function getOrderedKeys(observationsByKey) {
  const allKeys = new Set([
    ...MACRO_MATRIX_PMI_GROWTH_DEFINITIONS.map((definition) => definition.key),
    ...Object.keys(observationsByKey),
  ]);

  return [...allKeys].filter((key) => observationsByKey[key] !== undefined || DEFINITION_BY_KEY.has(key));
}

function buildQuarterSummaries(rows, quarterCount) {
  const quarterLookup = new Map();
  for (const row of rows) {
    quarterLookup.set(row.quarterKey, row);
  }

  return [...quarterLookup.values()].slice(-quarterCount);
}

function averageByCategories(cells, categories) {
  return average(
    cells
      .filter((cell) => categories.includes(cell.category) && cell.transformedValue !== null && cell.momChange !== null)
      .map((cell) => cell.directionScore)
  );
}

export function classifyPmiGrowthRegime({
  pmiGrowthScore,
  percentNegative,
  manufacturingPmiScore,
  servicesPmiScore,
  leadingIndicatorsScore,
}) {
  if (pmiGrowthScore === null || pmiGrowthScore === undefined) {
    return { pmiGrowthRegime: 'insufficient_data', pmiGrowthRiskAction: 'WAIT' };
  }

  if (pmiGrowthScore <= -0.5 && percentNegative >= 70) {
    return { pmiGrowthRegime: 'pmi_macro_stress', pmiGrowthRiskAction: 'GO_TO_CASH' };
  }

  if (manufacturingPmiScore < 0 && servicesPmiScore < 0) {
    return { pmiGrowthRegime: 'broad_pmi_contraction', pmiGrowthRiskAction: 'REDUCE_RISK' };
  }

  if (pmiGrowthScore >= 0.35 && manufacturingPmiScore >= 0 && servicesPmiScore >= 0) {
    return { pmiGrowthRegime: 'broad_expansion', pmiGrowthRiskAction: 'RISK_ON' };
  }

  if (manufacturingPmiScore < 0 && servicesPmiScore > 0) {
    return { pmiGrowthRegime: 'services_led_expansion_manufacturing_slowdown', pmiGrowthRiskAction: 'NEUTRAL_TO_RISK_ON' };
  }

  if (manufacturingPmiScore > 0 && servicesPmiScore >= 0 && leadingIndicatorsScore > 0) {
    return { pmiGrowthRegime: 'manufacturing_recovery', pmiGrowthRiskAction: 'RISK_ON' };
  }

  if (pmiGrowthScore <= -0.35) {
    return { pmiGrowthRegime: 'broad_pmi_contraction', pmiGrowthRiskAction: 'REDUCE_RISK' };
  }

  if (pmiGrowthScore <= -0.1) {
    return { pmiGrowthRegime: 'growth_slowdown', pmiGrowthRiskAction: 'NO_NEW_BUYS' };
  }

  if (pmiGrowthScore < 0.35) {
    return { pmiGrowthRegime: 'mixed_neutral', pmiGrowthRiskAction: 'NEUTRAL' };
  }

  return { pmiGrowthRegime: 'mixed_neutral', pmiGrowthRiskAction: 'NEUTRAL' };
}

export function buildMacroMatrixPmiGrowth(observationsByKey, { monthCount = DEFAULT_MONTH_COUNT, quarterCount = DEFAULT_QUARTER_COUNT } = {}) {
  const availableMonths = [...new Set(Object.values(observationsByKey).flatMap((rows) => rows.map((row) => row.periodDate)))].sort((left, right) => left.localeCompare(right));
  const months = availableMonths.slice(-monthCount);
  const orderedKeys = getOrderedKeys(observationsByKey);
  const observationLookupByKey = new Map(
    orderedKeys.map((key) => [key, new Map((observationsByKey[key] ?? []).map((row) => [row.periodDate, row]))])
  );

  const quarterKeys = [...new Set(months.map(getQuarterKey))].slice(-quarterCount);
  const quarters = quarterKeys.map((quarterKey) => ({
    key: quarterKey,
    label: formatQuarterLabel(quarterKey),
    periodDates: months.filter((periodDate) => getQuarterKey(periodDate) === quarterKey),
  }));

  const rows = orderedKeys.map((key) => {
    const definition = DEFINITION_BY_KEY.get(key) ?? (observationsByKey[key]?.[0]
      ? { key, label: observationsByKey[key][0].label, category: observationsByKey[key][0].category }
      : { key, label: key, category: 'macro' });
    const rawCells = months.map((periodDate) => observationLookupByKey.get(key)?.get(periodDate) ?? buildEmptyObservation(key, periodDate));
    const cells = smoothMacroMatrixColorCells(rawCells, { maxStepChange: 1 });

    const quarterlyCells = quarters.map((quarter) => {
      const quarterCells = cells.filter((cell) => quarter.periodDates.includes(cell.periodDate) && cell.transformedValue !== null);
      const transformedValue = average(quarterCells.map((cell) => cell.transformedValue));
      const heatmapScore = average(quarterCells.map((cell) => cell.heatmapScore));
      const directionScore = average(quarterCells.map((cell) => cell.directionScore));

      return {
        quarterKey: quarter.key,
        label: quarter.label,
        transformedValue,
        heatmapScore,
        directionScore,
        colorBucket: colorBucketFromHeatmapScore(heatmapScore),
      };
    });

    const latestCell = cells.at(-1) ?? buildEmptyObservation(key, null);

    return {
      key,
      label: definition.label,
      category: definition.category,
      source: definition.source ?? null,
      sourceSeriesId: definition.sourceSeriesId ?? null,
      sourceStatus: definition.sourceStatus ?? 'active',
      sourceNote: definition.sourceNote ?? null,
      cells,
      quarterlyCells,
      delta: latestCell.momChange,
      deltaDirection: latestCell.momChange === null ? 'flat' : latestCell.momChange > 0 ? 'up' : latestCell.momChange < 0 ? 'down' : 'flat',
    };
  });

  const minimumMeaningfulRowCount = Math.max(3, Math.ceil(rows.length * 0.35));

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
    const pmiGrowthScore = validRowCount ? normalizeNumber(validCells.reduce((sum, cell) => sum + cell.directionScore, 0) / validRowCount) : null;
    const manufacturingPmiScore = averageByCategories(validCells, CATEGORY_GROUPS.manufacturingPmiScore);
    const servicesPmiScore = averageByCategories(validCells, CATEGORY_GROUPS.servicesPmiScore);
    const leadingIndicatorsScore = averageByCategories(validCells, CATEGORY_GROUPS.leadingIndicatorsScore);
    const manufacturingServicesSpread = manufacturingPmiScore !== null && servicesPmiScore !== null
      ? normalizeNumber(servicesPmiScore - manufacturingPmiScore)
      : null;
    const categoryScores = Object.fromEntries(
      Object.entries(CATEGORY_GROUPS).map(([name, categories]) => [name, averageByCategories(validCells, categories)])
    );
    const classification = classifyPmiGrowthRegime({
      pmiGrowthScore,
      percentNegative,
      manufacturingPmiScore,
      servicesPmiScore,
      leadingIndicatorsScore,
    });

    return {
      periodDate,
      validRowCount,
      positiveCount,
      neutralCount,
      negativeCount,
      percentPositive,
      percentNegative,
      pmiGrowthScore,
      manufacturingServicesSpread,
      isPartial: validRowCount < minimumMeaningfulRowCount,
      ...categoryScores,
      ...classification,
    };
  });

  const summaryByQuarter = buildQuarterSummaries(
    quarters.map((quarter) => {
      const quarterMonths = summaryByMonth.filter((item) => quarter.periodDates.includes(item.periodDate));
      return {
        quarterKey: quarter.key,
        label: quarter.label,
        percentPositive: average(quarterMonths.map((item) => item.percentPositive)),
        pmiGrowthScore: average(quarterMonths.map((item) => item.pmiGrowthScore)),
      };
    }),
    quarterCount
  );

  const latestAvailable = summaryByMonth.at(-1) ?? {
    periodDate: null,
    validRowCount: 0,
    positiveCount: 0,
    neutralCount: 0,
    negativeCount: 0,
    percentPositive: null,
    percentNegative: null,
    pmiGrowthScore: null,
    pmiGrowthRegime: 'insufficient_data',
    pmiGrowthRiskAction: 'WAIT',
  };
  const latest = [...summaryByMonth].reverse().find((item) => !item.isPartial && item.validRowCount > 0) ?? latestAvailable;

  return {
    title: 'PMI Growth Momentum',
    description: 'US-first FRED/OECD proxy implementation of the PMI growth momentum matrix. Exact historical PMI subindexes are marked as proxies where no stable free CSV source was found.',
    months,
    quarters,
    rows,
    summaryByMonth,
    summaryByQuarter,
    latestAvailable,
    latest,
    minimumMeaningfulRowCount,
    totalRowCount: orderedKeys.length,
  };
}
