function toUtcDate(dateString) {
  return new Date(`${dateString}T00:00:00.000Z`);
}

function toIsoDate(date) {
  return date.toISOString().slice(0, 10);
}

function addDays(dateString, days) {
  const date = toUtcDate(dateString);
  date.setUTCDate(date.getUTCDate() + days);
  return toIsoDate(date);
}

function getWeekday(dateString) {
  return toUtcDate(dateString).getUTCDay();
}

function nthWeekdayOfMonth(year, month, weekday, occurrence) {
  const date = new Date(Date.UTC(year, month - 1, 1));

  while (date.getUTCDay() !== weekday) {
    date.setUTCDate(date.getUTCDate() + 1);
  }

  date.setUTCDate(date.getUTCDate() + ((occurrence - 1) * 7));
  return toIsoDate(date);
}

function lastWeekdayOfMonth(year, month, weekday) {
  const date = new Date(Date.UTC(year, month, 0));

  while (date.getUTCDay() !== weekday) {
    date.setUTCDate(date.getUTCDate() - 1);
  }

  return toIsoDate(date);
}

function getObservedFixedHoliday(year, month, day) {
  const date = new Date(Date.UTC(year, month - 1, day));
  const weekday = date.getUTCDay();

  if (weekday === 6) {
    date.setUTCDate(date.getUTCDate() - 1);
  } else if (weekday === 0) {
    date.setUTCDate(date.getUTCDate() + 1);
  }

  return toIsoDate(date);
}

function getEasterSunday(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = ((19 * a) + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + (2 * e) + (2 * i) - h - k) % 7;
  const m = Math.floor((a + (11 * h) + (22 * l)) / 451);
  const month = Math.floor((h + l - (7 * m) + 114) / 31);
  const day = ((h + l - (7 * m) + 114) % 31) + 1;
  return toIsoDate(new Date(Date.UTC(year, month - 1, day)));
}

function getGoodFriday(year) {
  return addDays(getEasterSunday(year), -2);
}

function getFormatter(timeZone) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    hourCycle: 'h23',
  });
}

function getZonedDateParts(now, timeZone) {
  const parts = Object.fromEntries(
    getFormatter(timeZone)
      .formatToParts(now)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value])
  );

  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
  };
}

export function getUsEquityMarketHolidays(year) {
  const holidays = new Set([
    getObservedFixedHoliday(year, 1, 1),
    nthWeekdayOfMonth(year, 1, 1, 3),
    nthWeekdayOfMonth(year, 2, 1, 3),
    getGoodFriday(year),
    lastWeekdayOfMonth(year, 5, 1),
    getObservedFixedHoliday(year, 7, 4),
    nthWeekdayOfMonth(year, 9, 1, 1),
    nthWeekdayOfMonth(year, 11, 4, 4),
    getObservedFixedHoliday(year, 12, 25),
  ]);

  if (year >= 2022) {
    holidays.add(getObservedFixedHoliday(year, 6, 19));
  }

  return holidays;
}

export function isUsEquityMarketHoliday(dateString) {
  const year = Number(dateString.slice(0, 4));
  const holidayYears = [year - 1, year, year + 1];

  return holidayYears.some((holidayYear) => getUsEquityMarketHolidays(holidayYear).has(dateString));
}

export function isUsEquityMarketDate(dateString) {
  const weekday = getWeekday(dateString);
  return weekday !== 0 && weekday !== 6 && !isUsEquityMarketHoliday(dateString);
}

export function getPreviousUsEquityMarketDate(dateString) {
  let candidate = addDays(dateString, -1);

  while (!isUsEquityMarketDate(candidate)) {
    candidate = addDays(candidate, -1);
  }

  return candidate;
}

export function countUsEquityMarketDaysBetween(startDate, endDate) {
  if (startDate === endDate) {
    return 0;
  }

  const direction = startDate < endDate ? 1 : -1;
  let candidate = startDate;
  let count = 0;

  while (candidate !== endDate) {
    candidate = addDays(candidate, direction);

    if (isUsEquityMarketDate(candidate)) {
      count += 1;
    }
  }

  return count * direction;
}

export function getExpectedLatestUsEquityMarketDate({
  now = new Date(),
  timeZone = 'America/New_York',
  closeHour = 17,
  closeMinute = 30,
} = {}) {
  const parts = getZonedDateParts(now, timeZone);
  const currentNyDate = `${String(parts.year).padStart(4, '0')}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
  const minutesSinceMidnight = (parts.hour * 60) + parts.minute;
  const closeThresholdMinutes = (closeHour * 60) + closeMinute;

  let candidate = minutesSinceMidnight >= closeThresholdMinutes
    ? currentNyDate
    : addDays(currentNyDate, -1);

  while (!isUsEquityMarketDate(candidate)) {
    candidate = addDays(candidate, -1);
  }

  return candidate;
}
