import { formatIndicatorValueForStorage } from '../utils/rolling-indicators.js';

const LOOKBACK_DAYS = [5, 10, 20, 50];
const FORWARD_MODEL_VERSION = 'reference_static_v1';

const BUCKET_PRIORS = {
  breadth_90_100: {
    expected_return_5d: 0.11,
    expected_return_10d: 0.28,
    expected_return_1m: 1.44,
    expected_return_3m: 1.86,
    expected_return_6m: 2.0,
    expected_return_12m: 15.2,
    win_ratio_5d: 57.61,
    win_ratio_10d: 58.7,
    win_ratio_1m: 65.22,
    win_ratio_3m: 63.59,
    win_ratio_6m: 40.22,
    win_ratio_12m: 100.0,
  },
  breadth_80_90: {
    expected_return_5d: 0.23,
    expected_return_10d: 0.47,
    expected_return_1m: 0.6,
    expected_return_3m: 4.53,
    expected_return_6m: 9.26,
    expected_return_12m: 14.13,
    win_ratio_5d: 38.71,
    win_ratio_10d: 43.37,
    win_ratio_1m: 41.31,
    win_ratio_3m: 54.17,
    win_ratio_6m: 61.42,
    win_ratio_12m: 60.47,
  },
  breadth_70_80: {
    expected_return_5d: 0.24,
    expected_return_10d: 0.87,
    expected_return_1m: 2.27,
    expected_return_3m: 4.02,
    expected_return_6m: 4.87,
    expected_return_12m: 7.37,
    win_ratio_5d: 22.63,
    win_ratio_10d: 25.51,
    win_ratio_1m: 27.64,
    win_ratio_3m: 28.48,
    win_ratio_6m: 24.77,
    win_ratio_12m: 22.17,
  },
  breadth_60_70: {
    expected_return_5d: 0.23,
    expected_return_10d: 0.2,
    expected_return_1m: 0.48,
    expected_return_3m: 0.75,
    expected_return_6m: 1.18,
    expected_return_12m: 0.52,
    win_ratio_5d: 21.31,
    win_ratio_10d: 21.19,
    win_ratio_1m: 21.76,
    win_ratio_3m: 25.77,
    win_ratio_6m: 26.58,
    win_ratio_12m: 20.16,
  },
  breadth_50_60: {
    expected_return_5d: -0.01,
    expected_return_10d: -0.07,
    expected_return_1m: 0.31,
    expected_return_3m: 0.96,
    expected_return_6m: 2.38,
    expected_return_12m: 6.72,
    win_ratio_5d: 16.6,
    win_ratio_10d: 16.6,
    win_ratio_1m: 19.24,
    win_ratio_3m: 23.32,
    win_ratio_6m: 23.19,
    win_ratio_12m: 21.21,
  },
  breadth_40_50: {
    expected_return_5d: 0.6,
    expected_return_10d: 1.22,
    expected_return_1m: 1.34,
    expected_return_3m: 2.65,
    expected_return_6m: 5.24,
    expected_return_12m: 7.85,
    win_ratio_5d: 18.14,
    win_ratio_10d: 19.18,
    win_ratio_1m: 18.56,
    win_ratio_3m: 19.18,
    win_ratio_6m: 18.76,
    win_ratio_12m: 17.11,
  },
  breadth_30_40: {
    expected_return_5d: -0.55,
    expected_return_10d: -1.14,
    expected_return_1m: -3.07,
    expected_return_3m: -7.19,
    expected_return_6m: -8.63,
    expected_return_12m: -2.55,
    win_ratio_5d: 17.17,
    win_ratio_10d: 15.06,
    win_ratio_1m: 15.66,
    win_ratio_3m: 11.75,
    win_ratio_6m: 11.75,
    win_ratio_12m: 12.95,
  },
  breadth_20_30: {
    expected_return_5d: -1.0,
    expected_return_10d: -2.0,
    expected_return_1m: -3.36,
    expected_return_3m: -8.13,
    expected_return_6m: -6.99,
    expected_return_12m: 1.21,
    win_ratio_5d: 31.93,
    win_ratio_10d: 28.15,
    win_ratio_1m: 26.47,
    win_ratio_3m: 18.91,
    win_ratio_6m: 24.37,
    win_ratio_12m: 39.08,
  },
  breadth_10_20: {
    expected_return_5d: -0.05,
    expected_return_10d: -0.13,
    expected_return_1m: -0.83,
    expected_return_3m: 0.2,
    expected_return_6m: -0.27,
    expected_return_12m: 4.19,
    win_ratio_5d: 45.32,
    win_ratio_10d: 48.34,
    win_ratio_1m: 45.02,
    win_ratio_3m: 51.06,
    win_ratio_6m: 41.69,
    win_ratio_12m: 61.33,
  },
  breadth_0_10: {
    expected_return_5d: 0.59,
    expected_return_10d: 0.88,
    expected_return_1m: 2.27,
    expected_return_3m: 4.27,
    expected_return_6m: 10.9,
    expected_return_12m: 23.65,
    win_ratio_5d: 52.15,
    win_ratio_10d: 53.59,
    win_ratio_1m: 59.81,
    win_ratio_3m: 69.86,
    win_ratio_6m: 68.42,
    win_ratio_12m: 77.99,
  },
};

