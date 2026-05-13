import { normalizeNumber, sortRowsByDate, toNumber } from './statistics.js';

const ANNUALISATION_FACTOR = Math.sqrt(252);
const REALISED_VOLATILITY_WINDOW = 30;
const REALISED_VOLATILITY_SHARP_RISE_LOOKBACK = 5;
const REALISED_VOLATILITY_SHARP_RISE_MULTIPLE = 1.2;
const REALISED_VOLATILITY_SHARP_RISE_ABSOLUTE = 2;
const ZSCORE_WINDOW = 252;
const ZSCORE_MIN_OBSERVATIONS = 126;
const LOOKBACK_ONE_WEEK = 5;

function clamp(value, minimum, maximum) {
  return Math.min(Math.max(value, minimum), maximum);
}

function average(values) {
  if (!values.length) {
    return null;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function calculatePopulationStandardDeviation(values) {
  if (!values.length) {
    return null;
  }

  const mean = average(values);
  const variance = values.reduce((sum, value) => sum + ((value - mean) ** 2), 0) / values.length;
  return Math.sqrt(variance);
}

function getIndicatorPrice(row) {
  return toNumber(row.adj_close ?? row.close);
}

function calculateRollingAverage(values, length) {
  if (values.length < length) {
    return null;
  }

  const window = values.slice(-length);
  if (window.some((value) => value === null)) {
    return null;
  }

  return normalizeNumber(average(window));
}

function calculateRangePosition(values, currentValue, length) {
  if (values.length < length || currentValue === null) {
    return null;
  }

  const window = values.slice(-length);
  if (window.some((value) => value === null)) {
    return null;
  }

  const minimum = Math.min(...window);
  const maximum = Math.max(...window);

  if (maximum === minimum) {
    return null;
  }

  return normalizeNumber((currentValue - minimum) / (maximum - minimum));
}

function classifyRvolBucket(rvol20d) {
  if (rvol20d === null) {
    return null;
  }

  if (rvol20d < 0.75) {
    return 'low_rvol';
  }

  if (rvol20d <= 1.5) {
    return 'normal_rvol';
  }

  return 'high_rvol';
}

function classifyTrendRegime({ closeAboveMa20, closeAboveMa50, closeAboveMa200, ma20Slope20d }) {
  if (closeAboveMa20 && ma20Slope20d !== null && ma20Slope20d > 0) {
    return 'short_term_uptrend';
  }

  if (closeAboveMa50 && closeAboveMa200) {
    return 'medium_term_uptrend';
  }

  if (closeAboveMa20 === false && ma20Slope20d !== null && ma20Slope20d < 0) {
    return 'short_term_downtrend';
  }

  return 'neutral_trend';
}

function classifyRangeBucket(rangePosition20d) {
  if (rangePosition20d === null) {
    return null;
  }

  if (rangePosition20d >= 0.7) {
    return 'upper_range';
  }

  if (rangePosition20d <= 0.3) {
    return 'lower_range';
  }

  return 'middle_range';
}

function getIvolRvolLevel(zScore) {
  if (zScore === null) {
    return 'normal';
  }

  if (zScore >= 2) {
    return 'very_high';
  }

  if (zScore >= 1) {
    return 'high';
  }

  if (zScore <= -1) {
    return 'low';
  }

  return 'normal';
}

function calculateOpportunityScore(row) {
  const normalizedZScore = row.ivol_rvol_ratio_z_1y === null
    ? 0
    : clamp((row.ivol_rvol_ratio_z_1y + 3) / 6, 0, 1);
  const trendScore = row.close_above_ma20 && row.ma20_slope_20d !== null && row.ma20_slope_20d > 0 ? 1 : 0;
  const rangeScore = clamp(toNumber(row.range_position_20d) ?? 0, 0, 1);
  const lowRvolScore = row.rvol_20d !== null && row.rvol_20d < 0.75 ? 1 : 0;
  const volPremiumEasingScore = row.ivol_rvol_ratio_z_1w_change !== null && row.ivol_rvol_ratio_z_1w_change < 0 ? 1 : 0;

  return normalizeNumber(clamp(
    (35 * normalizedZScore)
    + (20 * trendScore)
    + (15 * rangeScore)
    + (15 * lowRvolScore)
    + (15 * volPremiumEasingScore),
    0,
    100
  ));
}

export function calculateRealisedVolatility30d(rows) {
  const sortedRows = sortRowsByDate(rows);
  const priceHistory = [];
  const volumeHistory = [];
  const logReturnHistory = [];
  const realisedVolatilityHistory = [];
  const ma20History = [];
  const ma50History = [];

  return sortedRows.map((row) => {
    const indicatorPrice = getIndicatorPrice(row);
    const currentVolume = toNumber(row.volume);
    const previousPrice = priceHistory.at(-1);
    const logReturn = indicatorPrice !== null && previousPrice !== null && indicatorPrice > 0 && previousPrice > 0
      ? Math.log(indicatorPrice / previousPrice)
      : null;

    priceHistory.push(indicatorPrice);
    volumeHistory.push(currentVolume);
    logReturnHistory.push(logReturn);

    const validLogReturns = logReturnHistory.slice(-REALISED_VOLATILITY_WINDOW);
    const realisedVolatility30d = validLogReturns.length === REALISED_VOLATILITY_WINDOW && validLogReturns.every((value) => value !== null)
      ? normalizeNumber(calculatePopulationStandardDeviation(validLogReturns) * ANNUALISATION_FACTOR * 100)
      : null;
    realisedVolatilityHistory.push(realisedVolatility30d);

    const ma20 = calculateRollingAverage(priceHistory, 20);
    const ma50 = calculateRollingAverage(priceHistory, 50);
    const ma200 = calculateRollingAverage(priceHistory, 200);
    ma20History.push(ma20);
    ma50History.push(ma50);

    const ma20Slope20d = ma20 !== null && ma20History.length > 20 && ma20History.at(-21) !== null
      ? normalizeNumber(ma20 - ma20History.at(-21))
      : null;
    const ma50Slope20d = ma50 !== null && ma50History.length > 20 && ma50History.at(-21) !== null
      ? normalizeNumber(ma50 - ma50History.at(-21))
      : null;

    const avgVolume20 = calculateRollingAverage(volumeHistory, 20);
    const rvol20d = avgVolume20 !== null && avgVolume20 !== 0 && currentVolume !== null
      ? normalizeNumber(currentVolume / avgVolume20)
      : null;

    const rangePosition20d = calculateRangePosition(priceHistory, indicatorPrice, 20);

    const closeAboveMa20 = indicatorPrice !== null && ma20 !== null ? indicatorPrice > ma20 : null;
    const closeAboveMa50 = indicatorPrice !== null && ma50 !== null ? indicatorPrice > ma50 : null;
    const closeAboveMa200 = indicatorPrice !== null && ma200 !== null ? indicatorPrice > ma200 : null;

    const realisedVolatility30d5dAgo = realisedVolatilityHistory.length > LOOKBACK_ONE_WEEK
      ? realisedVolatilityHistory.at(-(LOOKBACK_ONE_WEEK + 1))
      : null;
    const realisedVolatility30d5dChange = realisedVolatility30d !== null && realisedVolatility30d5dAgo !== null
      ? normalizeNumber(realisedVolatility30d - realisedVolatility30d5dAgo)
      : null;
    const realisedVolatility30dRisingSharply =
      realisedVolatility30d !== null
      && realisedVolatility30d5dAgo !== null
      && realisedVolatility30d5dChange !== null
      && realisedVolatility30d > (realisedVolatility30d5dAgo * REALISED_VOLATILITY_SHARP_RISE_MULTIPLE)
      && realisedVolatility30d5dChange >= REALISED_VOLATILITY_SHARP_RISE_ABSOLUTE;

    return {
      ...row,
      indicator_price: indicatorPrice,
      realised_volatility_30d: realisedVolatility30d,
      realised_volatility_30d_5d_change: realisedVolatility30d5dChange,
      realised_volatility_30d_rising_sharply: realisedVolatility30dRisingSharply,
      rvol_20d: rvol20d,
      rvol_bucket: classifyRvolBucket(rvol20d),
      close_above_ma20: closeAboveMa20,
      close_above_ma50: closeAboveMa50,
      close_above_ma200: closeAboveMa200,
      ma20_slope_20d: ma20Slope20d,
      ma50_slope_20d: ma50Slope20d,
      trend_regime: classifyTrendRegime({
        closeAboveMa20,
        closeAboveMa50,
        closeAboveMa200,
        ma20Slope20d,
      }),
      range_position_20d: rangePosition20d,
      range_bucket: classifyRangeBucket(rangePosition20d),
    };
  });
}

export function calculateIvolRvolRatio(rows) {
  const sortedRows = sortRowsByDate(rows);

  return sortedRows.map((row) => {
    const impliedVolatility = toNumber(row.implied_volatility);
    const realisedVolatility30d = toNumber(row.realised_volatility_30d);
    const ivolRvolRatio =
      impliedVolatility !== null
      && realisedVolatility30d !== null
      && realisedVolatility30d > 0
        ? normalizeNumber(impliedVolatility / realisedVolatility30d)
        : null;

    return {
      ...row,
      implied_volatility: impliedVolatility,
      ivol_rvol_ratio: ivolRvolRatio,
    };
  });
}

export function calculateIvolRvolZScore(rows) {
  const sortedRows = sortRowsByDate(rows);
  const validHistory = [];

  const baseRows = sortedRows.map((row) => {
    const ratio = toNumber(row.ivol_rvol_ratio);

    if (ratio !== null) {
      validHistory.push(ratio);
    }

    const window = validHistory.slice(-ZSCORE_WINDOW);
    const stdev = calculatePopulationStandardDeviation(window);
    const zScore =
      ratio !== null
      && window.length >= ZSCORE_MIN_OBSERVATIONS
      && stdev !== null
      && stdev !== 0
        ? normalizeNumber((ratio - average(window)) / stdev)
        : null;

    return {
      ...row,
      ivol_rvol_ratio: ratio,
      ivol_rvol_ratio_z_1y: zScore,
    };
  });

  return baseRows.map((row, index) => {
    const oneWeekAgoRow = index >= LOOKBACK_ONE_WEEK ? baseRows[index - LOOKBACK_ONE_WEEK] : null;
    const zScoreWindow = baseRows
      .slice(Math.max(0, index - (ZSCORE_WINDOW - 1)), index + 1)
      .map((item) => item.ivol_rvol_ratio_z_1y)
      .filter((value) => value !== null);
    const zScore1wAgo = oneWeekAgoRow?.ivol_rvol_ratio_z_1y ?? null;

    return {
      ...row,
      ivol_rvol_ratio_z_1w_ago: zScore1wAgo,
      ivol_rvol_ratio_z_1w_change:
        row.ivol_rvol_ratio_z_1y !== null && zScore1wAgo !== null
          ? normalizeNumber(row.ivol_rvol_ratio_z_1y - zScore1wAgo)
          : null,
      ivol_rvol_ratio_z_1y_min: zScoreWindow.length ? normalizeNumber(Math.min(...zScoreWindow)) : null,
      ivol_rvol_ratio_z_1y_max: zScoreWindow.length ? normalizeNumber(Math.max(...zScoreWindow)) : null,
    };
  });
}

export function classifyIvolRvolSignal(row) {
  const ivolRvolLevel = getIvolRvolLevel(toNumber(row.ivol_rvol_ratio_z_1y));
  const rangePosition20d = toNumber(row.range_position_20d);
  const zScore = toNumber(row.ivol_rvol_ratio_z_1y);
  const zChange = toNumber(row.ivol_rvol_ratio_z_1w_change);
  const rvol20d = toNumber(row.rvol_20d);

  let signal = 'NEUTRAL_VOLATILITY';
  let action = 'HOLD';

  if (
    zScore !== null
    && zScore >= 2
    && rvol20d !== null
    && rvol20d < 0.75
    && row.realised_volatility_30d_rising_sharply !== true
    && rangePosition20d !== null
    && rangePosition20d >= 0.5
    && row.close_above_ma20 === true
  ) {
    signal = 'SHORT_SQUEEZE_SETUP';
    action = 'WATCH_OR_BUY';

    if (
      row.close_above_ma50 === true
      && toNumber(row.ma20_slope_20d) !== null
      && toNumber(row.ma20_slope_20d) > 0
      && zChange !== null
      && zChange <= 0
    ) {
      signal = 'SHORT_SQUEEZE_BUY';
      action = 'BUY';
    }
  } else if (
    zScore !== null
    && zScore >= 2
    && row.close_above_ma20 === false
    && toNumber(row.ma20_slope_20d) !== null
    && toNumber(row.ma20_slope_20d) < 0
    && rangePosition20d !== null
    && rangePosition20d <= 0.5
  ) {
    signal = 'HIGH_IVOL_RVOL_RISK_OFF';
    action = 'NO_NEW_BUYS';
  } else if (
    zScore !== null
    && zScore <= -1
    && row.close_above_ma20 === false
    && toNumber(row.ma20_slope_20d) !== null
    && toNumber(row.ma20_slope_20d) < 0
  ) {
    signal = 'COMPLACENCY_BREAKDOWN_RISK';
    action = 'REDUCE_RISK';
  }

  return {
    ivol_rvol_level: ivolRvolLevel,
    signal,
    action,
    opportunity_score: calculateOpportunityScore(row),
  };
}

export function rankIvolRvolAssets(rows) {
  const scorableRows = rows
    .filter((row) => row.source_status === 'active' && toNumber(row.ivol_rvol_ratio_z_1y) !== null)
    .sort((left, right) => toNumber(right.ivol_rvol_ratio_z_1y) - toNumber(left.ivol_rvol_ratio_z_1y));
  const totalScorable = scorableRows.length;
  const rankByAssetKey = new Map(
    scorableRows.map((row, index) => ([
      row.asset_key,
      {
        ivol_rvol_rank: index + 1,
        ivol_rvol_percentile: normalizeNumber(((totalScorable - index) / totalScorable) * 100),
      },
    ]))
  );

  return rows.map((row) => ({
    ...row,
    ivol_rvol_rank: rankByAssetKey.get(row.asset_key)?.ivol_rvol_rank ?? null,
    ivol_rvol_percentile: rankByAssetKey.get(row.asset_key)?.ivol_rvol_percentile ?? null,
  }));
}

function buildRowValues(row) {
  return {
    asset_key: row.asset_key,
    asset_name: row.asset_name,
    ivol_rvol_ratio_z_1y: row.ivol_rvol_ratio_z_1y,
    ivol_rvol_ratio_z_1w_ago: row.ivol_rvol_ratio_z_1w_ago,
    ivol_rvol_ratio_z_1y_min: row.ivol_rvol_ratio_z_1y_min,
    ivol_rvol_ratio_z_1y_max: row.ivol_rvol_ratio_z_1y_max,
    rvol_bucket: row.rvol_bucket,
    trend_regime: row.trend_regime,
    range_bucket: row.range_bucket,
    signal: row.signal,
    action: row.action,
  };
}

export function buildImpliedVolatilityRatioSignalRows(rows) {
  const rowsByAssetKey = new Map();

  for (const row of rows) {
    const assetRows = rowsByAssetKey.get(row.asset_key) ?? [];
    assetRows.push(row);
    rowsByAssetKey.set(row.asset_key, assetRows);
  }

  const perAssetRows = [...rowsByAssetKey.values()].flatMap((assetRows) => {
    const realisedVolatilityRows = calculateRealisedVolatility30d(assetRows);
    const ratioRows = calculateIvolRvolRatio(realisedVolatilityRows);
    const zScoreRows = calculateIvolRvolZScore(ratioRows);

    return zScoreRows.map((row) => {
      const sourceStatus = row.source_status ?? (row.implied_volatility === null ? 'missing' : 'active');
      const signalFields = classifyIvolRvolSignal(row);

      return {
        ...row,
        source_status: sourceStatus,
        ...signalFields,
      };
    });
  });

  const rowsByDate = new Map();

  for (const row of perAssetRows) {
    const dateRows = rowsByDate.get(row.date) ?? [];
    dateRows.push(row);
    rowsByDate.set(row.date, dateRows);
  }

  return [...rowsByDate.entries()]
    .sort((left, right) => left[0].localeCompare(right[0]))
    .flatMap(([, dateRows]) => {
      const rankedRows = rankIvolRvolAssets(dateRows);

      return rankedRows.map((row) => ({
        ...row,
        row_values: buildRowValues(row),
      }));
    });
}
