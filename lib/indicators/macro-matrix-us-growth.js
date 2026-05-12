import { normalizeNumber, sortRowsByDate, toNumber } from './statistics.js';

const DEFAULT_MONTH_COUNT = 14;
const DEFAULT_QUARTER_COUNT = 4;
const MIN_ZSCORE_HISTORY = 24;
const MAX_ZSCORE_HISTORY = 36;

export const MACRO_MATRIX_US_GROWTH_DEFINITIONS = [
  { key: 'exports_yoy', label: 'Exports Y/Y %', category: 'trade', seriesId: 'BOPTEXP', frequency: 'monthly', transform: 'yoy', direction: 'higher_is_better' },
  { key: 'imports_yoy', label: 'Imports Y/Y %', category: 'trade', seriesId: 'BOPTIMP', frequency: 'monthly', transform: 'yoy', direction: 'higher_is_better' },
  { key: 'exports_goods_yoy_proxy', label: 'Exports of Goods Y/Y %', category: 'trade', seriesId: 'BOPGEXP', frequency: 'monthly', transform: 'yoy', direction: 'higher_is_better' },
  { key: 'imports_goods_yoy_proxy', label: 'Imports of Goods Y/Y %', category: 'trade', seriesId: 'BOPGIMP', frequency: 'monthly', transform: 'yoy', direction: 'higher_is_better' },
  { key: 'industrial_production_yoy', label: 'Industrial Production Y/Y %', category: 'production', seriesId: 'INDPRO', frequency: 'monthly', transform: 'yoy', direction: 'higher_is_better' },
  { key: 'retail_sales_food_services_yoy', label: 'Retail Sales & Food Services Y/Y %', category: 'consumption', seriesId: 'RSAFS', frequency: 'monthly', transform: 'yoy', direction: 'higher_is_better' },
  { key: 'retail_sales_ex_motor_parts_yoy', label: 'Retail Sales Ex Motor Vehicles & Parts Y/Y %', category: 'consumption', seriesId: 'RSFSXMV', frequency: 'monthly', transform: 'yoy', direction: 'higher_is_better' },
  { key: 'total_vehicle_sales_yoy_proxy', label: 'Vehicle Sales Y/Y %', category: 'consumption', seriesId: 'TOTALSA', frequency: 'monthly', transform: 'yoy', direction: 'higher_is_better' },
  { key: 'nonfarm_payrolls_yoy', label: 'Non-Farm Payrolls Y/Y %', category: 'labor', seriesId: 'PAYEMS', frequency: 'monthly', transform: 'yoy', direction: 'higher_is_better' },
  { key: 'initial_jobless_claims_yoy', label: 'Initial Jobless Claims Y/Y %', category: 'labor', seriesId: 'ICSA', frequency: 'weekly', transform: 'yoy', direction: 'lower_is_better' },
  { key: 'business_inventories_yoy', label: 'Business Inventories Y/Y %', category: 'inventory', seriesId: 'BUSINV', frequency: 'monthly', transform: 'yoy', direction: 'inventory' },
  { key: 'new_orders_durable_goods_yoy', label: 'Durable Goods Orders Y/Y %', category: 'production', seriesId: 'DGORDER', frequency: 'monthly', transform: 'yoy', direction: 'higher_is_better' },
  { key: 'capacity_utilization_rate', label: 'Capacity Utilization Rate', category: 'production', seriesId: 'TCU', frequency: 'monthly', transform: 'raw', direction: 'higher_is_better' },
  { key: 'pce_yoy', label: 'PCE Y/Y %', category: 'inflation', seriesId: 'PCEPI', frequency: 'monthly', transform: 'yoy', direction: 'inflation' },
  { key: 'core_pce_yoy', label: 'Core PCE Y/Y %', category: 'inflation', seriesId: 'PCEPILFE', frequency: 'monthly', transform: 'yoy', direction: 'inflation' },
  { key: 'personal_income_yoy', label: 'Personal Income Y/Y %', category: 'income', seriesId: 'PI', frequency: 'monthly', transform: 'yoy', direction: 'higher_is_better' },
  { key: 'personal_saving_rate', label: 'Personal Saving Rate', category: 'consumer_balance_sheet', seriesId: 'PSAVERT', frequency: 'monthly', transform: 'raw', direction: 'higher_is_better' },
  { key: 'm2_money_supply_yoy', label: 'M2 Money Supply Y/Y %', category: 'liquidity', seriesId: 'M2SL', frequency: 'monthly', transform: 'yoy', direction: 'higher_is_better' },
  { key: 'm1_money_supply_yoy', label: 'M1 Money Supply Y/Y %', category: 'liquidity', seriesId: 'M1SL', frequency: 'monthly', transform: 'yoy', direction: 'higher_is_better' },
  { key: 'consumer_sentiment_michigan', label: 'Michigan Consumer Sentiment', category: 'sentiment', seriesId: 'UMCSENT', frequency: 'monthly', transform: 'raw', direction: 'higher_is_better' },
  { key: 'philadelphia_fed_general_activity', label: 'Philadelphia Fed General Activity', category: 'regional_survey', seriesId: 'GACDFSA066MSFRBPHI', frequency: 'monthly', transform: 'raw', direction: 'higher_is_better' },
  { key: 'oecd_leading_indicator_us_yoy_proxy', label: 'OECD Leading Indicator Y/Y %', category: 'leading_indicators', seriesId: 'USALOLITONOSTSAM', frequency: 'monthly', transform: 'yoy', direction: 'higher_is_better' },
  { key: 'ism_manufacturing_index_candidate', label: 'ISM Manufacturing Index', category: 'survey', seriesId: 'NAPM', frequency: 'monthly', transform: 'raw', direction: 'pmi' },
  { key: 'ism_manufacturing_new_orders_candidate', label: 'ISM Manufacturing New Orders', category: 'survey', seriesId: 'NAPMNOI', frequency: 'monthly', transform: 'raw', direction: 'pmi' },
  { key: 'ism_manufacturing_production_candidate', label: 'ISM Manufacturing Production', category: 'survey', seriesId: 'NAPMPI', frequency: 'monthly', transform: 'raw', direction: 'pmi' },
  { key: 'manufacturers_inventories_yoy', label: 'Manufacturers Inventories Y/Y %', category: 'inventory', seriesId: 'AMTMTI', frequency: 'monthly', transform: 'yoy', direction: 'inventory' },
];

