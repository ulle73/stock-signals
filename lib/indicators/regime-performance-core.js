import { normalizeNumber, sortRowsByDate, toNumber } from './statistics.js';

export const REGIME_KEYS = ['recovery', 'expansion', 'slowdown', 'contraction'];

function average(values) {
  const validValues = values.filter((value) => value !== null && value !== undefined && Number.isFinite(Number(value)));
  if (!validValues.length) return null;
  return normalizeNumber(validValues.reduce((sum, value) => sum + Number(value), 0) / validValues.length);
}

function median(values) {
  const validValues = values
    .filter((value) => value !== null && value !== undefined && Number.isFinite(Number(value)))
    .map(Number)
    .sort((left, right) => left - right);
  if (!validValues.length) return null;

  const middle = Math.floor(validValues.length / 2);
  if (validValues.length % 2) return normalizeNumber(validValues[middle]);

  return normalizeNumber((validValues[middle - 1] + validValues[middle]) / 2);
}

function standardDeviation(values) {
  const validValues = values.filter((value) => value !== null && value !== undefined && Number.isFinite(Number(value))).map(Number);
  if (validValues.length < 2) return null;

  const mean = validValues.reduce((sum, value) => sum + value, 0) / validValues.length;
  const variance = validValues.reduce((sum, value) => sum + ((value - mean) ** 2), 0) / validValues.length;

  return normalizeNumber(Math.sqrt(variance));
}

function covariance(leftValues, rightValues) {
  if (leftValues.length !== rightValues.length || leftValues.length < 2) return null;

  const leftMean = average(leftValues);
  const rightMean = average(rightValues);
  if (leftMean === null || rightMean === null) return null;

  return leftValues.reduce((sum, value, index) => sum + ((value - leftMean) * (rightValues[index] - rightMean)), 0) / leftValues.length;
}

function sourcePrice(row) {
  return toNumber(row.adj_close ?? row.close);
}

function monthKey(date) {
  return `${date.slice(0, 7)}-01`;
}

function getRowsForAsset(dailyRowsByAssetKey, assetKey) {
  if (dailyRowsByAssetKey instanceof Map) return dailyRowsByAssetKey.get(assetKey) ?? [];
  return dailyRowsByAssetKey[assetKey] ?? [];
}

function emptyRegimeStats() {
  return {
    avgReturn: null,
    medianReturn: null,
    volatility: null,
    sharpe: null,
    winRatio: null,
    beta: null,
    observations: 0,
  };
}

function calculateStats(values) {
  const validValues = values.filter((value) => value !== null && value !== undefined && Number.isFinite(Number(value))).map(Number);
  const avgReturn = average(validValues);
  const volatility = standardDeviation(validValues);

  return {
    avgReturn,
    medianReturn: median(validValues),
    volatility,
    sharpe: avgReturn !== null && volatility ? normalizeNumber(avgReturn / volatility) : null,
    winRatio: validValues.length ? normalizeNumber((validValues.filter((value) => value > 0).length / validValues.length) * 100) : null,
    observations: validValues.length,
  };
}

function calculateBeta(assetRows, benchmarkRows) {
  const benchmarkReturnByPeriod = new Map(benchmarkRows.map((row) => [row.periodDate, row.monthlyReturnPct]));
  const assetValues = [];
  const benchmarkValues = [];

  for (const row of assetRows) {
    const benchmarkReturn = benchmarkReturnByPeriod.get(row.periodDate);
    if (row.monthlyReturnPct === null || benchmarkReturn === null || benchmarkReturn === undefined) continue;
    assetValues.push(Number(row.monthlyReturnPct));
    benchmarkValues.push(Number(benchmarkReturn));
  }

  const benchmarkVariance = standardDeviation(benchmarkValues);
  if (!benchmarkVariance) return null;

  const cov = covariance(assetValues, benchmarkValues);
  if (cov === null) return null;

  return normalizeNumber(cov / (benchmarkVariance ** 2));
}

function rankPercentileValues(items, getValue, { lowerIsBetter = false } = {}) {
  const valid = items
    .map((item) => ({ item, value: getValue(item) }))
    .filter(({ value }) => value !== null && value !== undefined && Number.isFinite(Number(value)))
    .sort((left, right) => Number(left.value) - Number(right.value));
  const ranks = new Map();

  if (!valid.length) return ranks;

  for (let index = 0; index < valid.length; index += 1) {
    const percentile = valid.length === 1 ? 1 : index / (valid.length - 1);
    ranks.set(valid[index].item.assetKey, lowerIsBetter ? 1 - percentile : percentile);
  }

  return ranks;
}

