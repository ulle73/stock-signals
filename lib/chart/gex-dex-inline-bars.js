const DEFAULT_MAX_WIDTH_RATIO = 0.30;
const MIN_NON_ZERO_BAR_WIDTH = 2;
const BAR_HEIGHT = 5;

function finiteNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

function normalizeRatio(value) {
  const number = finiteNumber(value);
  return number === null ? DEFAULT_MAX_WIDTH_RATIO : clamp(number, 0.05, 0.45);
}

export function buildInlineExposureRows(strikes = []) {
  const byStrike = new Map();

  for (const raw of strikes) {
    const strike = finiteNumber(raw?.strike);
    if (strike === null) continue;
    byStrike.set(strike, {
      strike,
      netGex: finiteNumber(raw?.netGex ?? raw?.net_gex) ?? 0,
      netDex: finiteNumber(raw?.netDex ?? raw?.net_dex) ?? 0,
    });
  }

  return [...byStrike.values()].sort((left, right) => right.strike - left.strike);
}

function scaledWidth(value, maximum, maxWidth) {
  if (!Number.isFinite(value) || value === 0 || maximum <= 0 || maxWidth <= 0) return 0;
  return Math.max(MIN_NON_ZERO_BAR_WIDTH, (Math.abs(value) / maximum) * maxWidth);
}

export function buildInlineExposureGeometry({
  rows = [],
  paneWidth,
  paneHeight,
  priceToCoordinate,
  maxWidthRatio = DEFAULT_MAX_WIDTH_RATIO,
} = {}) {
  const width = Math.max(0, finiteNumber(paneWidth) ?? 0);
  const height = Math.max(0, finiteNumber(paneHeight) ?? 0);
  if (!width || !height || typeof priceToCoordinate !== 'function') return [];

  const normalizedRows = buildInlineExposureRows(rows);
  const maxGex = Math.max(1, ...normalizedRows.map((row) => Math.abs(row.netGex)));
  const maxDex = Math.max(1, ...normalizedRows.map((row) => Math.abs(row.netDex)));
  const maxBarWidth = width * normalizeRatio(maxWidthRatio);

  return normalizedRows.flatMap((row) => {
    const coordinate = finiteNumber(priceToCoordinate(row.strike));
    if (coordinate === null || coordinate < 0 || coordinate > height) return [];

    const gexWidth = scaledWidth(row.netGex, maxGex, maxBarWidth);
    const dexWidth = scaledWidth(row.netDex, maxDex, maxBarWidth);

    return [{
      ...row,
      y: coordinate,
      gex: { x: 0, width: gexWidth },
      dex: { x: width - dexWidth, width: dexWidth },
    }];
  });
}

function compactExposure(value) {
  const absolute = Math.abs(Number(value) || 0);
  if (absolute >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}md`;
  if (absolute >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}mn`;
  if (absolute >= 1_000) return `${(value / 1_000).toFixed(1)}tn`;
  return `${Math.round(value)}`;
}

function strikeLabel(value) {
  return Number(value).toLocaleString('sv-SE', { maximumFractionDigits: 2 });
}

function barColor(value, side) {
  if (Number(value) < 0) return side === 'gex' ? 'rgba(255, 105, 92, 0.62)' : 'rgba(255, 94, 82, 0.54)';
  if (Number(value) > 0) return side === 'gex' ? 'rgba(113, 232, 132, 0.62)' : 'rgba(91, 220, 130, 0.54)';
  return 'rgba(148, 163, 184, 0.22)';
}

class GexDexInlineBarsRenderer {
  constructor(source) {
    this.source = source;
  }

  draw(target) {
    const source = this.source;
    if (!source.series || !source.rows.length) return;

    target.useMediaCoordinateSpace(({ context, mediaSize }) => {
      const geometry = buildInlineExposureGeometry({
        rows: source.rows,
        paneWidth: mediaSize.width,
        paneHeight: mediaSize.height,
        priceToCoordinate: (price) => source.series.priceToCoordinate(price),
        maxWidthRatio: source.maxWidthRatio,
      });
      if (!geometry.length) return;

      context.save();
      try {
        context.font = "600 10px 'JetBrains Mono', monospace";
        context.textBaseline = 'middle';

        for (const row of geometry) {
          const top = Math.round(row.y - BAR_HEIGHT / 2);

          if (row.gex.width > 0) {
            context.fillStyle = barColor(row.netGex, 'gex');
            context.fillRect(row.gex.x, top, row.gex.width, BAR_HEIGHT);
          }
          if (row.dex.width > 0) {
            context.fillStyle = barColor(row.netDex, 'dex');
            context.fillRect(row.dex.x, top, row.dex.width, BAR_HEIGHT);
          }

          context.fillStyle = 'rgba(244, 244, 245, 0.88)';
          context.textAlign = 'left';
          context.fillText(strikeLabel(row.strike), 7, row.y);

          context.fillStyle = row.netGex < 0 ? 'rgba(255, 122, 110, 0.94)' : 'rgba(122, 240, 144, 0.94)';
          context.fillText(compactExposure(row.netGex), Math.max(54, Math.min(row.gex.width + 6, mediaSize.width * source.maxWidthRatio - 42)), row.y);

          context.fillStyle = row.netDex < 0 ? 'rgba(255, 122, 110, 0.94)' : 'rgba(122, 240, 144, 0.94)';
          context.textAlign = 'right';
          context.fillText(compactExposure(row.netDex), mediaSize.width - 7, row.y);
        }
      } finally {
        context.restore();
      }
    });
  }
}

class GexDexInlineBarsPaneView {
  constructor(source) {
    this.rendererInstance = new GexDexInlineBarsRenderer(source);
  }

  zOrder() {
    return 'bottom';
  }

  renderer() {
    return this.rendererInstance;
  }
}

export class GexDexInlineBarsPrimitive {
  constructor({ rows = [], maxWidthRatio = DEFAULT_MAX_WIDTH_RATIO } = {}) {
    this.rows = buildInlineExposureRows(rows);
    this.maxWidthRatio = normalizeRatio(maxWidthRatio);
    this.series = null;
    this.requestUpdate = null;
    this.paneView = new GexDexInlineBarsPaneView(this);
    this.paneViewList = [this.paneView];
  }

  attached({ series, requestUpdate }) {
    this.series = series;
    this.requestUpdate = requestUpdate;
    this.requestUpdate?.();
  }

  detached() {
    this.series = null;
    this.requestUpdate = null;
  }

  updateAllViews() {
    // Geometry is derived during every draw from the live series price scale.
  }

  paneViews() {
    return this.paneViewList;
  }

  autoscaleInfo() {
    return null;
  }

  setRows(rows = []) {
    this.rows = buildInlineExposureRows(rows);
    this.requestUpdate?.();
  }
}
