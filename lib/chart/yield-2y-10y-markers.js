const YIELD_COLOR = '#ffffff';

function finiteNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function round(value, digits = 6) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function gapFor(bar) {
  const high = finiteNumber(bar?.high);
  const low = finiteNumber(bar?.low);
  const close = finiteNumber(bar?.close);
  if (high === null || low === null || close === null) return null;
  return Math.max(Math.max(0, high - low) * 1.8, Math.abs(close) * 0.025, 0.02);
}

export function getYieldAnchor(bar) {
  const high = finiteNumber(bar?.high);
  const low = finiteNumber(bar?.low);
  const gap = gapFor(bar);
  if (high === null || low === null || gap === null) return null;
  if (bar?.yield_2y_10y_buy_signal === true) return round(low - gap);
  if (bar?.yield_2y_10y_sell_signal === true) return round(high + gap);
  return null;
}

export function buildYieldAnchorData(bars = []) {
  return bars.flatMap((bar) => {
    const value = getYieldAnchor(bar);
    return value === null ? [] : [{ time: bar.time, value }];
  });
}

export function buildYieldMarkers(bars = []) {
  return bars.flatMap((bar) => {
    if (bar?.yield_2y_10y_buy_signal === true) {
      return [{ time: bar.time, position: 'belowBar', color: YIELD_COLOR, shape: 'arrowUp', size: 3 }];
    }
    if (bar?.yield_2y_10y_sell_signal === true) {
      return [{ time: bar.time, position: 'aboveBar', color: YIELD_COLOR, shape: 'arrowDown', size: 3 }];
    }
    return [];
  });
}