export function percentileToBucket(percentile) {
  if (percentile === null || percentile === undefined || !Number.isFinite(Number(percentile))) return 'missing';
  if (percentile >= 0.8) return 'strong_positive';
  if (percentile >= 0.6) return 'positive';
  if (percentile > 0.4) return 'neutral';
  if (percentile > 0.2) return 'negative';
  return 'strong_negative';
}

export function classifyAllocationBias(bucket) {
  if (bucket === 'top_regime_leader') return 'OVERWEIGHT';
  if (bucket === 'positive_regime_fit') return 'SLIGHT_OVERWEIGHT';
  if (bucket === 'weak_regime_fit') return 'UNDERWEIGHT';
  if (bucket === 'avoid_regime_laggard') return 'AVOID';
  return 'NEUTRAL';
}

export function calculateMonthlyReturnsFromDailyRows(assetDefinitions, dailyRowsByAssetKey) {
  const monthlyReturns = [];

  for (const asset of assetDefinitions) {
    const dailyRows = sortRowsByDate(getRowsForAsset(dailyRowsByAssetKey, asset.key));
    const monthlyLastRows = new Map();

    for (const row of dailyRows) {
      const closeValue = sourcePrice(row);
      if (!row.date || closeValue === null) continue;
      monthlyLastRows.set(monthKey(row.date), { periodDate: monthKey(row.date), closeValue });
    }

    const sortedMonthlyRows = [...monthlyLastRows.values()].sort((left, right) => left.periodDate.localeCompare(right.periodDate));
    let previousClose = null;

    for (const row of sortedMonthlyRows) {
      const monthlyReturnPct = previousClose && previousClose !== 0
        ? normalizeNumber(((row.closeValue / previousClose) - 1) * 100)
        : null;

      monthlyReturns.push({
        assetKey: asset.key,
        assetName: asset.label,
        assetGroup: asset.group ?? asset.assetType ?? 'asset',
        region: asset.region ?? 'global',
        source: asset.source ?? 'yahoo',
        sourceSymbol: asset.sourceSymbol ?? null,
        sourceStatus: asset.sourceStatus ?? 'active',
        periodDate: row.periodDate,
        closeValue: row.closeValue,
        monthlyReturnPct,
      });
      previousClose = row.closeValue;
    }
  }

  return monthlyReturns;
}

export function mapDetailedRegimeToFourRegimes(item, previousItem = null) {
  const detailedRegime = item?.pmiGrowthRegime ?? item?.macroGrowthRegime ?? item?.growthBaseEffectRegime ?? item?.regime;
  const score = item?.pmiGrowthScore ?? item?.macroGrowthScore ?? item?.growthMomentumScore ?? item?.sourceScore ?? null;
  const previousScore = previousItem?.pmiGrowthScore ?? previousItem?.macroGrowthScore ?? previousItem?.growthMomentumScore ?? previousItem?.sourceScore ?? null;

  if (['broad_expansion', 'global_pmi_expansion', 'europe_growth_improving', 'growth_expansion_improving'].includes(detailedRegime)) return 'expansion';
  if (['manufacturing_recovery', 'confirmed_recovery', 'early_recovery'].includes(detailedRegime)) return 'recovery';
  if (['broad_pmi_contraction', 'pmi_macro_stress', 'global_pmi_contraction', 'europe_growth_contraction', 'broad_growth_contraction', 'growth_macro_stress'].includes(detailedRegime)) return 'contraction';
  if (['services_led_expansion_manufacturing_slowdown', 'growth_slowdown', 'global_pmi_deteriorating', 'europe_growth_deteriorating', 'growth_deteriorating', 'growth_falling_hard_base'].includes(detailedRegime)) return 'slowdown';

  if (score !== null && previousScore !== null && Number(score) > Number(previousScore)) return 'recovery';
  if (score !== null && Number(score) >= 0.2) return 'expansion';
  if (score !== null && Number(score) <= -0.35) return 'contraction';

  return 'slowdown';
}

