import { countUsEquityMarketDaysBetween } from './us-market-calendar.js';

export const EARNINGS_PRE_WINDOW_MARKET_DAYS = 5;
export const EARNINGS_POST_WINDOW_MARKET_DAYS = 1;

function normalizeConfirmed(value) {
  if (typeof value === 'boolean') {
    return value;
  }

  if (value === 'true') {
    return true;
  }

  if (value === 'false') {
    return false;
  }

  return null;
}

function findLatestSnapshotRow(rows, signalDate) {
  let low = 0;
  let high = rows.length - 1;
  let bestIndex = -1;

  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    const candidateDate = rows[middle].date;

    if (candidateDate <= signalDate) {
      bestIndex = middle;
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }

  return bestIndex === -1 ? null : rows[bestIndex];
}

export function buildEarningsCalendarByTicker(rows) {
  const byTicker = new Map();

  for (const row of [...rows].sort((left, right) => {
    const tickerCompare = String(left.ticker).localeCompare(String(right.ticker));
    if (tickerCompare !== 0) {
      return tickerCompare;
    }

    return String(left.date).localeCompare(String(right.date));
  })) {
    const bucket = byTicker.get(row.ticker) ?? [];
    bucket.push(row);
    byTicker.set(row.ticker, bucket);
  }

  return byTicker;
}

export function evaluateEarningsRisk({
  date,
  ticker,
  earningsCalendarByTicker,
  preWindowMarketDays = EARNINGS_PRE_WINDOW_MARKET_DAYS,
  postWindowMarketDays = EARNINGS_POST_WINDOW_MARKET_DAYS,
}) {
  const tickerRows = earningsCalendarByTicker.get(ticker) ?? [];
  const snapshotRow = findLatestSnapshotRow(tickerRows, date);

  if (!snapshotRow) {
    return {
      status: 'not_available',
      blocks: false,
      reason: 'earnings_not_available',
      earningsDate: null,
      daysToEarnings: null,
      confirmed: null,
      sourceStatus: null,
      snapshotDate: null,
      isNearEarnings: false,
      safeToOpenNewPosition: true,
    };
  }

  if (snapshotRow.source_status !== 'active' || !snapshotRow.earnings_date) {
    return {
      status: 'unknown',
      blocks: true,
      reason: snapshotRow.source_status === 'error'
        ? 'earnings_source_error'
        : 'earnings_date_missing',
      earningsDate: snapshotRow.earnings_date ?? null,
      daysToEarnings: null,
      confirmed: normalizeConfirmed(snapshotRow.confirmed),
      sourceStatus: snapshotRow.source_status ?? null,
      snapshotDate: snapshotRow.date,
      isNearEarnings: false,
      safeToOpenNewPosition: false,
    };
  }

  const daysToEarnings = countUsEquityMarketDaysBetween(date, snapshotRow.earnings_date);
  const withinPreWindow = daysToEarnings >= 0 && daysToEarnings <= preWindowMarketDays;
  const withinPostWindow = daysToEarnings < 0 && daysToEarnings >= (-postWindowMarketDays);

  if (withinPreWindow) {
    return {
      status: 'blocked',
      blocks: true,
      reason: `earnings_pre_window_${daysToEarnings}d`,
      earningsDate: snapshotRow.earnings_date,
      daysToEarnings,
      confirmed: normalizeConfirmed(snapshotRow.confirmed),
      sourceStatus: snapshotRow.source_status,
      snapshotDate: snapshotRow.date,
      isNearEarnings: true,
      safeToOpenNewPosition: false,
    };
  }

  if (withinPostWindow) {
    return {
      status: 'blocked',
      blocks: true,
      reason: `earnings_post_window_${Math.abs(daysToEarnings)}d`,
      earningsDate: snapshotRow.earnings_date,
      daysToEarnings,
      confirmed: normalizeConfirmed(snapshotRow.confirmed),
      sourceStatus: snapshotRow.source_status,
      snapshotDate: snapshotRow.date,
      isNearEarnings: true,
      safeToOpenNewPosition: false,
    };
  }

  return {
    status: 'clear',
    blocks: false,
    reason: 'earnings_clear',
    earningsDate: snapshotRow.earnings_date,
    daysToEarnings,
    confirmed: normalizeConfirmed(snapshotRow.confirmed),
    sourceStatus: snapshotRow.source_status,
    snapshotDate: snapshotRow.date,
    isNearEarnings: false,
    safeToOpenNewPosition: true,
  };
}
