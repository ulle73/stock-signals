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

export const MACRO_MATRIX_GROWTH_DATA_BASE_EFFECTS_DEFINITIONS = [
  { key: 'economic_tendency_indicator_total', label: 'Economic Tendency Indicator Total', category: 'broad_cycle', source: 'fred', sourceSeriesId: 'BSCICP02USM460S', sourceStatus: 'active', transform: 'raw', direction: 'neutral_level', neutralLevel: 0 },
  { key: 'economic_tendency_indicator_construction', label: 'Economic Tendency Indicator Construction', category: 'construction', source: 'fred', sourceSeriesId: 'TTLCONS', sourceStatus: 'active', transform: 'yoy', direction: 'higher_is_better' },
  { key: 'composite_leading_indicators_yoy', label: 'Composite Leading Indicators %Y/Y', category: 'leading_indicators', source: 'fred', sourceSeriesId: 'USALOLITOAASTSAM', sourceStatus: 'active', transform: 'yoy', direction: 'higher_is_better' },
  { key: 'cli_manufacturing_order_books', label: 'CLI Manufacturing - Order Books', category: 'manufacturing_leading', source: 'fred', sourceSeriesId: 'BSOBLV02USM460S', sourceStatus: 'active', transform: 'raw', direction: 'neutral_level', neutralLevel: 0 },
  { key: 'cli_services_demand_expectations', label: 'CLI Services - Demand Expectations', category: 'services_leading', source: 'fred', sourceSeriesId: 'USABNODTE02STSAM', sourceStatus: 'legacy', transform: 'raw', direction: 'neutral_level', neutralLevel: 0 },
  { key: 'export_yoy', label: 'Export %Y/Y', category: 'trade', source: 'fred', sourceSeriesId: 'BOPTEXP', sourceStatus: 'active', transform: 'yoy', direction: 'higher_is_better' },
  { key: 'import_yoy', label: 'Import %Y/Y', category: 'trade', source: 'fred', sourceSeriesId: 'BOPTIMP', sourceStatus: 'active', transform: 'yoy', direction: 'higher_is_better' },
  { key: 'industrial_production_mining_mfg_yoy', label: 'Industrial Production %Y/Y Mining & MFG %Y/Y', category: 'production', source: 'fred', sourceSeriesId: 'IPMAN', sourceStatus: 'active', transform: 'yoy', direction: 'higher_is_better' },
  { key: 'new_motor_vehicle_registrations_yoy', label: 'New Motor Vehicle Registrations %Y/Y', category: 'cyclical_consumption', source: 'fred', sourceSeriesId: 'TOTALSA', sourceStatus: 'active', transform: 'yoy', direction: 'higher_is_better' },
  { key: 'retail_sales_ex_vehicles_yoy', label: 'Retail Sales excl. Vehicles %Y/Y', category: 'consumption', source: 'fred', sourceSeriesId: 'RSFSXMV', sourceStatus: 'active', transform: 'yoy', direction: 'higher_is_better' },
  { key: 'consumer_confidence_survey_ki', label: 'Consumer Confidence Survey KI SA', category: 'sentiment', source: 'fred', sourceSeriesId: 'UMCSENT', sourceStatus: 'proxy', transform: 'raw', direction: 'neutral_level', neutralLevel: 100 },
  { key: 'manufacturing_pmi_total', label: 'Manufacturing PMI Total SA', category: 'manufacturing_pmi', source: 'fred', sourceSeriesId: 'BSCICP02USM460S', sourceStatus: 'proxy', transform: 'raw', direction: 'neutral_level', neutralLevel: 0 },
  { key: 'manufacturing_pmi_new_orders', label: 'Manufacturing PMI New Orders SA', category: 'manufacturing_pmi', source: 'fred', sourceSeriesId: 'BSOBLV02USM460S', sourceStatus: 'proxy', transform: 'raw', direction: 'neutral_level', neutralLevel: 0 },
  { key: 'manufacturing_pmi_production', label: 'Manufacturing PMI Production SA', category: 'manufacturing_pmi', source: 'fred', sourceSeriesId: 'IPMAN', sourceStatus: 'proxy', transform: 'yoy', direction: 'higher_is_better' },
  { key: 'service_pmi_new_orders', label: 'Service PMI New Orders SA', category: 'services_pmi', source: 'fred', sourceSeriesId: 'USABNODTE02STSAM', sourceStatus: 'legacy_proxy', transform: 'raw', direction: 'neutral_level', neutralLevel: 0 },
  { key: 'service_pmi_business_activity', label: 'Service PMI Business Activity SA', category: 'services_pmi', source: 'fred', sourceSeriesId: 'PCES', sourceStatus: 'proxy', transform: 'yoy', direction: 'higher_is_better' },
  { key: 'service_pmi_total', label: 'Service PMI Total SA', category: 'services_pmi', source: 'fred', sourceSeriesId: 'SRVPRD', sourceStatus: 'proxy', transform: 'yoy', direction: 'higher_is_better' },
];

