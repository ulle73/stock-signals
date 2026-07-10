import DashboardIcon from './dashboard-icons.js';

const sectorLabels = {
  'Communication Services': 'Kommunikation',
  'Consumer Discretionary': 'Sällanköp',
  'Consumer Staples': 'Dagligvaror',
  Energy: 'Energi',
  Financials: 'Finans',
  'Health Care': 'Hälsovård',
  Industrials: 'Industri',
  'Information Technology': 'Teknik',
  Materials: 'Material',
  'Real Estate': 'Fastigheter',
  Utilities: 'Kraftförsörjning',
};

const sectorIcons = {
  'Communication Services': 'eye',
  'Consumer Discretionary': 'grid',
  'Consumer Staples': 'database',
  Energy: 'signal',
  Financials: 'shield',
  'Health Care': 'target',
  Industrials: 'layers',
  'Information Technology': 'signal',
  Materials: 'layers',
  'Real Estate': 'grid',
  Utilities: 'gauge',
};

function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatSigned(value, suffix = '%', digits = 1) {
  const parsed = number(value);
  if (parsed === null) return '—';
  return `${parsed > 0 ? '+' : ''}${parsed.toFixed(digits)}${suffix}`;
}

function valueTone(value) {
  const parsed = number(value);
  if (parsed === null || parsed === 0) return 'neutral';
  return parsed > 0 ? 'positive' : 'negative';
}

function sparklinePath(points) {
  const values = (points ?? []).map(number).filter((value) => value !== null);
  if (values.length < 2) return '';

  const minimum = Math.min(...values);
  const maximum = Math.max(...values);
  const range = maximum - minimum || 1;

  return values.map((value, index) => {
    const x = (index / (values.length - 1)) * 100;
    const y = 22 - ((value - minimum) / range) * 18;
    return `${index === 0 ? 'M' : 'L'}${x.toFixed(2)} ${y.toFixed(2)}`;
  }).join(' ');
}

function AccelerationSegments({ value }) {
  const parsed = number(value);
  const tone = valueTone(parsed);
  const count = parsed === null ? 0 : Math.min(8, Math.max(1, Math.round(Math.abs(parsed) * 1.5)));

  return (
    <div className="acceleration-cell">
      <span className={`sector-return is-${tone}`}>{formatSigned(parsed, ' pp', 2)}</span>
      <span className="acceleration-segments" data-tone={tone} aria-label={`Acceleration ${formatSigned(parsed, ' procentenheter', 2)}`}>
        {Array.from({ length: 8 }, (_, index) => <i className={index < count ? 'is-active' : undefined} key={index} />)}
      </span>
    </div>
  );
}

function TrendSparkline({ points, value }) {
  const tone = valueTone(value);
  const path = sparklinePath(points);

  if (!path) return <span className="sector-no-trend">—</span>;

  return (
    <svg className={`sector-sparkline is-${tone}`} viewBox="0 0 100 24" role="img" aria-label="21 handelsdagars sektortrend">
      <path d={path} fill="none" pathLength="1" />
    </svg>
  );
}

export default function SectorOverviewMatrix({ snapshot }) {
  if (!snapshot?.rows?.length) return null;

  return (
    <article className="sector-overview-card">
      <header className="sector-overview-header">
        <div>
          <p className="section-kicker">Sektorer – alla på en ögonblick</p>
          <h2>Sektorrotation och momentum</h2>
        </div>
        <p>Styrka = befintlig RS 63D-percentil. Avkastning och acceleration bygger på lagrade dagliga sektorrörelser.</p>
      </header>

      <div className="sector-overview-scroll">
        <table className="sector-overview-table">
          <thead>
            <tr>
              <th scope="col">Sektor</th>
              <th scope="col">Styrka <small>(relativt index)</small></th>
              <th scope="col">1D</th>
              <th scope="col">1W</th>
              <th scope="col">1M</th>
              <th scope="col">ROC 5D / Acceleration</th>
              <th scope="col">Trend <small>(1M)</small></th>
            </tr>
          </thead>
          <tbody>
            {snapshot.rows.map((row) => {
              const strength = number(row.strength);
              const trendValue = row.sparkline?.at(-1) ?? row.return1m;

              return (
                <tr key={row.sector}>
                  <th scope="row">
                    <span className="sector-name">
                      <DashboardIcon name={sectorIcons[row.sector] ?? 'layers'} size={15} />
                      {sectorLabels[row.sector] ?? row.sector}
                    </span>
                  </th>
                  <td>
                    <div className="sector-strength">
                      <strong>{strength === null ? '—' : strength.toFixed(0)}</strong>
                      <span className="sector-strength-bar" aria-label={strength === null ? 'Styrka saknas' : `Relativ styrka ${strength.toFixed(0)} av 100`}>
                        <i style={{ '--strength': `${strength ?? 0}%` }} />
                      </span>
                    </div>
                  </td>
                  <td><span className={`sector-return is-${valueTone(row.return1d)}`}>{formatSigned(row.return1d)}</span></td>
                  <td><span className={`sector-return is-${valueTone(row.return1w)}`}>{formatSigned(row.return1w)}</span></td>
                  <td><span className={`sector-return is-${valueTone(row.return1m)}`}>{formatSigned(row.return1m)}</span></td>
                  <td><AccelerationSegments value={row.acceleration5d} /></td>
                  <td><TrendSparkline points={row.sparkline} value={trendValue} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <footer className="sector-overview-legend">
        <span><i className="legend-dot is-positive" /> Grönt = förbättring eller positiv avkastning</span>
        <span><i className="legend-dot is-negative" /> Rött = försämring eller negativ avkastning</span>
        <span>ROC 5D jämförs med föregående fem handelsdagar.</span>
      </footer>
    </article>
  );
}
