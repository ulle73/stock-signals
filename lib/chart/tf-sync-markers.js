const TF_SYNC_COLORS = Object.freeze({
  buy: '#55ff55',
  sell: '#ff3b3b',
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

function hasTfSyncSignal(bar) {
  return bar?.tf_sync_buy_signal === true || bar?.tf_sync_sell_signal === true;
}

export function getTfSyncTopAnchor(bar) {
  const high = finiteNumber(bar?.high);
  const low = finiteNumber(bar?.low);
  const close = finiteNumber(bar?.close);
  if (high === null || low === null || close === null) return null;

  const range = Math.max(0, high - low);
  const fallback = Math.abs(close) * 0.015;
  const gap = Math.max(range * 0.9, fallback, 0.01);
  return round(high + gap * 3.2);
}

export function buildTfSyncAnchorData(bars = []) {
  return bars.flatMap((bar) => {
    if (!hasTfSyncSignal(bar)) return [];
    const value = getTfSyncTopAnchor(bar);
    return value === null ? [] : [{ time: bar.time, value }];
  });
}

export function buildTfSyncMarkers(bars = []) {
  return bars.flatMap((bar) => {
    if (bar?.tf_sync_buy_signal === true) {
      return [{
        time: bar.time,
        position: 'aboveBar',
        color: TF_SYNC_COLORS.buy,
        shape: 'arrowDown',
      }];
    }
    if (bar?.tf_sync_sell_signal === true) {
      return [{
        time: bar.time,
        position: 'aboveBar',
        color: TF_SYNC_COLORS.sell,
        shape: 'arrowDown',
      }];
    }
    return [];
  });
}
