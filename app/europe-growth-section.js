import { getEuropeGrowthMatrixSnapshot } from '../lib/repositories/europe-growth-indicators.js';

function n(value, digits = 1) {
  if (value === null || value === undefined) return '—';
  const number = Number(value);
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: Math.abs(number) >= 100 ? 0 : digits,
    maximumFractionDigits: Math.abs(number) >= 100 ? 0 : digits,
  }).format(number);
}

function pct(value) {
  return value === null || value === undefined ? '—' : `${n(value, 0)}%`;
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

function tone(action) {
  if (action === 'RISK_ON' || action === 'NEUTRAL_TO_RISK_ON') return 'tone-positive';
  if (action === 'NO_NEW_BUYS') return 'tone-caution';
  if (action === 'REDUCE_RISK' || action === 'GO_TO_CASH') return 'tone-danger';
  return 'tone-neutral';
}

function delta(value) {
  if (value === null || value === undefined) return '—';
  return `${Number(value) > 0 ? '+' : ''}${n(value)}`;
}

export default async function EuropeGrowthSection() {
  const matrix = await getEuropeGrowthMatrixSnapshot();
  if (!matrix) return null;

  const latest = matrix.latest ?? null;
  const validMonths = matrix.summaryByMonth?.filter((item) => !item.isPartial) ?? [];
  const previous = validMonths.at(-2) ?? null;
  const positiveDelta = latest?.percentPositive !== null && latest?.percentPositive !== undefined && previous?.percentPositive !== null && previous?.percentPositive !== undefined
    ? Number(latest.percentPositive) - Number(previous.percentPositive)
    : null;

  return (
    <div className="page-shell europe-growth-page-shell">
      <section className="card macro-matrix-card">
        <div className="macro-matrix-topline">
          <div>
            <p className="section-kicker">Macro · Europe Growth Indicators</p>
            <h2>Europa: tillväxtindikatorer</h2>
            <p className="hero-copy compact">
              Separat europeisk growth-matrix med Eurozone/Germany sentiment, PMI, retail sales och car registrations. Sentix är exkluderad tills stabil gratis källa finns.
            </p>
          </div>
          <div className="macro-matrix-status">
            <span className={`mini-pill ${tone(latest?.macroGrowthRiskAction)}`}>{status(latest?.macroGrowthRiskAction)}</span>
            <strong>{n(latest?.macroGrowthScore, 2)}</strong>
            <span>score · {month(latest?.periodDate)}</span>
          </div>
        </div>

        <div className="macro-matrix-metric-strip">
          <div className="macro-mini-stat"><span>Regim</span><strong>{status(latest?.macroGrowthRegime)}</strong></div>
          <div className="macro-mini-stat"><span>% positiva</span><strong>{pct(latest?.percentPositive)}</strong></div>
          <div className="macro-mini-stat"><span>Senaste månadstäckning</span><strong>{latest?.validRowCount ?? 0}/{matrix.totalRowCount ?? 0}</strong></div>
          <div className="macro-mini-stat"><span>Europe-rader live</span><strong>{matrix.availableRowCount ?? 0}/{matrix.totalRowCount ?? 0}</strong></div>
        </div>

        <div className="macro-matrix-scroll">
          <table className="macro-matrix-table">
            <thead>
              <tr>
                <th>Europe Growth Indicators</th>
                {matrix.months.map((periodDate) => <th key={periodDate}>{month(periodDate)}</th>)}
                {matrix.quarters.map((quarter) => <th className="macro-quarter-head" key={quarter.key}>{quarter.label}</th>)}
                <th className="macro-delta-head">Δ</th>
              </tr>
            </thead>
            <tbody>
              {matrix.rows.map((row) => (
                <tr key={row.key}>
                  <th scope="row"><div className="macro-row-label">{row.label}</div></th>
                  {row.cells.map((cell) => (
                    <td className={`macro-cell macro-${cell.colorBucket}`} key={`${row.key}-${cell.periodDate}`}>
                      {cell.transformedValue === null ? '—' : n(cell.transformedValue)}
                    </td>
                  ))}
                  {row.quarterlyCells.map((cell) => (
                    <td className={`macro-cell macro-cell-quarter macro-${cell.colorBucket}`} key={`${row.key}-${cell.quarterKey}`}>
                      {cell.transformedValue === null ? '—' : n(cell.transformedValue)}
                    </td>
                  ))}
                  <td className={`macro-delta-cell delta-${row.deltaDirection}`}>{delta(row.delta)}</td>
                </tr>
              ))}
              <tr className="macro-summary-row">
                <th scope="row">% Positive Change M/M</th>
                {matrix.summaryByMonth.map((item) => <td key={item.periodDate}>{pct(item.percentPositive)}</td>)}
                {matrix.summaryByQuarter.map((item) => <td className="macro-cell-quarter" key={item.quarterKey}>{pct(item.percentPositive)}</td>)}
                <td className={`macro-delta-cell ${positiveDelta === null ? 'delta-flat' : positiveDelta > 0 ? 'delta-up' : positiveDelta < 0 ? 'delta-down' : 'delta-flat'}`}>{delta(positiveDelta)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <p className="footnote">Detta är en egen tabell, separat från USA Growth och Global Manufacturing PMI. Historiken byggs framåt när månadsvärden sparas.</p>
      </section>
    </div>
  );
}
