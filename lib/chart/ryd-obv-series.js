export const RYD_OBV_LEVELS = Object.freeze([
  Object.freeze({ value: -6, kind: 'extreme' }),
  Object.freeze({ value: -2.7, kind: 'signal' }),
  Object.freeze({ value: -1.25, kind: 'neutral' }),
  Object.freeze({ value: 0, kind: 'zero' }),
  Object.freeze({ value: 1.25, kind: 'neutral' }),
  Object.freeze({ value: 2.7, kind: 'signal' }),
  Object.freeze({ value: 6, kind: 'extreme' }),
]);

export const RYD_OBV_MARKER_GAP = 0.45;

const COLORS = Object.freeze({
  extreme: '#fffb00',
  positive: '#4caf50',
  neutral: '#6b7280',
  negative: '#ef4444',
  buy: '#34ff56',
  sell: '#ff3e3e',
});

function finiteNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function round(value, digits = 6) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

export function getRydObvZscoreColor(value) {
  const zscore = finiteNumber(value);
  if (zscore === null) return COLORS.neutral;
  if (zscore >= 2.7 || zscore <= -2.7) return COLORS.extreme;
  if (zscore > 1.25) return COLORS.positive;
  if (zscore < -1.25) return COLORS.negative;
  return COLORS.neutral;
}

export function buildRydObvHistogramData(bars = []) {
  return bars.flatMap((bar) => {
    const value = finiteNumber(bar.ryd_obv_zscore_80);
    if (value === null) return [];
    return [{
      time: bar.time,
      value,
      color: getRydObvZscoreColor(value),
    }];
  });
}

export function buildRawObvLineData(bars = []) {
  return bars.flatMap((bar) => {
    const value = finiteNumber(bar.ryd_obv);
    if (value === null) return [];
    return [{ time: bar.time, value }];
  });
}

export function buildRydObvMarkerAnchorData(bars = []) {
  return bars.flatMap((bar) => {
    const value = finiteNumber(bar.ryd_obv_zscore_80);
    if (value === null) return [];

    if (bar.ryd_obv_buy_signal === true) {
      return [{ time: bar.time, value: round(value - RYD_OBV_MARKER_GAP) }];
    }
    if (bar.ryd_obv_sell_signal === true) {
      return [{ time: bar.time, value: round(value + RYD_OBV_MARKER_GAP) }];
    }
    return [];
  });
}

export function buildRydObvMarkers(bars = []) {
  return bars.flatMap((bar) => {
    if (finiteNumber(bar.ryd_obv_zscore_80) === null) return [];

    const markers = [];
    if (bar.ryd_obv_buy_signal === true) {
      markers.push({
        time: bar.time,
        position: 'belowBar',
        color: COLORS.buy,
        shape: 'arrowUp',
      });
    }
    if (bar.ryd_obv_sell_signal === true) {
      markers.push({
        time: bar.time,
        position: 'aboveBar',
        color: COLORS.sell,
        shape: 'arrowDown',
      });
    }
    return markers;
  });
}
