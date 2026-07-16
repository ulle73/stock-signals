const EARNINGS_COLOR = '#f59e0b';

function finiteNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function round(value, digits = 6) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function eventDates(events = []) {
  return new Set(events.map((event) => String(event?.date ?? '').slice(0, 10)));
}

export function getEarningsBelowAnchor(bar) {
  const high = finiteNumber(bar?.high);
  const low = finiteNumber(bar?.low);
  const close = finiteNumber(bar?.close);
  if (high === null || low === null || close === null) return null;
  const range = Math.max(0, high - low);
  const gap = Math.max(range * 0.7, Math.abs(close) * 0.01, 0.01);
  return round(low - gap * 2.2);
}

export function buildEarningsAnchorData(bars = [], events = []) {
  const dates = eventDates(events);
  return bars.flatMap((bar) => {
    if (!dates.has(String(bar?.time ?? ''))) return [];
    const value = getEarningsBelowAnchor(bar);
    return value === null ? [] : [{ time: bar.time, value }];
  });
}

export function buildEarningsMarkers(events = []) {
  return events.flatMap((event) => {
    const time = String(event?.date ?? '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(time)) return [];
    return [{
      time,
      position: 'belowBar',
      color: EARNINGS_COLOR,
      shape: 'circle',
      text: 'E',
      size: 1.5,
    }];
  });
}
