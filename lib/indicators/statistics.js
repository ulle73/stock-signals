import { formatIndicatorValueForStorage } from '../utils/rolling-indicators.js';

export function toNumber(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function normalizeNumber(value) {
  const number = toNumber(value);
  if (number === null) {
    return null;
  }

  return Number(formatIndicatorValueForStorage(number));
}

export function sortRowsByDate(rows, dateField = 'date') {
  return [...rows].sort((left, right) => left[dateField].localeCompare(right[dateField]));
}

export function calculateRollingPopulationZscore(history, length) {
  if (history.length < length) {
    return null;
  }

  const window = history.slice(-length).map(toNumber);

  if (window.some((value) => value === null)) {
    return null;
  }

  const currentValue = window.at(-1);
  const mean = window.reduce((sum, value) => sum + value, 0) / length;
  const variance = window.reduce((sum, value) => sum + ((value - mean) ** 2), 0) / length;
  const stdev = Math.sqrt(variance);

  if (!Number.isFinite(stdev) || stdev === 0) {
    return null;
  }

  return normalizeNumber((currentValue - mean) / stdev);
}