const DEFINITION_BY_KEY = new Map(MACRO_MATRIX_US_GROWTH_DEFINITIONS.map((definition) => [definition.key, definition]));

function average(values) {
  if (!values.length) {
    return null;
  }

  return normalizeNumber(values.reduce((sum, value) => sum + value, 0) / values.length);
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
  const nextYear = utcDate.getUTCFullYear();
  const nextMonth = String(utcDate.getUTCMonth() + 1).padStart(2, '0');
  return `${nextYear}-${nextMonth}-01`;
}

function getQuarterKey(periodDate) {
  const [year, month] = periodDate.split('-').map(Number);
  const quarter = Math.floor((month - 1) / 3) + 1;
  return `${year}-Q${quarter}`;
}

function formatQuarterLabel(quarterKey) {
  const [year, quarter] = quarterKey.split('-');
  return `${quarter}-${year.slice(-2)}`;
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
  };
}

function calculateZscore(validHistory) {
  if (validHistory.length < MIN_ZSCORE_HISTORY) {
    return null;
  }

  const window = validHistory.slice(-MAX_ZSCORE_HISTORY);
  const currentValue = window.at(-1);
  const mean = window.reduce((sum, value) => sum + value, 0) / window.length;
  const variance = window.reduce((sum, value) => sum + ((value - mean) ** 2), 0) / window.length;
  const standardDeviation = Math.sqrt(variance);

  if (!Number.isFinite(standardDeviation) || standardDeviation === 0) {
    return null;
  }

  return normalizeNumber((currentValue - mean) / standardDeviation);
}