export function mapMacroRegimeLabels(summaryByMonth, sourceIndicator = 'macro_matrix_pmi_growth') {
  const sorted = [...summaryByMonth].sort((left, right) => left.periodDate.localeCompare(right.periodDate));
  return sorted.map((item, index) => ({
    periodDate: item.periodDate,
    regime: mapDetailedRegimeToFourRegimes(item, sorted[index - 1] ?? null),
    sourceIndicator,
    sourceScore: item.pmiGrowthScore ?? item.macroGrowthScore ?? item.growthMomentumScore ?? null,
  }));
}

export function calculateRegimePerformanceStats(assetDefinitions, monthlyReturns, regimes, { benchmarkAssetKey = 'sp500' } = {}) {
  const regimeByPeriod = new Map(regimes.map((row) => [row.periodDate, row.regime]));
  const returnsWithRegimes = monthlyReturns
    .map((row) => ({ ...row, regime: regimeByPeriod.get(row.periodDate) ?? null }))
    .filter((row) => row.regime && row.monthlyReturnPct !== null);
  const benchmarkRows = returnsWithRegimes.filter((row) => row.assetKey === benchmarkAssetKey);

  return assetDefinitions.map((asset) => {
    const assetRows = returnsWithRegimes.filter((row) => row.assetKey === asset.key);
    const regimeStats = Object.fromEntries(REGIME_KEYS.map((regime) => {
      const rows = assetRows.filter((row) => row.regime === regime);
      const stats = calculateStats(rows.map((row) => row.monthlyReturnPct));
      const benchmarkRegimeRows = benchmarkRows.filter((row) => row.regime === regime);
      return [regime, {
        ...emptyRegimeStats(),
        ...stats,
        beta: calculateBeta(rows, benchmarkRegimeRows),
      }];
    }));

    return {
      assetKey: asset.key,
      assetName: asset.label,
      assetGroup: asset.group ?? asset.assetType ?? 'asset',
      assetType: asset.assetType ?? asset.group ?? 'asset',
      region: asset.region ?? 'global',
      source: asset.source ?? 'yahoo',
      sourceSymbol: asset.sourceSymbol ?? null,
      sourceStatus: asset.sourceStatus ?? 'active',
      regimeStats,
    };
  });
}

export function scoreAssetsForCurrentRegime(statsRows, currentRegime) {
  const avgRanks = rankPercentileValues(statsRows, (row) => row.regimeStats[currentRegime]?.avgReturn);
  const medianRanks = rankPercentileValues(statsRows, (row) => row.regimeStats[currentRegime]?.medianReturn);
  const sharpeRanks = rankPercentileValues(statsRows, (row) => row.regimeStats[currentRegime]?.sharpe);
  const winRanks = rankPercentileValues(statsRows, (row) => row.regimeStats[currentRegime]?.winRatio);
  const volatilityRanks = rankPercentileValues(statsRows, (row) => row.regimeStats[currentRegime]?.volatility, { lowerIsBetter: true });

  const scoredRows = statsRows.map((row) => {
    const parts = [avgRanks, medianRanks, sharpeRanks, winRanks, volatilityRanks]
      .map((rankMap) => rankMap.get(row.assetKey))
      .filter((value) => value !== null && value !== undefined && Number.isFinite(Number(value)));
    const currentRegimeScore = parts.length
      ? normalizeNumber(
        (0.35 * (avgRanks.get(row.assetKey) ?? 0)) +
        (0.20 * (medianRanks.get(row.assetKey) ?? 0)) +
        (0.20 * (sharpeRanks.get(row.assetKey) ?? 0)) +
        (0.15 * (winRanks.get(row.assetKey) ?? 0)) +
        (0.10 * (volatilityRanks.get(row.assetKey) ?? 0))
      )
      : null;

    return { ...row, currentRegimeScore };
  });

  const scoreRanks = rankPercentileValues(scoredRows, (row) => row.currentRegimeScore);
  const sortedByScore = [...scoredRows]
    .filter((row) => row.currentRegimeScore !== null)
    .sort((left, right) => Number(right.currentRegimeScore) - Number(left.currentRegimeScore));
  const rankByAssetKey = new Map(sortedByScore.map((row, index) => [row.assetKey, index + 1]));

  return scoredRows.map((row) => {
    const rankPercentile = scoreRanks.get(row.assetKey) ?? null;
    const currentRegimeBucket = rankPercentile === null
      ? 'insufficient_data'
      : rankPercentile >= 0.8
        ? 'top_regime_leader'
        : rankPercentile >= 0.6
          ? 'positive_regime_fit'
          : rankPercentile > 0.4
            ? 'neutral_regime_fit'
            : rankPercentile > 0.2
              ? 'weak_regime_fit'
              : 'avoid_regime_laggard';

    return {
      ...row,
      currentRegimeRank: rankByAssetKey.get(row.assetKey) ?? null,
      currentRegimeRankPercentile: rankPercentile,
      currentRegimeBucket,
      allocationBias: classifyAllocationBias(currentRegimeBucket),
    };
  });
}