function toNumber(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function normalizeNumber(value) {
  const number = toNumber(value);
  if (number === null) {
    return null;
  }

  return Number(formatIndicatorValueForStorage(number));
}

function sortRows(rows) {
  return [...rows].sort((left, right) => left.date.localeCompare(right.date));
}

export function bucketMa200Breadth(percent) {
  const value = toNumber(percent);

  if (value === null || value < 0 || value > 100) {
    return null;
  }

  if (value >= 90) return 'breadth_90_100';
  if (value >= 80) return 'breadth_80_90';
  if (value >= 70) return 'breadth_70_80';
  if (value >= 60) return 'breadth_60_70';
  if (value >= 50) return 'breadth_50_60';
  if (value >= 40) return 'breadth_40_50';
  if (value >= 30) return 'breadth_30_40';
  if (value >= 20) return 'breadth_20_30';
  if (value >= 10) return 'breadth_10_20';
  return 'breadth_0_10';
}

export function getMa200BreadthForwardStats(bucket) {
  return BUCKET_PRIORS[bucket] ? { ...BUCKET_PRIORS[bucket] } : null;
}

function calculateConfidence(bucket, stats) {
  if (!stats) {
    return 'low';
  }

  if (bucket === 'breadth_0_10') {
    if (stats.expected_return_6m >= 8 && stats.win_ratio_6m >= 60) return 'high';
    if (stats.expected_return_3m >= 2 && stats.win_ratio_3m >= 55) return 'medium_high';
    if (stats.expected_return_1m > 0 && stats.win_ratio_1m >= 50) return 'medium';
    return 'low';
  }

  if (bucket === 'breadth_20_30' || bucket === 'breadth_30_40') {
    if (stats.expected_return_3m < -5 || stats.expected_return_6m < -5) return 'high';
    if (stats.expected_return_1m < -2) return 'medium_high';
    return 'medium';
  }

  if (bucket === 'breadth_70_80' || bucket === 'breadth_80_90') {
    return 'medium_high';
  }

  if (bucket === 'breadth_10_20' || bucket === 'breadth_40_50' || bucket === 'breadth_50_60' || bucket === 'breadth_60_70' || bucket === 'breadth_90_100') {
    return 'medium';
  }

  return 'medium';
}

export function classifyMa200BreadthSignal(input) {
  const bucket = input.ma200_breadth_bucket;
  const change10d = toNumber(input.ma200_breadth_10d_change);
  const change20d = toNumber(input.ma200_breadth_20d_change);
  const stats = getMa200BreadthForwardStats(bucket);

  let ma200BreadthSignal = 'NEUTRAL';
  let ma200BreadthAction = 'HOLD';
  let ma200BreadthWarning = null;

  if (bucket === 'breadth_0_10') {
    ma200BreadthSignal = 'CAPITULATION_BUY';
    ma200BreadthAction = 'BUY';
  } else if (bucket === 'breadth_10_20') {
    ma200BreadthSignal = 'EARLY_RECOVERY_WATCH';
    ma200BreadthAction = 'WATCH';

    if (change10d !== null && change20d !== null && change10d > 0 && change20d > 0) {
      ma200BreadthSignal = 'EARLY_RECOVERY_BUY';
      ma200BreadthAction = 'BUY';
    }
  } else if (bucket === 'breadth_20_30') {
    ma200BreadthSignal = 'REDUCE_RISK';
    ma200BreadthAction = 'REDUCE_RISK';
  } else if (bucket === 'breadth_30_40') {
    ma200BreadthSignal = 'NO_NEW_BUYS';
    ma200BreadthAction = 'NO_NEW_BUYS';
    if (change20d !== null && change20d < 0) {
      ma200BreadthAction = 'REDUCE_RISK';
    }
  } else if (bucket === 'breadth_40_50') {
    ma200BreadthSignal = 'NEUTRAL_TO_RISK_ON';
    ma200BreadthAction = 'HOLD';
    if (change20d !== null && change20d > 0) {
      ma200BreadthAction = 'RISK_ON';
    }
  } else if (bucket === 'breadth_50_60' || bucket === 'breadth_60_70') {
    ma200BreadthSignal = 'NEUTRAL';
    ma200BreadthAction = 'HOLD';
  } else if (bucket === 'breadth_70_80' || bucket === 'breadth_80_90') {
    ma200BreadthSignal = 'RISK_ON';
    ma200BreadthAction = 'RISK_ON';
  } else if (bucket === 'breadth_90_100') {
    ma200BreadthSignal = 'BROAD_STRENGTH_RISK_ON';
    ma200BreadthAction = 'RISK_ON';
    if (change20d !== null && change20d < 0) {
      ma200BreadthWarning = 'breadth_stretch_rolling_over';
    }
  }

  return {
    ma200_breadth_signal: ma200BreadthSignal,
    ma200_breadth_action: ma200BreadthAction,
    ma200_breadth_confidence: calculateConfidence(bucket, stats),
    ma200_breadth_warning: ma200BreadthWarning,
  };
}

function calculateChange(rows, index, lookback) {
  if (index < lookback) {
    return null;
  }

  const current = toNumber(rows[index].pct_above_sma200);
  const lookbackValue = toNumber(rows[index - lookback].pct_above_sma200);

  if (current === null || lookbackValue === null) {
    return null;
  }

  return normalizeNumber(current - lookbackValue);
}

export function buildMa200BreadthForwardReturnSignalRows({ breadthRows }) {
  const sortedRows = sortRows(breadthRows);
  const signalRows = [];

  for (let index = 0; index < sortedRows.length; index += 1) {
    const row = sortedRows[index];
    const ma200BreadthPct = toNumber(row.pct_above_sma200);

    if (!row.is_valid_signal_date || ma200BreadthPct === null) {
      continue;
    }

    const ma200BreadthBucket = bucketMa200Breadth(ma200BreadthPct);
    const slopeFields = Object.fromEntries(
      LOOKBACK_DAYS.map((lookback) => [
        `ma200_breadth_${lookback}d_change`,
        calculateChange(sortedRows, index, lookback),
      ])
    );
    const priors = getMa200BreadthForwardStats(ma200BreadthBucket);
    const classification = classifyMa200BreadthSignal({
      ma200_breadth_bucket: ma200BreadthBucket,
      ...slopeFields,
    });

    signalRows.push({
      date: row.date,
      ma200_breadth_pct: normalizeNumber(ma200BreadthPct),
      ma200_breadth_bucket: ma200BreadthBucket,
      ...slopeFields,
      ...classification,
      ma200_expected_return_5d: priors.expected_return_5d,
      ma200_expected_return_10d: priors.expected_return_10d,
      ma200_expected_return_1m: priors.expected_return_1m,
      ma200_expected_return_3m: priors.expected_return_3m,
      ma200_expected_return_6m: priors.expected_return_6m,
      ma200_expected_return_12m: priors.expected_return_12m,
      ma200_win_ratio_5d: priors.win_ratio_5d,
      ma200_win_ratio_10d: priors.win_ratio_10d,
      ma200_win_ratio_1m: priors.win_ratio_1m,
      ma200_win_ratio_3m: priors.win_ratio_3m,
      ma200_win_ratio_6m: priors.win_ratio_6m,
      ma200_win_ratio_12m: priors.win_ratio_12m,
      ma200_forward_model_version: FORWARD_MODEL_VERSION,
    });
  }

  return signalRows;
}