function computeTransformedValue(periodDate, rawValue, rawValueByPeriod, transform) {
  if (rawValue === null) {
    return null;
  }

  if (transform === 'raw') {
    return rawValue;
  }

  if (transform !== 'yoy') {
    return rawValue;
  }

  const priorYearValue = rawValueByPeriod.get(addMonths(periodDate, -12));
  if (priorYearValue === null || priorYearValue === undefined || priorYearValue === 0) {
    return null;
  }

  return normalizeNumber(((rawValue / priorYearValue) - 1) * 100);
}

function computeDirectionScore(direction, currentValue, momChange) {
  if (currentValue === null) {
    return 0;
  }

  if (direction === 'inflation') {
    if (currentValue >= 3 && momChange !== null && momChange < 0) return 1;
    if (currentValue >= 3 && momChange !== null && momChange > 0) return -1;
    if (currentValue >= 1 && currentValue < 3) return 0;
    if (currentValue < 1) return -1;
    return 0;
  }

  if (direction === 'pmi') {
    if (momChange === null) return 0;
    if (currentValue >= 50 && momChange > 0) return 1;
    if (currentValue >= 50 && momChange <= 0) return 0;
    if (currentValue < 50 && momChange > 0) return 0;
    return -1;
  }

  if (direction === 'higher_is_better') {
    if (momChange === null || momChange === 0) return 0;
    return momChange > 0 ? 1 : -1;
  }

  if (direction === 'lower_is_better') {
    if (momChange === null || momChange === 0) return 0;
    return momChange < 0 ? 1 : -1;
  }

  return 0;
}

function computeHeatmapScore(direction, directionScore, zScore) {
  if (zScore !== null) {
    const signedScore = direction === 'lower_is_better'
      ? zScore * -1
      : zScore;
    return normalizeNumber(clamp(signedScore / 2, -1, 1));
  }

  return directionScore;
}

function toColorBucket(score) {
  if (score === null || score === undefined) return 'missing';
  if (score >= 0.6) return 'strong_positive';
  if (score >= 0.2) return 'positive';
  if (score > -0.2) return 'neutral';
  if (score > -0.6) return 'negative';
  return 'strong_negative';
}

function buildMonthlyAverages(rows) {
  const groupedValues = new Map();

  for (const row of sortRowsByDate(rows)) {
    const value = toNumber(row.value);
    if (value === null) {
      continue;
    }

    const periodDate = getMonthStart(row.date);
    const currentValues = groupedValues.get(periodDate) ?? [];
    currentValues.push(value);
    groupedValues.set(periodDate, currentValues);
  }

  return [...groupedValues.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([periodDate, values]) => ({
      periodDate,
      rawValue: average(values),
    }));
}

export function transformMacroSeriesToMonthlyObservations(rows, definition) {
  const monthlyRows = buildMonthlyAverages(rows);
  const rawValueByPeriod = new Map(monthlyRows.map((row) => [row.periodDate, row.rawValue]));
  const transformedValueByPeriod = new Map();
  const validHistory = [];

  return monthlyRows.map((row) => {
    const transformedValue = computeTransformedValue(row.periodDate, row.rawValue, rawValueByPeriod, definition.transform);
    const priorMonthPeriod = addMonths(row.periodDate, -1);
    const previousTransformedValue = transformedValueByPeriod.get(priorMonthPeriod);
    const momChange = transformedValue !== null && previousTransformedValue !== undefined && previousTransformedValue !== null
      ? normalizeNumber(transformedValue - previousTransformedValue)
      : null;

    transformedValueByPeriod.set(row.periodDate, transformedValue);

    if (transformedValue !== null) {
      validHistory.push(transformedValue);
    }

    const zScore36m = transformedValue !== null ? calculateZscore(validHistory) : null;
    const directionScore = computeDirectionScore(definition.direction, transformedValue, momChange);
    const heatmapScore = computeHeatmapScore(definition.direction, directionScore, zScore36m);

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
      heatmapScore,
      colorBucket: toColorBucket(heatmapScore),
    };
  });
}

