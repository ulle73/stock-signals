import { getSectorFactorRegimePerformanceSnapshot } from '../lib/repositories/macro-matrix-sector-factor-regime-performance.js';

const REGIME_LABELS = {
  recovery: 'Recovery',
  expansion: 'Expansion',
  slowdown: 'Slowdown',
  contraction: 'Contraction',
};

const METRIC_GROUPS = [
  { key: 'avgReturn', label: 'Average Returns' },
  { key: 'medianReturn', label: 'Median Returns' },
  { key: 'volatility', label: 'Volatility' },
  { key: 'sharpe', label: 'Sharpe' },
  { key: 'winRatio', label: 'Win Ratio' },
  { key: 'beta', label: 'Beta with OMXS30' },
  { key: 'observations', label: '# Observations' },
];

function n(value, digits = 1) {
  if (value === null || value === undefined) return '—';
  const number = Number(value);
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: Math.abs(number) >= 100 ? 0 : digits,
    maximumFractionDigits: Math.abs(number) >= 100 ? 0 : digits,
  }).format(number);
}

function pct(value, digits = 1) {
  return value === null || value === undefined ? '—' : `${n(value, digits)}%`;
}

function month(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('en-US', { month: 'short', year: '2-digit', timeZone: 'UTC' })
    .format(new Date(`${value}T00:00:00Z`))
    .replace(' ', '-');
}

function status(value) {
  return value ? value.replaceAll('_', ' ') : 'No data';
}

function metricValue(metricKey, cell) {
  if (!cell) return '—';

  if (metricKey === 'avgReturn') return pct(cell.avgReturn);
  if (metricKey === 'medianReturn') return pct(cell.medianReturn);
  if (metricKey === 'volatility') return pct(cell.volatility);
  if (metricKey === 'sharpe') return n(cell.sharpe, 2);
  if (metricKey === 'winRatio') return pct(cell.winRatio);
  if (metricKey === 'beta') return n(cell.beta, 2);
  if (metricKey === 'observations') return cell.observations ? n(cell.observations, 0) : '—';

  return '—';
}

function metricClass(metricKey, cell) {
  if (metricKey === 'observations') return 'regime-stat-observation';
  return `macro-${cell?.metricBuckets?.[metricKey] ?? 'missing'}`;
}

function assetBucket(row) {
  const type = row.assetType ?? row.assetGroup ?? '';

  if (['equity_index', 'thematic_equity'].includes(type)) return 'equity';
  if (['commodity_index', 'commodity'].includes(type)) return 'commodity';
  if (type === 'crypto') return 'crypto';
  if (type === 'volatility') return 'volatility';
  if (['credit', 'inflation_linked_bond', 'government_bond', 'bond_index'].includes(type)) return 'fixedincome';
  if (['currency_index', 'fx_basket', 'fx'].includes(type)) return 'fx';
  return 'neutral';
}

function cellTitle(row, cell, metricLabel, metricKey) {
  if (!cell) return row.label;

  const value = metricValue(metricKey, cell);
  return `${row.label} · ${metricLabel} · ${REGIME_LABELS[cell.regime] ?? cell.regime} · ${value}`;
}

export default async function SectorFactorRegimePerformanceSection() {
  const matrix = await getSectorFactorRegimePerformanceSnapshot();
  if (!matrix) return null;

  return (
    <section className="card macro-matrix-card regime-stat-card">
      <div className="regime-stat-header">
        <div className="regime-stat-heading">
          <span className="regime-stat-rail" aria-hidden="true" />
          <div>
            <h2>Vilka sektorer och faktorstilar fungerar?</h2>
            <p className="regime-stat-intro">
              Förutom att hitta det som brukar utvecklas väl så hjälper marknadsregimerna oss med att undvika det som brukar underprestera.
              Undvika förlorare är minst lika viktigt som att hitta vinnare.
            </p>
          </div>
        </div>

        <div className="regime-stat-badge">
          <span>Macro</span>
          <strong>Medium/Long-Term</strong>
        </div>
      </div>

      <div className="macro-matrix-scroll regime-stat-scroll">
        <table className="macro-matrix-table regime-stat-table">
          <thead>
            <tr>
              <th rowSpan="2">Markets</th>
              {METRIC_GROUPS.map((metric) => (
                <th className="regime-stat-group-head" colSpan={matrix.regimes.length} key={metric.key}>
                  {metric.label}
                </th>
              ))}
            </tr>
            <tr>
              {METRIC_GROUPS.flatMap((metric) => matrix.regimes.map((regime) => (
                <th
                  className="regime-stat-subhead"
                  key={`${metric.key}-${regime}`}
                >
                  {REGIME_LABELS[regime] ?? regime}
                </th>
              )))}
            </tr>
          </thead>
          <tbody>
            {matrix.rows.map((row, index) => {
              const bucket = assetBucket(row);
              const previousBucket = index > 0 ? assetBucket(matrix.rows[index - 1]) : null;
              const isGroupStart = index === 0 || previousBucket !== bucket;

              return (
                <tr className={isGroupStart ? 'regime-stat-group-start' : undefined} key={row.key}>
                  <th
                    className={`regime-stat-rowhead regime-stat-rowhead-${bucket}`}
                    scope="row"
                    title={`${row.label} · ${row.sourceSymbol ?? 'no symbol'} · ${row.sourceStatus ?? 'active'}`}
                  >
                    <div className="macro-row-label">{row.label}</div>
                  </th>
                  {METRIC_GROUPS.flatMap((metric) => row.regimeCells.map((cell) => (
                    <td
                      className={`macro-cell regime-stat-cell ${metricClass(metric.key, cell)}`}
                      key={`${row.key}-${metric.key}-${cell.regime}`}
                      title={cellTitle(row, cell, metric.label, metric.key)}
                    >
                      {metricValue(metric.key, cell)}
                    </td>
                  )))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="footnote">
        Beta räknas mot {matrix.benchmarkLabel ?? 'OMXS30-proxy'}. Aktuell regim är {status(matrix.currentRegime)} per {month(matrix.asOfDate)}.
        Där exakta index inte är gratis eller fetchbara används explicit ETF-, futures- eller FX-proxy.
      </p>
    </section>
  );
}
