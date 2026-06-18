import { formatUtcDate } from '../lib/utils/date-format.js';

const CHART_WIDTH = 240;
const CHART_HEIGHT = 64;
const OBV_WIDTH = 240;
const OBV_HEIGHT = 44;
const OBV_EXTREME_FILL = '#fff200';

function formatNumber(value, digits = 2) {
  if (value === null || value === undefined) return '—';
  return new Intl.NumberFormat('sv-SE', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(Number(value));
}

function formatSignedPercent(value, digits = 1) {
  if (value === null || value === undefined) return '—';
  const number = Number(value);
  const sign = number > 0 ? '+' : '';
  return `${sign}${formatNumber(number, digits)}%`;
}

function toneClass(tone) {
  return `tone-${tone || 'neutral'}`;
}

function obvBarFill(tone) {
  return tone === 'caution' ? OBV_EXTREME_FILL : 'currentColor';
}

function SignalMarker({ marker }) {
  const key = `${marker.key ?? marker.label ?? 'marker'}-${marker.date}`;
  const tone = toneClass(marker.tone);

  if (marker.shape === 'triangle-down') {
    const x = Number(marker.x);
    const y = Number(marker.y);

    return (
      <polygon
        className={tone}
        key={key}
        points={`${x - 3.8},${y} ${x + 3.8},${y} ${x},${y + 6.6}`}
        style={{ fill: 'currentColor', opacity: 0.96 }}
      />
    );
  }

  return (
    <circle
      className={tone}
      cx={marker.x}
      cy={marker.y}
      key={key}
      r="3"
      style={{ fill: 'var(--bg-strong)', stroke: 'currentColor', strokeWidth: 2 }}
    />
  );
}

function ObvPanel({ panel }) {
  if (!panel?.bars?.length) return null;

  const width = panel.viewBox?.width ?? 120;
  const height = panel.viewBox?.height ?? 22;
  const zeroY = panel.zeroY ?? height / 2;

  return (
    <svg aria-hidden="true" focusable="false" preserveAspectRatio="none" style={{ display: 'block', height: OBV_HEIGHT, overflow: 'visible', width: OBV_WIDTH }} viewBox={`0 0 ${width} ${height}`}>
      <line x1="0" x2={width} y1={zeroY} y2={zeroY} style={{ opacity: 0.36, stroke: 'currentColor', strokeWidth: 0.75, vectorEffect: 'non-scaling-stroke' }} />
      {panel.bars.map((bar) => (
        <rect className={toneClass(bar.tone)} height={bar.height} key={`obv-${bar.date}`} rx="0.45" style={{ fill: obvBarFill(bar.tone), opacity: bar.tone === 'caution' ? 0.98 : 0.7 }} width={bar.width} x={bar.x} y={bar.y} />
      ))}
    </svg>
  );
}

export function StockSparklineCell({ sparkline }) {
  if (!sparkline?.path) {
    return <span style={{ color: 'var(--muted)' }}>—</span>;
  }

  return (
    <div
      aria-label={`50 handelsdagar: ${formatSignedPercent(sparkline.returnPct)}`}
      className={toneClass(sparkline.tone)}
      style={{ display: 'grid', gap: 5, minWidth: 252 }}
      title={`50d ${formatSignedPercent(sparkline.returnPct)} · ${formatUtcDate(sparkline.asOfDate)}`}
    >
      <svg
        aria-hidden="true"
        focusable="false"
        preserveAspectRatio="none"
        style={{ display: 'block', height: CHART_HEIGHT, overflow: 'visible', width: CHART_WIDTH }}
        viewBox="0 0 120 34"
      >
        <path
          d={sparkline.path}
          style={{
            fill: 'none',
            opacity: 0.95,
            stroke: 'currentColor',
            strokeLinecap: 'round',
            strokeLinejoin: 'round',
            strokeWidth: 2.2,
            vectorEffect: 'non-scaling-stroke',
          }}
        />
        {(sparkline.markers ?? []).map((marker) => (
          <SignalMarker key={`${marker.key ?? marker.label ?? 'marker'}-${marker.date}`} marker={marker} />
        ))}
      </svg>
      <ObvPanel panel={sparkline.obvPanel} />
      <span style={{ color: 'inherit', fontSize: '0.82rem', fontWeight: 700 }}>
        {formatSignedPercent(sparkline.returnPct)}
      </span>
    </div>
  );
}