function applyInventoryOverride(observation, retailObservation) {
  if (!observation || observation.transformedValue === null) {
    return observation;
  }

  let directionScore = 0;
  if (observation.momChange !== null && retailObservation?.momChange !== null) {
    if (observation.momChange > 0 && retailObservation.momChange < 0) {
      directionScore = -1;
    } else if (observation.momChange < 0 && retailObservation.momChange >= 0) {
      directionScore = 1;
    }
  }

  const heatmapScore = observation.zScore36m === null ? directionScore : observation.heatmapScore;
  return {
    ...observation,
    directionScore,
    heatmapScore,
    colorBucket: toColorBucket(heatmapScore),
  };
}

function getOrderedKeys(observationsByKey) {
  const allKeys = new Set([
    ...MACRO_MATRIX_US_GROWTH_DEFINITIONS.map((definition) => definition.key),
    ...Object.keys(observationsByKey),
  ]);

  return [...allKeys].filter((key) => observationsByKey[key] !== undefined);
}

function buildQuarterSummaries(rows, quarterCount) {
  const quarterLookup = new Map();
  for (const row of rows) {
    quarterLookup.set(row.quarterKey, row);
  }

  return [...quarterLookup.values()].slice(-quarterCount);
}

export function classifyMacroGrowthRegime({ macroGrowthScore, percentPositive, percentNegative }) {
  if (macroGrowthScore === null || percentPositive === null || percentNegative === null) {
    return {
      macroGrowthRegime: 'insufficient_data',
      macroGrowthRiskAction: 'WAIT',
    };
  }

  if (macroGrowthScore <= -0.5 && percentNegative >= 70) {
    return {
      macroGrowthRegime: 'macro_stress',
      macroGrowthRiskAction: 'GO_TO_CASH',
    };
  }

  if (macroGrowthScore >= 0.35 && percentPositive >= 60) {
    return {
      macroGrowthRegime: 'expansion_improving',
      macroGrowthRiskAction: 'RISK_ON',
    };
  }

  if (macroGrowthScore >= 0.1 && percentPositive >= 50) {
    return {
      macroGrowthRegime: 'growth_stable_positive',
      macroGrowthRiskAction: 'NEUTRAL_TO_RISK_ON',
    };
  }

  if (macroGrowthScore > -0.1) {
    return {
      macroGrowthRegime: 'mixed_neutral',
      macroGrowthRiskAction: 'NEUTRAL',
    };
  }

  if (macroGrowthScore <= -0.35 || percentNegative >= 60) {
    return {
      macroGrowthRegime: 'broad_macro_contraction',
      macroGrowthRiskAction: 'REDUCE_RISK',
    };
  }

  return {
    macroGrowthRegime: 'growth_deteriorating',
    macroGrowthRiskAction: 'NO_NEW_BUYS',
  };
}

