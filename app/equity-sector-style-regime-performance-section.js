import { getEquitySectorStyleRegimePerformanceSnapshot } from '../lib/repositories/macro-matrix-equity-sector-style-regime-performance.js';

function n(value, digits = 1) {
  if (value === null || value === undefined) return '—';
  const number = Number(value);
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: Math.abs(number) >= 100 ? 0 : digits,
    maximumFractionDigits: Math.abs(number) >= 100 ? 0 : digits,
  }).format(number);
}

function pct(value) {
  return value === null || value === undefined ? '—' : `${n(value, 1)}%`;
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

function tone(bias) {
  if (bias === 'OVERWEIGHT' || bias === 'SLIGHT_OVERWEIGHT') return 'tone-positive';
  if (bias === 'UNDERWEIGHT') return 'tone-caution';
  if (bias === 'AVOID') return 'tone-danger';
  return 'tone-neutral';
}

export default async function EquitySectorStyleRegimePerformanceSection() {
  const matrix = await getEquitySectorStyleRegimePerformanceSnapshot();
  if (!matrix) return null;

  const topRow = matrix.topRows?.[0] ?? null;

  return (
    <section className="card macro-matrix-card">
      <div className="macro-matrix-topline">
        <div>
          <p className="section-kicker">Macro · Equity Sector & Style Regime Performance</p>
          <h2>Aktiesektorer och stilfaktorer: USA och Europa</h2>
          <p className="hero-copy compact">
            Equity-only regime-performance matrix med Yahoo ETF-proxyer, månadsreturns och regimklassning från PMI Growth Momentum.
          </p>
        </div>
        <div className="macro-matrix-status">
          <span className={`mini-pill ${tone(topRow?.allocationBias)}`}>{topRow ? status(topRow.allocationBias) : 'No data'}</span>
          <strong>{topRow ? n(topRow.currentRegimeScore, 2) : '—'}</strong>
          <span>{status(matrix.currentRegime)} · {month(matrix.asOfDate)}</span>
        </div>
      </div>

      <div className="macro-matrix-metric-strip">
        <div className="macro-mini-stat"><span>Current regime</span><strong>{status(matrix.currentRegime)}</strong></div>
        <div className="macro-mini-stat"><span>Benchmark beta</span><strong>{matrix.benchmarkAssetKey}</strong></div>
        <div className="macro-mini-stat"><span>Rows live</span><strong>{matrix.availableRowCount ?? 0}/{matrix.totalRowCount ?? 0}</strong></div>
        <div className="macro-mini-stat"><span>Top fit</span><strong>{topRow ? topRow.label : 'No data'}</strong></div>
      </div>

      <div className="macro-matrix-scroll">
        <table className="macro-matrix-table">
          <thead>
            <tr>
              <th>Equity Sector / Style</th>
              {matrix.regimes.map((regime) => <th key={regime}>{status(regime)} avg</th>)}
              <th>Score</th>
              <th>Bias</th>
            </tr>
          </thead>
          <tbody>
            {matrix.rows.map((row) => (
              <tr key={row.key}>
                <th scope="row">
                  <div className="macro-row-label">{row.label}</div>
                </th>
                {row.regimeCells.map((cell) => (
                  <td className={`macro-cell macro-${cell.colorBucket}`} key={`${row.key}-${cell.regime}`}>
                    {pct(cell.avgReturn)}
                  </td>
                ))}
                <td>{row.currentRegimeScore === null ? '—' : n(row.currentRegimeScore, 2)}</td>
                <td><span className={`mini-pill ${tone(row.allocationBias)}`}>{status(row.allocationBias)}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="footnote">
        Euro/OMX-rader använder explicita ETF-proxyer när exakta fria sektorindex saknas. S&P 500-rader använder sektorspecifika ETF:er där sådana finns.
      </p>
    </section>
  );
}
