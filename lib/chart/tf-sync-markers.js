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

export function getTfSyncFixedTopAnchor(bars = []) {
  const highs = bars.map((bar) => finiteNumber(bar?.high)).filter((value) => value !== null);
  const lows = bars.map((bar) => finiteNumber(bar?.low)).filter((value) => value !== null);
  if (!highs.length || !lows.length) return null;

  const highest = Math.max(...highs);
  const lowest = Math.min(...lows);
  const visibleRange = Math.max(0, highest - lowest);
  const fallback = Math.abs(highest) * 0.035;
  const gap = Math.max(visibleRange * 0.08, fallback, 0.01);
  return round(highest + gap);
}

export function buildTfSyncAnchorData(bars = []) {
  const fixedTop = getTfSyncFixedTopAnchor(bars);
  if (fixedTop === null) return [];

  return bars.flatMap((bar) => (
    hasTfSyncSignal(bar) ? [{ time: bar.time, value: fixedTop }] : []
  ));
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
