import { formatUtcDate } from '../lib/utils/date-format.js';

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

export function StockSparklineCell({ sparkline }) {
  if (!sparkline?.path) {
    return <span style={{ color: 'var(--muted)' }}>—</span>;
  }

  return (
    <div
      aria-label={`50 handelsdagar: ${formatSignedPercent(sparkline.returnPct)}`}
      className={toneClass(sparkline.tone)}
      style={{ display: 'grid', gap: 4, minWidth: 126 }}
      title={`50d ${formatSignedPercent(sparkline.returnPct)} · ${formatUtcDate(sparkline.asOfDate)}`}
    >
      <svg
        aria-hidden="true"
        focusable="false"
        preserveAspectRatio="none"
        style={{ display: 'block', height: 32, overflow: 'visible', width: 120 }}
        viewBox="0 0 120 32"
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
          <circle
            className={toneClass(marker.tone)}
            cx={marker.x}
            cy={marker.y}
            key={`${marker.key ?? marker.label ?? 'marker'}-${marker.date}`}
            r="3"
            style={{ fill: 'var(--bg-strong)', stroke: 'currentColor', strokeWidth: 2 }}
          />
        ))}
      </svg>
      <span style={{ color: 'inherit', fontSize: '0.76rem', fontWeight: 700 }}>
        {formatSignedPercent(sparkline.returnPct)}
      </span>
    </div>
  );
}
