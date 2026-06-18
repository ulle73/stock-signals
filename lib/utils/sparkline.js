export const DEFAULT_SPARKLINE_VIEWBOX = Object.freeze({
  width: 120,
  height: 32,
  paddingX: 2,
  paddingY: 3,
});

function toFiniteNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function round(value, digits = 3) {
  if (!Number.isFinite(value)) return null;
  return Number(value.toFixed(digits));
}

function buildPoint({ row, index, count, minClose, maxClose, viewBox }) {
  const close = toFiniteNumber(row.close ?? row.adj_close);
  const drawableWidth = viewBox.width - (viewBox.paddingX * 2);
  const drawableHeight = viewBox.height - (viewBox.paddingY * 2);
  const x = count <= 1
    ? viewBox.width / 2
    : viewBox.paddingX + ((index / (count - 1)) * drawableWidth);
  const y = maxClose === minClose
    ? viewBox.height / 2
    : viewBox.paddingY + ((maxClose - close) / (maxClose - minClose)) * drawableHeight;

  return {
    date: row.date,
    close: round(close, 6),
    x: round(x),
    y: round(y),
  };
}

function buildPath(points) {
  return points
    .map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x},${point.y}`)
    .join(' ');
}

export function buildSparklineSeries(rows, options = {}) {
  const viewBox = {
    ...DEFAULT_SPARKLINE_VIEWBOX,
    ...options,
  };
  const cleanRows = [...(rows ?? [])]
    .map((row) => ({
      date: String(row.date ?? '').slice(0, 10),
      close: toFiniteNumber(row.close ?? row.adj_close),
    }))
    .filter((row) => row.date && row.close !== null && row.close > 0)
    .sort((left, right) => left.date.localeCompare(right.date));

  if (!cleanRows.length) {
    return null;
  }

  const closes = cleanRows.map((row) => row.close);
  const minClose = Math.min(...closes);
  const maxClose = Math.max(...closes);
  const closeFirst = closes[0];
  const closeLast = closes.at(-1);
  const returnPct = closeFirst > 0
    ? ((closeLast / closeFirst) - 1) * 100
    : null;
  const points = cleanRows.map((row, index) => buildPoint({
    row,
    index,
    count: cleanRows.length,
    minClose,
    maxClose,
    viewBox,
  }));

  return {
    path: buildPath(points),
    closeFirst: round(closeFirst, 6),
    closeLast: round(closeLast, 6),
    returnPct: returnPct === null ? null : round(returnPct, 6),
    minClose: round(minClose, 6),
    maxClose: round(maxClose, 6),
    points,
    markerSlots: [],
    viewBox,
  };
}

export function buildSparklineMarkerSlots(points, markers = []) {
  const pointByDate = new Map(
    (points ?? []).map((point) => [point.date, point])
  );

  return (markers ?? [])
    .map((marker) => {
      const point = pointByDate.get(String(marker.date ?? '').slice(0, 10));
      if (!point) return null;

      return {
        date: point.date,
        x: point.x,
        y: point.y,
        key: marker.key ?? marker.indicator ?? point.date,
        label: marker.label ?? marker.indicator ?? 'Signal',
        tone: marker.tone ?? 'neutral',
      };
    })
    .filter(Boolean);
}
