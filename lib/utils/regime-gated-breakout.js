import {
  buildEarningsCalendarByTicker,
  EARNINGS_POST_WINDOW_MARKET_DAYS,
  EARNINGS_PRE_WINDOW_MARKET_DAYS,
  evaluateEarningsRisk,
} from './earnings-filter.js';
import { formatIndicatorValueForStorage } from './rolling-indicators.js';

export const BREAKOUT_MIN_RELATIVE_VOLUME20 = 1.5;
export const BREAKOUT_MIN_RS_PERCENTILE_63D = 80;
export const BREAKOUT_REQUIRED_QUALITY_GATE_KEYS = [
  'stock_daily_prices_freshness',
  'benchmark_spy_freshness',
  'market_signal_freshness',
  'relative_strength_freshness',
  'stock_daily_price_coverage',
  'relative_strength_coverage',
];

function toNumber(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function normalizeNumber(value) {
  const numeric = toNumber(value);
  if (numeric === null) {
    return null;
  }

  return Number(formatIndicatorValueForStorage(numeric));
}

function countTrue(values) {
  return values.filter(Boolean).length;
}

function buildMarketSignalMap(rows) {
  return new Map(rows.map((row) => [row.date, row]));
}

function buildSectorSignalMap(rows) {
  return new Map(rows.map((row) => [`${row.date}__${row.sector}`, row]));
}

function buildRelativeStrengthMap(rows) {
  return new Map(rows.map((row) => [`${row.date}__${row.ticker}`, row]));
}

function buildQualityGateMap(rows) {
  const byDate = new Map();

  for (const row of rows) {
    const bucket = byDate.get(row.date) ?? new Map();
    bucket.set(row.gate_key, row);
    byDate.set(row.date, bucket);
  }

  return byDate;
}

function evaluateQuality(date, qualityGateByDate) {
  const gateRows = qualityGateByDate.get(date) ?? new Map();
  const missingGateKeys = BREAKOUT_REQUIRED_QUALITY_GATE_KEYS.filter((gateKey) => !gateRows.has(gateKey));
  const blockingGateKeys = [];
  const warningGateKeys = [];
  const gateStatuses = {};

  for (const gateKey of BREAKOUT_REQUIRED_QUALITY_GATE_KEYS) {
    const gateRow = gateRows.get(gateKey);
    const status = gateRow?.status ?? 'missing';
    gateStatuses[gateKey] = status;

    if (status === 'block' || status === 'missing') {
      blockingGateKeys.push(gateKey);
    } else if (status === 'warn') {
      warningGateKeys.push(gateKey);
    }
  }

  const status = blockingGateKeys.length
    ? 'block'
    : warningGateKeys.length
      ? 'warn'
      : 'pass';

  return {
    status,
    missingGateKeys,
    blockingGateKeys,
    warningGateKeys,
    gateStatuses,
  };
}

function evaluateRegime(marketSignalRow) {
  if (!marketSignalRow?.signal) {
    return { confirmed: false, reason: 'missing_market_signal' };
  }

  if (marketSignalRow.signal === 'risk_off') {
    return { confirmed: false, reason: 'market_risk_off' };
  }

  if (marketSignalRow.signal === 'risk_on') {
    return { confirmed: true, reason: 'market_risk_on' };
  }

  return { confirmed: true, reason: 'market_neutral' };
}

function evaluateSector(sectorSignalRow) {
  if (!sectorSignalRow?.signal) {
    return { confirmed: false, reason: 'missing_sector_signal' };
  }

  if (sectorSignalRow.signal === 'leading') {
    return { confirmed: true, reason: 'sector_leading' };
  }

  if (sectorSignalRow.signal === 'improving') {
    return { confirmed: true, reason: 'sector_improving' };
  }

  return {
    confirmed: false,
    reason: `sector_${sectorSignalRow.signal}`,
  };
}

function evaluateVolume(row) {
  const relativeVolume20 = toNumber(row.relative_volume20);
  if (relativeVolume20 === null) {
    return { confirmed: false, reason: 'missing_relative_volume20' };
  }

  if (relativeVolume20 >= BREAKOUT_MIN_RELATIVE_VOLUME20) {
    return { confirmed: true, reason: 'volume_confirmed' };
  }

  return {
    confirmed: false,
    reason: 'volume_below_threshold',
  };
}

function evaluateRelativeStrength(relativeStrengthRow) {
  const percentile = toNumber(relativeStrengthRow?.rs_percentile_63d);

  if (percentile === null) {
    return { confirmed: false, reason: 'missing_rs_percentile_63d' };
  }

  if (percentile >= BREAKOUT_MIN_RS_PERCENTILE_63D) {
    return { confirmed: true, reason: 'rs_confirmed' };
  }

  return {
    confirmed: false,
    reason: 'rs_below_threshold',
  };
}

function buildReasonSummary({
  quality,
  regime,
  sector,
  volume,
  relativeStrength,
  earnings,
}) {
  const parts = [];

  if (quality.blockingGateKeys.length) {
    parts.push(`quality_block:${quality.blockingGateKeys.join(',')}`);
  } else if (quality.warningGateKeys.length) {
    parts.push(`quality_warn:${quality.warningGateKeys.join(',')}`);
  } else {
    parts.push('quality_pass');
  }

  parts.push(regime.reason);
  parts.push(sector.reason);
  parts.push(volume.reason);
  parts.push(relativeStrength.reason);
  parts.push(earnings.reason);

  return parts.join('|');
}

function sortRows(rows) {
  return [...rows].sort((left, right) => {
    const dateCompare = left.date.localeCompare(right.date);
    if (dateCompare !== 0) {
      return dateCompare;
    }

    return left.ticker.localeCompare(right.ticker);
  });
}

export function buildRegimeGatedBreakoutRowsFromSources({
  breakoutRows,
  marketSignalRows,
  sectorSignalRows,
  relativeStrengthRows,
  qualityGateRows,
  earningsCalendarRows = [],
}) {
  const marketSignalByDate = buildMarketSignalMap(marketSignalRows);
  const sectorSignalByDateSector = buildSectorSignalMap(sectorSignalRows);
  const relativeStrengthByDateTicker = buildRelativeStrengthMap(relativeStrengthRows);
  const qualityGateByDate = buildQualityGateMap(qualityGateRows);
  const earningsCalendarByTicker = buildEarningsCalendarByTicker(earningsCalendarRows);

  return sortRows(breakoutRows).map((row) => {
    const marketSignalRow = marketSignalByDate.get(row.date) ?? null;
    const sectorSignalRow = row.sector
      ? sectorSignalByDateSector.get(`${row.date}__${row.sector}`) ?? null
      : null;
    const relativeStrengthRow = relativeStrengthByDateTicker.get(`${row.date}__${row.ticker}`) ?? null;
    const quality = evaluateQuality(row.date, qualityGateByDate);
    const regime = evaluateRegime(marketSignalRow);
    const sector = evaluateSector(sectorSignalRow);
    const volume = evaluateVolume(row);
    const relativeStrength = evaluateRelativeStrength(relativeStrengthRow);
    const earnings = evaluateEarningsRisk({
      date: row.date,
      ticker: row.ticker,
      earningsCalendarByTicker,
    });
    const setupScore = countTrue([
      regime.confirmed,
      sector.confirmed,
      volume.confirmed,
      relativeStrength.confirmed,
    ]);
    const qualifies =
      quality.status !== 'block'
      && !earnings.blocks
      && regime.confirmed
      && sector.confirmed
      && volume.confirmed
      && relativeStrength.confirmed;
    const reasonSummary = buildReasonSummary({
      quality,
      regime,
      sector,
      volume,
      relativeStrength,
      earnings,
    });

    return {
      date: row.date,
      ticker: row.ticker,
      company_name: row.company_name ?? null,
      sector: row.sector ?? null,
      market_signal: marketSignalRow?.signal ?? null,
      market_regime_score: normalizeNumber(marketSignalRow?.market_regime_score),
      sector_signal: sectorSignalRow?.signal ?? null,
      breakout_20d_high: normalizeNumber(row.breakout_20d_high),
      indicator_price: normalizeNumber(row.indicator_price),
      relative_volume20: normalizeNumber(row.relative_volume20),
      rs_63d_vs_spy: normalizeNumber(relativeStrengthRow?.rs_63d_vs_spy),
      rs_rank_63d: relativeStrengthRow?.rs_rank_63d ?? null,
      rs_percentile_63d: normalizeNumber(relativeStrengthRow?.rs_percentile_63d),
      data_quality_status: quality.status,
      regime_confirmed: regime.confirmed,
      sector_confirmed: sector.confirmed,
      volume_confirmed: volume.confirmed,
      rs_confirmed: relativeStrength.confirmed,
      qualifies,
      decision: qualifies ? 'trigger' : 'blocked',
      setup_score: setupScore,
      reason_summary: reasonSummary,
      row_values: {
        breakout_signal: 'buy',
        blocking_gate_keys: quality.blockingGateKeys,
        warning_gate_keys: quality.warningGateKeys,
        missing_gate_keys: quality.missingGateKeys,
        quality_gate_statuses: quality.gateStatuses,
        minimum_relative_volume20: BREAKOUT_MIN_RELATIVE_VOLUME20,
        minimum_rs_percentile_63d: BREAKOUT_MIN_RS_PERCENTILE_63D,
        earnings_filter_status: earnings.status,
        earnings_reason: earnings.reason,
        earnings_date: earnings.earningsDate,
        days_to_earnings: earnings.daysToEarnings,
        earnings_confirmed: earnings.confirmed,
        earnings_source_status: earnings.sourceStatus,
        earnings_snapshot_date: earnings.snapshotDate,
        is_near_earnings: earnings.isNearEarnings,
        safe_to_open_new_position: earnings.safeToOpenNewPosition,
        earnings_pre_window_market_days: EARNINGS_PRE_WINDOW_MARKET_DAYS,
        earnings_post_window_market_days: EARNINGS_POST_WINDOW_MARKET_DAYS,
      },
    };
  });
}
