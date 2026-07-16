const PLCE_COLOR = '#0004ff';

function finiteNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function round(value, digits = 6) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

export function getPlceBelowAnchor(bar) {
  const high = finiteNumber(bar?.high);
  const low = finiteNumber(bar?.low);
  const close = finiteNumber(bar?.close);
  if (high === null || low === null || close === null) return null;

  const range = Math.max(0, high - low);
  const gap = Math.max(range * 0.8, Math.abs(close) * 0.012, 0.01);
  return round(low - gap);
}

export function buildPlceAnchorData(bars = []) {
  return bars.flatMap((bar) => {
    if (bar?.plce_threshold_buy_signal !== true) return [];
    const value = getPlceBelowAnchor(bar);
    return value === null ? [] : [{ time: bar.time, value }];
  });
}

export function buildPlceMarkers(bars = []) {
  return bars.flatMap((bar) => (
    bar?.plce_threshold_buy_signal === true
      ? [{
        time: bar.time,
        position: 'belowBar',
        color: PLCE_COLOR,
        shape: 'arrowUp',
        size: 2,
      }]
      : []
  ));
}
