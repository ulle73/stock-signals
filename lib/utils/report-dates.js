function assertIsoDate(value, label = 'date') {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`Invalid ${label}: ${value}`);
  }
}

export function getTodayIsoDate(now = new Date()) {
  return now.toISOString().slice(0, 10);
}

export function addDaysToIsoDate(date, days) {
  assertIsoDate(date);
  const nextDate = new Date(`${date}T00:00:00Z`);
  nextDate.setUTCDate(nextDate.getUTCDate() + days);
  return nextDate.toISOString().slice(0, 10);
}

export function enumerateWeekdayIsoDates(startDate, endDate) {
  assertIsoDate(startDate, 'startDate');
  assertIsoDate(endDate, 'endDate');

  if (startDate > endDate) {
    return [];
  }

  const dates = [];
  let cursor = startDate;

  while (cursor <= endDate) {
    const currentDate = new Date(`${cursor}T00:00:00Z`);
    const day = currentDate.getUTCDay();

    if (day !== 0 && day !== 6) {
      dates.push(cursor);
    }

    cursor = addDaysToIsoDate(cursor, 1);
  }

  return dates;
}