export function buildMacroMatrixUsGrowth(
  observationsByKey,
  { monthCount = DEFAULT_MONTH_COUNT, quarterCount = DEFAULT_QUARTER_COUNT } = {}
) {
  const availableMonths = [...new Set(
    Object.values(observationsByKey)
      .flatMap((rows) => rows.map((row) => row.periodDate))
  )].sort((left, right) => left.localeCompare(right));
  const months = availableMonths.slice(-monthCount);
  const orderedKeys = getOrderedKeys(observationsByKey);

  const observationLookupByKey = new Map(
    orderedKeys.map((key) => [
      key,
      new Map((observationsByKey[key] ?? []).map((row) => [row.periodDate, row])),
    ])
  );

  const quarterKeys = [...new Set(months.map(getQuarterKey))].slice(-quarterCount);
  const quarters = quarterKeys.map((quarterKey) => ({
    key: quarterKey,
    label: formatQuarterLabel(quarterKey),
    periodDates: months.filter((periodDate) => getQuarterKey(periodDate) === quarterKey),
  }));

  const rows = orderedKeys.map((key) => {
    const definition = DEFINITION_BY_KEY.get(key) ?? (observationsByKey[key]?.[0]
      ? {
        key,
        label: observationsByKey[key][0].label,
        category: observationsByKey[key][0].category,
      }
      : { key, label: key, category: 'macro' });
    const retailLookup = observationLookupByKey.get('retail_sales_food_services_yoy') ?? observationLookupByKey.get('retail_sales_ex_motor_parts_yoy');

    const cells = months.map((periodDate) => {
      const observation = observationLookupByKey.get(key)?.get(periodDate) ?? buildEmptyObservation(key, periodDate);

      if (definition.direction !== 'inventory') {
        return observation;
      }

      return applyInventoryOverride(observation, retailLookup?.get(periodDate) ?? null);
    });

    const quarterlyCells = quarters.map((quarter) => {
      const quarterCells = cells.filter((cell) => quarter.periodDates.includes(cell.periodDate) && cell.transformedValue !== null);
      const transformedValue = average(quarterCells.map((cell) => cell.transformedValue));
      const heatmapScore = average(quarterCells.map((cell) => cell.heatmapScore).filter((value) => value !== null));
      const directionScore = average(quarterCells.map((cell) => cell.directionScore));
      return {
        quarterKey: quarter.key,
        label: quarter.label,
        transformedValue,
        heatmapScore,
        directionScore,
        colorBucket: toColorBucket(heatmapScore ?? directionScore),
      };
    });

    const latestCell = cells.at(-1) ?? buildEmptyObservation(key, null);

    return {
      key,
      label: definition.label,
      category: definition.category,
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
      .filter((cell) => cell.transformedValue !== null);
    const positiveCount = validCells.filter((cell) => cell.directionScore > 0).length;
    const negativeCount = validCells.filter((cell) => cell.directionScore < 0).length;
    const neutralCount = validCells.filter((cell) => cell.directionScore === 0).length;
    const validRowCount = validCells.length;
    const percentPositive = validRowCount ? normalizeNumber((positiveCount / validRowCount) * 100) : null;
    const percentNegative = validRowCount ? normalizeNumber((negativeCount / validRowCount) * 100) : null;
    const macroGrowthScore = validRowCount
      ? normalizeNumber(validCells.reduce((sum, cell) => sum + cell.directionScore, 0) / validRowCount)
      : null;
    const classification = classifyMacroGrowthRegime({ macroGrowthScore, percentPositive, percentNegative });

    return {
      periodDate,
      validRowCount,
      positiveCount,
      neutralCount,
      negativeCount,
      percentPositive,
      percentNegative,
      macroGrowthScore,
      isPartial: validRowCount < minimumMeaningfulRowCount,
      ...classification,
    };
  });

  const summaryByQuarter = buildQuarterSummaries(
    quarters.map((quarter) => {
      const quarterMonths = summaryByMonth.filter((item) => quarter.periodDates.includes(item.periodDate));
      return {
        quarterKey: quarter.key,
        label: quarter.label,
        percentPositive: average(quarterMonths.map((item) => item.percentPositive).filter((value) => value !== null)),
        macroGrowthScore: average(quarterMonths.map((item) => item.macroGrowthScore).filter((value) => value !== null)),
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
    macroGrowthScore: null,
    macroGrowthRegime: 'insufficient_data',
    macroGrowthRiskAction: 'WAIT',
  };
  const latest = [...summaryByMonth].reverse().find((item) => !item.isPartial && item.validRowCount > 0) ?? latestAvailable;

  return {
    months,
    quarters,
    rows,
    summaryByMonth,
    summaryByQuarter,
    latestAvailable,
    latest,
    minimumMeaningfulRowCount,
  };
}
