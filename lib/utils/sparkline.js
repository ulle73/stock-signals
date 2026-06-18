export const DEFAULT_SPARKLINE_VIEWBOX = Object.freeze({
  width: 120,
  height: 34,
  paddingX: 2,
  paddingY: 5,
});

export const DEFAULT_OBV_PANEL_VIEWBOX = Object.freeze({
  width: 120,
  height: 22,
  paddingX: 2,
  paddingY: 2,
});

const RYD_OBV_EXTREME_ZSCORE = 2.7;

function toFiniteNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function round(value, digits = 3) {
  if (!Number.isFinite(value)) return null;
  return Number(value.toFixed(digits));
}

function normalizeDate(value) {
  return String(value ?? '').slice(0, 10);
}

function normalizeSignal(value) {
  return String(value ?? '').trim().toLowerCase();
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

function buildPointByDate(points) {
  return new Map(
    (points ?? []).map((point) => [point.date, point])
  );
}

function tfSyncDirection(row) {
  const signal = normalizeSignal(row.tf_sync_signal);

  if (signal === 'buy' || signal === 'buy_active' || row.tf_sync_buy_signal === true || row.tf_sync_buy_active === true) {
    return 'buy';
  }

  if (signal === 'sell' || signal === 'sell_active' || row.tf_sync_sell_signal === true || row.tf_sync_sell_active === true) {
    return 'sell';
  }

  return null;
}

function tfSyncLabel(row, direction) {
  const signal = normalizeSignal(row.tf_sync_signal);
  if (signal === 'buy_active') return 'TF Sync buy active';
  if (signal === 'sell_active') return 'TF Sync sell active';
  if (signal === 'buy') return 'TF Sync buy';
  if (signal === 'sell') return 'TF Sync sell';
  return direction === 'buy' ? 'TF Sync buy' : 'TF Sync sell';
}

function obvTone(row, value) {
  if (Math.abs(value) >= RYD_OBV_EXTREME_ZSCORE) return 'caution';

  const signal = normalizeSignal(row.ryd_obv_signal);
  if (signal === 'buy') return 'positive';
  if (signal === 'sell') return 'danger';
  if (value > 0) return 'positive';
  if (value < 0) return 'danger';
  return 'neutral';
}

export function buildSparklineSeries(rows, options = {}) {
  const viewBox = {
    ...DEFAULT_SPARKLINE_VIEWBOX,
    ...options,
  };
  const cleanRows = [...(rows ?? [])]
    .map((row) => ({
      date: normalizeDate(row.date),
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
  const pointByDate = buildPointByDate(points);

  return (markers ?? [])
    .map((marker) => {
      const point = pointByDate.get(normalizeDate(marker.date));
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

export function buildTfSyncMarkerSlots(points, rows = []) {
  const pointByDate = buildPointByDate(points);

  return [...(rows ?? [])]
    .map((row) => {
      const date = normalizeDate(row.date);
      const point = pointByDate.get(date);
      if (!point) return null;

      const direction = tfSyncDirection(row);
      if (!direction) return null;

      return {
        date,
        x: point.x,
        y: 3,
        key: `tf-sync-${direction}-${date}`,
        label: tfSyncLabel(row, direction),
        tone: direction === 'buy' ? 'positive' : 'danger',
        direction,
        shape: 'triangle-down',
        source: 'tf_sync',
      };
    })
    .filter(Boolean);
}

export function buildObvPanel(points, rows = [], options = {}) {
  const viewBox = {
    ...DEFAULT_OBV_PANEL_VIEWBOX,
    ...options,
  };
  const pointByDate = buildPointByDate(points);
  const cleanRows = [...(rows ?? [])]
    .map((row) => ({
      ...row,
      date: normalizeDate(row.date),
      value: toFiniteNumber(row.ryd_obv_zscore_80 ?? row.obv_zscore ?? row.value),
    }))
    .filter((row) => row.date && row.value !== null && pointByDate.has(row.date))
    .sort((left, right) => left.date.localeCompare(right.date));

  if (!cleanRows.length) {
    return null;
  }

  const values = cleanRows.map((row) => row.value);
  const maxAbs = Math.max(2, ...values.map((value) => Math.abs(value)));
  const zeroY = viewBox.height / 2;
  const drawableHalfHeight = (viewBox.height - (viewBox.paddingY * 2)) / 2;
  const spacing = points?.length > 1
    ? (viewBox.width - (viewBox.paddingX * 2)) / (points.length - 1)
    : viewBox.width - (viewBox.paddingX * 2);
  const barWidth = Math.max(1, Math.min(3, spacing * 0.68));
  const bars = cleanRows.map((row) => {
    const point = pointByDate.get(row.date);
    const height = Math.max(0.75, (Math.abs(row.value) / maxAbs) * drawableHalfHeight);
    const y = row.value >= 0 ? zeroY - height : zeroY;

    return {
      date: row.date,
      x: round(point.x - (barWidth / 2)),
      y: round(y),
      width: round(barWidth),
      height: round(height),
      value: round(row.value, 3),
      signal: normalizeSignal(row.ryd_obv_signal) || 'none',
      tone: obvTone(row, row.value),
    };
  });

  return {
    label: 'RYD OBV Z',
    zeroY: round(zeroY),
    latestValue: round(values.at(-1), 3),
    minValue: round(Math.min(...values), 3),
    maxValue: round(Math.max(...values), 3),
    bars,
    viewBox,
  };
}

export function buildSparklineIndicatorPayloads(points, rows = []) {
  return {
    markerSlots: buildTfSyncMarkerSlots(points, rows),
    tfSyncMarkers: buildTfSyncMarkerSlots(points, rows),
    obvPanel: buildObvPanel(points, rows),
  };
}
