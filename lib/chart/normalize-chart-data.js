const MOVING_AVERAGE_KEYS = Object.freeze(['sma5', 'sma10', 'sma20', 'sma50', 'sma200']);

function finiteNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function round(value, digits = 6) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function isValidDailyDate(value) {
  const match = String(value ?? '').match(/^(?<year>\d{4})-(?<month>\d{2})-(?<day>\d{2})$/);
  if (!match?.groups) return false;

  const year = Number(match.groups.year);
  const month = Number(match.groups.month);
  const day = Number(match.groups.day);
  const date = new Date(Date.UTC(year, month - 1, day));

  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day;
}

function adjustmentFactor(rawClose, adjustedClose) {
  if (rawClose === null || adjustedClose === null || rawClose === 0) return 1;
  const factor = adjustedClose / rawClose;
  return Number.isFinite(factor) && factor > 0 ? factor : 1;
}

function normalizedBar(row) {
  if (!isValidDailyDate(row.date)) return null;

  const rawOpen = finiteNumber(row.open);
  const rawHigh = finiteNumber(row.high);
  const rawLow = finiteNumber(row.low);
  const rawClose = finiteNumber(row.close);
  const adjustedClose = finiteNumber(row.adj_close);

  if ([rawOpen, rawHigh, rawLow, rawClose].some((value) => value === null)) {
    return null;
  }

  const factor = adjustmentFactor(rawClose, adjustedClose);
  const bar = {
    time: String(row.date),
    open: round(rawOpen * factor),
    high: round(rawHigh * factor),
    low: round(rawLow * factor),
    close: round(adjustedClose ?? rawClose),
    volume: Math.max(0, finiteNumber(row.volume) ?? 0),
  };

  for (const key of MOVING_AVERAGE_KEYS) {
    const value = finiteNumber(row[key]);
    if (value !== null) bar[key] = round(value);
  }

  return bar;
}

export function normalizeChartRows({ ticker, company, period, rows = [] }) {
  const byDate = new Map();

  for (const row of rows) {
    const bar = normalizedBar(row);
    if (bar) byDate.set(bar.time, bar);
  }

  const bars = [...byDate.values()].sort((left, right) => left.time.localeCompare(right.time));
  const latest = bars.at(-1) ?? null;
  const previous = bars.at(-2) ?? null;
  const dailyChange = latest && previous ? round(latest.close - previous.close, 4) : null;
  const dailyChangePct = dailyChange !== null && previous.close !== 0
    ? round((dailyChange / previous.close) * 100, 4)
    : null;

  return {
    ticker,
    companyName: company?.company_name ?? ticker,
    sector: company?.sector ?? null,
    currency: 'USD',
    period,
    latestDate: latest?.time ?? null,
    latestPrice: latest?.close ?? null,
    previousClose: previous?.close ?? null,
    dailyChange,
    dailyChangePct,
    bars,
  };
}
