export const CHART_PERIODS = Object.freeze(['3M', '6M', '1Y', '2Y', 'ALL']);

const MONTHS_BY_PERIOD = Object.freeze({
  '3M': 3,
  '6M': 6,
  '1Y': 12,
  '2Y': 24,
});

function parseUtcDate(value) {
  const match = String(value ?? '').match(/^(?<year>\d{4})-(?<month>\d{2})-(?<day>\d{2})$/);
  if (!match?.groups) return null;

  const year = Number(match.groups.year);
  const month = Number(match.groups.month);
  const day = Number(match.groups.day);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year
    || date.getUTCMonth() !== month - 1
    || date.getUTCDate() !== day
  ) {
    return null;
  }

  return { year, month, day };
}

function formatUtcDate({ year, month, day }) {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function subtractUtcMonths(dateParts, months) {
  const absoluteMonth = (dateParts.year * 12) + (dateParts.month - 1) - months;
  const year = Math.floor(absoluteMonth / 12);
  const monthIndex = ((absoluteMonth % 12) + 12) % 12;
  const month = monthIndex + 1;
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();

  return {
    year,
    month,
    day: Math.min(dateParts.day, lastDay),
  };
}

export function normalizeChartPeriod(value) {
  const normalized = String(value ?? '').trim().toUpperCase();
  return CHART_PERIODS.includes(normalized) ? normalized : '1Y';
}

export function getChartStartDate(period, latestDate) {
  const normalizedPeriod = normalizeChartPeriod(period);
  const latest = parseUtcDate(latestDate);

  if (normalizedPeriod === 'ALL' || !latest) return null;

  return formatUtcDate(subtractUtcMonths(latest, MONTHS_BY_PERIOD[normalizedPeriod]));
}

export function normalizeChartTicker(value) {
  const ticker = String(value ?? '').trim().toUpperCase();
  return /^[A-Z][A-Z0-9.-]{0,9}$/.test(ticker) ? ticker : null;
}