function getMetricBucketMaps(statsRows, regime, metric, { lowerIsBetter = false } = {}) {
  const ranks = rankPercentileValues(statsRows, (row) => row.regimeStats[regime]?.[metric], { lowerIsBetter });
  return new Map([...ranks.entries()].map(([assetKey, percentile]) => [assetKey, percentileToBucket(percentile)]));
}

export function buildRegimePerformanceMatrix({ assetDefinitions, monthlyReturns, regimes, currentRegime, benchmarkAssetKey = 'sp500' }) {
  const statsRows = calculateRegimePerformanceStats(assetDefinitions, monthlyReturns, regimes, { benchmarkAssetKey });
  const scoredRows = scoreAssetsForCurrentRegime(statsRows, currentRegime);
  const metricBucketMapsByRegime = new Map(REGIME_KEYS.map((regime) => [regime, {
    avgReturn: getMetricBucketMaps(scoredRows, regime, 'avgReturn'),
    medianReturn: getMetricBucketMaps(scoredRows, regime, 'medianReturn'),
    volatility: getMetricBucketMaps(scoredRows, regime, 'volatility', { lowerIsBetter: true }),
    sharpe: getMetricBucketMaps(scoredRows, regime, 'sharpe'),
    winRatio: getMetricBucketMaps(scoredRows, regime, 'winRatio'),
    beta: getMetricBucketMaps(scoredRows, regime, 'beta', { lowerIsBetter: true }),
  }]));

  const rows = scoredRows.map((row) => ({
    key: row.assetKey,
    label: row.assetName,
    assetGroup: row.assetGroup,
    assetType: row.assetType,
    region: row.region,
    source: row.source,
    sourceSymbol: row.sourceSymbol,
    sourceStatus: row.sourceStatus,
    regimeCells: REGIME_KEYS.map((regime) => ({
      regime,
      ...row.regimeStats[regime],
      colorBucket: metricBucketMapsByRegime.get(regime)?.avgReturn?.get(row.assetKey) ?? 'missing',
      metricBuckets: {
        avgReturn: metricBucketMapsByRegime.get(regime)?.avgReturn?.get(row.assetKey) ?? 'missing',
        medianReturn: metricBucketMapsByRegime.get(regime)?.medianReturn?.get(row.assetKey) ?? 'missing',
        volatility: metricBucketMapsByRegime.get(regime)?.volatility?.get(row.assetKey) ?? 'missing',
        sharpe: metricBucketMapsByRegime.get(regime)?.sharpe?.get(row.assetKey) ?? 'missing',
        winRatio: metricBucketMapsByRegime.get(regime)?.winRatio?.get(row.assetKey) ?? 'missing',
        beta: metricBucketMapsByRegime.get(regime)?.beta?.get(row.assetKey) ?? 'missing',
      },
    })),
    currentRegimeScore: row.currentRegimeScore,
    currentRegimeRank: row.currentRegimeRank,
    currentRegimeBucket: row.currentRegimeBucket,
    allocationBias: row.allocationBias,
    confidence: row.regimeStats[currentRegime]?.observations >= 12
      ? 'high'
      : row.regimeStats[currentRegime]?.observations >= 6
        ? 'normal'
        : 'low',
  }));

  return {
    regimes: REGIME_KEYS,
    currentRegime,
    benchmarkAssetKey,
    rows,
    availableRowCount: rows.filter((row) => row.regimeCells.some((cell) => cell.observations > 0)).length,
    totalRowCount: assetDefinitions.length,
    topRows: [...rows].filter((row) => row.currentRegimeRank !== null).sort((left, right) => left.currentRegimeRank - right.currentRegimeRank).slice(0, 5),
    bottomRows: [...rows].filter((row) => row.currentRegimeRank !== null).sort((left, right) => right.currentRegimeRank - left.currentRegimeRank).slice(0, 5),
  };
}
