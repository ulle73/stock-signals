const CVOL_COLOR = '#0004ff';

function finiteNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function round(value, digits = 6) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function hasCvolSignal(bar) {
  return bar?.cvol_sell_signal_1 === true
    || bar?.cvol_sell_signal_2 === true
    || bar?.cvol_sell_signal_3 === true;
}

export function getCvolAboveAnchor(bar) {
  const high = finiteNumber(bar?.high);
  const low = finiteNumber(bar?.low);
  const close = finiteNumber(bar?.close);
  if (high === null || low === null || close === null) return null;

  const range = Math.max(0, high - low);
  const gap = Math.max(range * 0.85, Math.abs(close) * 0.012, 0.01);
  return round(high + gap);
}

export function buildCvolAnchorData(bars = []) {
  return bars.flatMap((bar) => {
    if (!hasCvolSignal(bar)) return [];
    const value = getCvolAboveAnchor(bar);
    return value === null ? [] : [{ time: bar.time, value }];
  });
}

export function buildCvolMarkers(bars = []) {
  return bars.flatMap((bar) => {
    if (!hasCvolSignal(bar)) return [];
    const multiple = bar.cvol_signal === 'multiple_sell_signals'
      || [bar.cvol_sell_signal_1, bar.cvol_sell_signal_2, bar.cvol_sell_signal_3]
        .filter((value) => value === true).length > 1;

    return [{
      time: bar.time,
      position: 'aboveBar',
      color: CVOL_COLOR,
      shape: 'arrowDown',
      size: multiple ? 2 : 1,
    }];
  });
}
