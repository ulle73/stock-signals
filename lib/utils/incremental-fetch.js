const YAHOO_INCREMENTAL_OVERLAP_DAYS = 7;
const FRED_INCREMENTAL_OVERLAP_DAYS = 3;

function toDateAtUtcMidnight(dateString) {
  return new Date(`${dateString}T00:00:00.000Z`);
}

function toIsoDate(date) {
  return date.toISOString().slice(0, 10);
}

export function addDays(dateString, days) {
  const date = toDateAtUtcMidnight(dateString);
  date.setUTCDate(date.getUTCDate() + days);
  return toIsoDate(date);
}

export function hasYahooDailyRangeOverride(env = process.env) {
  return Boolean(env.YAHOO_DAILY_RANGE?.trim());
}

export function buildYahooFetchRequest({
  latestDate,
  fallbackRange,
  hasRangeOverride,
  now = new Date(),
  overlapDays = YAHOO_INCREMENTAL_OVERLAP_DAYS,
}) {
  if (!latestDate || hasRangeOverride) {
    return { range: fallbackRange };
  }

  const startDate = addDays(latestDate, -overlapDays);
  const period1 = Math.floor(toDateAtUtcMidnight(startDate).getTime() / 1000);
  const period2Date = new Date(now);
  period2Date.setUTCDate(period2Date.getUTCDate() + 1);
  period2Date.setUTCHours(0, 0, 0, 0);

  return {
    period1,
    period2: Math.floor(period2Date.getTime() / 1000),
  };
}

export function filterIncrementalRows(rows, latestDate, overlapDays = FRED_INCREMENTAL_OVERLAP_DAYS) {
  if (!latestDate) {
    return rows;
  }

  const cutoffDate = addDays(latestDate, -overlapDays);
  return rows.filter((row) => row.date >= cutoffDate);
}

export {
  FRED_INCREMENTAL_OVERLAP_DAYS,
  YAHOO_INCREMENTAL_OVERLAP_DAYS,
};