const DEFINITION_BY_KEY = new Map(MACRO_MATRIX_GROWTH_DATA_BASE_EFFECTS_DEFINITIONS.map((definition) => [definition.key, definition]));
const CATEGORY_GROUPS = {
  broadCycleScore: ['broad_cycle', 'construction'],
  leadingIndicatorsScore: ['leading_indicators', 'manufacturing_leading', 'services_leading'],
  manufacturingScore: ['manufacturing_pmi'],
  servicesScore: ['services_pmi'],
  tradeScore: ['trade'],
  productionScore: ['production'],
  consumptionScore: ['consumption', 'cyclical_consumption'],
  sentimentScore: ['sentiment'],
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

  if (momChange > 0) return 1;
  if (momChange < 0) return -1;
  return 0;
}

export function classifyBaseEffectRegime(baseEffectScore) {
  if (baseEffectScore === null || baseEffectScore === undefined) {
    return { baseEffectRegime: 'insufficient_data', confidence: 'normal' };
  }

  if (baseEffectScore <= -0.75) {
    return { baseEffectRegime: 'easy_comparisons', confidence: 'medium_positive_may_be_overstated' };
  }

  if (baseEffectScore >= 0.75) {
    return { baseEffectRegime: 'hard_comparisons', confidence: 'medium_negative_may_be_overstated' };
  }

  return { baseEffectRegime: 'normal_comparisons', confidence: 'normal' };
}

function classifyBaseEffectBucket(baseEffectZ36m) {
  if (baseEffectZ36m === null || baseEffectZ36m === undefined) return null;
  if (baseEffectZ36m <= -0.75) return 'easy_base';
  if (baseEffectZ36m >= 0.75) return 'hard_base';
  return 'normal_base';
}

export function classifyGrowthDataBaseEffectRegime({
  growthMomentumScore,
  percentPositive,
  percentNegative,
  baseEffectRegime,
}) {
  if (growthMomentumScore === null || growthMomentumScore === undefined) {
    return { growthBaseEffectRegime: 'insufficient_data', growthBaseEffectRiskAction: 'WAIT' };
  }

  if (growthMomentumScore <= -0.5 && percentNegative >= 70) {
    return { growthBaseEffectRegime: 'growth_macro_stress', growthBaseEffectRiskAction: 'GO_TO_CASH' };
  }

  if (growthMomentumScore <= -0.35 || percentNegative >= 60) {
    return { growthBaseEffectRegime: 'broad_growth_contraction', growthBaseEffectRiskAction: 'REDUCE_RISK' };
  }

  if (growthMomentumScore >= 0.35 && percentPositive >= 60) {
    return { growthBaseEffectRegime: 'growth_expansion_improving', growthBaseEffectRiskAction: 'RISK_ON' };
  }

  if (growthMomentumScore >= 0.1 && baseEffectRegime === 'easy_comparisons') {
    return { growthBaseEffectRegime: 'growth_positive_easy_base', growthBaseEffectRiskAction: 'NEUTRAL_TO_RISK_ON' };
  }

  if (growthMomentumScore <= -0.1 && baseEffectRegime === 'hard_comparisons') {
    return { growthBaseEffectRegime: 'growth_falling_hard_base', growthBaseEffectRiskAction: 'NEUTRAL' };
  }

  if (growthMomentumScore <= -0.1) {
    return { growthBaseEffectRegime: 'growth_deteriorating', growthBaseEffectRiskAction: 'NO_NEW_BUYS' };
  }

  return { growthBaseEffectRegime: 'mixed_neutral', growthBaseEffectRiskAction: 'NEUTRAL' };
}

