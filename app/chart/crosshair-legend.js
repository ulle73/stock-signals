import { CHART_SERIES } from '../../lib/chart/series-registry.js';

function formatPrice(value, currency = 'USD') {
  if (!Number.isFinite(Number(value))) return '—';
  return new Intl.NumberFormat('sv-SE', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value));
}

function formatCompact(value) {
  if (!Number.isFinite(Number(value))) return '—';
  return new Intl.NumberFormat('sv-SE', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(Number(value));
}

function formatDate(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('sv-SE', {
    dateStyle: 'medium',
    timeZone: 'UTC',
  }).format(new Date(`${value}T00:00:00Z`));
}

export default function CrosshairLegend({ currency = 'USD', point, visibleOverlays }) {
  const overlays = visibleOverlays.filter((key) => Number.isFinite(Number(point?.[key])));

  return (
    <div className="chart-crosshair-legend" aria-live="polite">
      <div className="chart-crosshair-date">
        <span>Datum</span>
        <strong>{formatDate(point?.time)}</strong>
      </div>
      <dl className="chart-crosshair-values">
        <div><dt>O</dt><dd>{formatPrice(point?.open, currency)}</dd></div>
        <div><dt>H</dt><dd>{formatPrice(point?.high, currency)}</dd></div>
        <div><dt>L</dt><dd>{formatPrice(point?.low, currency)}</dd></div>
        <div><dt>C</dt><dd>{formatPrice(point?.close, currency)}</dd></div>
        <div><dt>Vol</dt><dd>{formatCompact(point?.volume)}</dd></div>
        {overlays.map((key) => (
          <div key={key}>
            <dt>
              <i aria-hidden="true" style={{ background: CHART_SERIES[key].color }} />
              {CHART_SERIES[key].label}
            </dt>
            <dd>{formatPrice(point[key], currency)}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
