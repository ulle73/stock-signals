import { StockSparklineCell } from './stock-sparkline-cell.js';

function visibleSparklineRows(rows = []) {
  return rows.filter((row) => row?.ticker && row?.sparkline50d?.path);
}

export function StockSparklineGrid({ rows = [] }) {
  const sparklineRows = visibleSparklineRows(rows);

  if (!sparklineRows.length) {
    return null;
  }

  return (
    <section className="card" style={{ display: 'grid', gap: 14, padding: 20 }}>
      <div style={{ display: 'flex', gap: 12, justifyContent: 'space-between', alignItems: 'baseline' }}>
        <div>
          <p className="section-kicker" style={{ marginBottom: 8 }}>50d trend · synliga tickers</p>
          <h2 style={{ fontSize: '1.25rem', marginBottom: 0 }}>Mini-charts för laddade aktier</h2>
        </div>
        <span className="mini-pill tone-neutral">{sparklineRows.length} charts</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(164px, 1fr))', gap: 10 }}>
        {sparklineRows.map((row) => (
          <article
            key={`sparkline-${row.ticker}`}
            style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 16, display: 'grid', gap: 8, padding: 12 }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'baseline' }}>
              <strong>{row.ticker}</strong>
              <span style={{ color: 'var(--muted)', fontSize: '0.78rem' }}>{row.sector ?? '—'}</span>
            </div>
            <StockSparklineCell sparkline={row.sparkline50d} />
          </article>
        ))}
      </div>
    </section>
  );
}