export function transformGrowthDataBaseEffectSeriesToMonthlyObservations(rows, definition) {
  const monthlyRows = buildMonthlyAverages(rows);
  const rawValueByPeriod = new Map(monthlyRows.map((row) => [row.periodDate, row.rawValue]));
  const transformedValueByPeriod = new Map();
  const validTransformedHistory = [];
  const validBaseHistory = [];

  return monthlyRows.map((row) => {
    const transformedValue = computeTransformedValue(row.periodDate, row.rawValue, rawValueByPeriod, definition.transform);
    const previousTransformedValue = transformedValueByPeriod.get(addMonths(row.periodDate, -1)) ?? null;
    const metrics = getMacroMatrixColorMetrics({
      value: transformedValue,
      previousValue: previousTransformedValue,
      ...getColorConfig(definition),
    });

    transformedValueByPeriod.set(row.periodDate, transformedValue);
    if (transformedValue !== null) validTransformedHistory.push(transformedValue);

    const baseValue12mAgo = definition.transform === 'yoy'
      ? rawValueByPeriod.get(addMonths(row.periodDate, -12)) ?? null
      : null;
    if (baseValue12mAgo !== null) validBaseHistory.push(baseValue12mAgo);

    const zScore36m = transformedValue !== null ? calculateZscore(validTransformedHistory) : null;
    const baseEffectZ36m = baseValue12mAgo !== null ? calculateZscore(validBaseHistory) : null;
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
      baseValue12mAgo,
      baseEffectZ36m,
      baseEffectBucket: classifyBaseEffectBucket(baseEffectZ36m),
      directionScore,
      heatmapScore: heatmapScore === null ? null : normalizeNumber(heatmapScore),
      colorBucket: heatmapScore === null ? 'missing' : colorBucketFromHeatmapScore(heatmapScore),
      source: definition.source ?? null,
      sourceSeriesId: definition.sourceSeriesId ?? null,
      sourceStatus: definition.sourceStatus ?? 'active',
    };
  });
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
    baseValue12mAgo: null,
    baseEffectZ36m: null,
    baseEffectBucket: null,
    directionScore: 0,
    heatmapScore: null,
    colorBucket: 'missing',
    source: definition.source ?? null,
    sourceSeriesId: definition.sourceSeriesId ?? null,
    sourceStatus: definition.sourceStatus ?? 'missing',
  };
}

function getOrderedKeys(observationsByKey) {
  const allKeys = new Set([
    ...MACRO_MATRIX_GROWTH_DATA_BASE_EFFECTS_DEFINITIONS.map((definition) => definition.key),
    ...Object.keys(observationsByKey),
  ]);

  return [...allKeys].filter((key) => observationsByKey[key] !== undefined || DEFINITION_BY_KEY.has(key));
}

function averageByCategories(cells, categories) {
  return average(
    cells
      .filter((cell) => categories.includes(cell.category) && cell.transformedValue !== null && cell.momChange !== null)
      .map((cell) => cell.directionScore)
  );
}

export function buildGrowthDataBaseEffectsMatrix(observationsByKey, { monthCount = DEFAULT_MONTH_COUNT, quarterCount = DEFAULT_QUARTER_COUNT } = {}) {
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
    const definition = DEFINITION_BY_KEY.get(key) ?? { key, label: key, category: 'macro' };
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
    const growthMomentumScore = validRowCount ? normalizeNumber(validCells.reduce((sum, cell) => sum + cell.directionScore, 0) / validRowCount) : null;
    const baseEffectScore = average(validCells.map((cell) => cell.baseEffectZ36m));
    const baseEffect = classifyBaseEffectRegime(baseEffectScore);
    const categoryScores = Object.fromEntries(
      Object.entries(CATEGORY_GROUPS).map(([name, categories]) => [name, averageByCategories(validCells, categories)])
    );
    const classification = classifyGrowthDataBaseEffectRegime({
      growthMomentumScore,
      percentPositive,
      percentNegative,
      baseEffectRegime: baseEffect.baseEffectRegime,
    });

    return {
      periodDate,
      validRowCount,
      positiveCount,
      neutralCount,
      negativeCount,
      percentPositive,
      percentNegative,
      growthMomentumScore,
      baseEffectScore,
      isPartial: validRowCount < minimumMeaningfulRowCount,
      ...categoryScores,
      ...baseEffect,
      ...classification,
    };
  });

  const summaryByQuarter = quarters.map((quarter) => {
    const quarterMonths = summaryByMonth.filter((item) => quarter.periodDates.includes(item.periodDate));
    return {
      quarterKey: quarter.key,
      label: quarter.label,
      percentPositive: average(quarterMonths.map((item) => item.percentPositive)),
      growthMomentumScore: average(quarterMonths.map((item) => item.growthMomentumScore)),
      baseEffectScore: average(quarterMonths.map((item) => item.baseEffectScore)),
    };
  });

  const latestAvailable = summaryByMonth.at(-1) ?? {
    periodDate: null,
    validRowCount: 0,
    positiveCount: 0,
    neutralCount: 0,
    negativeCount: 0,
    percentPositive: null,
    percentNegative: null,
    growthMomentumScore: null,
    baseEffectScore: null,
    baseEffectRegime: 'insufficient_data',
    confidence: 'normal',
    growthBaseEffectRegime: 'insufficient_data',
    growthBaseEffectRiskAction: 'WAIT',
  };
  const latest = [...summaryByMonth].reverse().find((item) => !item.isPartial && item.validRowCount > 0) ?? latestAvailable;

  return {
    title: 'Growth Data Base Effects',
    description: 'Growth momentum matrix with base-effect classification for YoY rows. US-first FRED/OECD implementation with explicit proxy rows where exact Nordic/PMI sources are unavailable.',
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
