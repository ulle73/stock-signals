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

function formatZscore(value) {
  if (!Number.isFinite(Number(value))) return '—';
  return Number(value).toLocaleString('sv-SE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatSignal(signal) {
  if (signal === 'buy') return 'Upp över −2,70';
  if (signal === 'sell') return 'Ned under +2,70';
  return 'Ingen';
}

function formatDate(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('sv-SE', {
    dateStyle: 'medium',
    timeZone: 'UTC',
  }).format(new Date(`${value}T00:00:00Z`));
}

export default function CrosshairLegend({
  currency = 'USD',
  point,
  visibleIndicators = [],
  visibleOverlays,
  visibleSignals = [],
}) {
  const overlays = visibleOverlays.filter((key) => Number.isFinite(Number(point?.[key])));
  const showZscore = visibleIndicators.includes('rydObvZscore')
    && Number.isFinite(Number(point?.ryd_obv_zscore_80));
  const showRawObv = visibleIndicators.includes('rydObvRaw')
    && Number.isFinite(Number(point?.ryd_obv));
  const showTfSync = visibleSignals.includes('tfSync')
    && (point?.tf_sync_buy_signal === true || point?.tf_sync_sell_signal === true);

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
        {showZscore ? (
          <div>
            <dt><i aria-hidden="true" style={{ background: '#fffb00' }} />RYD Z</dt>
            <dd>{formatZscore(point.ryd_obv_zscore_80)}</dd>
          </div>
        ) : null}
        {showRawObv ? (
          <div>
            <dt><i aria-hidden="true" style={{ background: CHART_SERIES.rydObvRaw.color }} />RYD OBV</dt>
            <dd>{formatCompact(point.ryd_obv)}</dd>
          </div>
        ) : null}
        {showZscore ? (
          <div>
            <dt>RYD-korsning</dt>
            <dd>{formatSignal(point?.ryd_obv_signal)}</dd>
          </div>
        ) : null}
        {showTfSync ? (
          <div>
            <dt><i aria-hidden="true" style={{ background: point.tf_sync_buy_signal ? '#55ff55' : '#ff3b3b' }} />TF Sync</dt>
            <dd>{point.tf_sync_buy_signal ? 'Grön' : 'Röd'}</dd>
          </div>
        ) : null}
      </dl>
    </div>
  );
}
