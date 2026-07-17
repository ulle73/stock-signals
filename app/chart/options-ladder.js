'use client';

import { buildOptionsLadderModel } from '../../lib/chart/options-ladder.js';

function formatNumber(value, digits = 2) {
  if (!Number.isFinite(Number(value))) return '—';
  return Number(value).toLocaleString('sv-SE', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function formatCompact(value) {
  if (!Number.isFinite(Number(value))) return '—';
  return new Intl.NumberFormat('sv-SE', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(Number(value));
}

function formatSigned(value, digits, suffix = '') {
  if (!Number.isFinite(Number(value))) return '—';
  const normalized = Math.abs(Number(value)) < (0.5 * (10 ** -digits)) ? 0 : Number(value);
  return `${new Intl.NumberFormat('sv-SE', {
    signDisplay: 'always',
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(normalized)}${suffix}`;
}

export default function OptionsLadder({ latestPrice, snapshots = [] }) {
  const snapshot = snapshots.at(-1) ?? null;
  const model = buildOptionsLadderModel({ latestPrice, snapshot });
  const sourceTitle = model.sourceTimestamp
    ? `Senaste providersnapshot ${new Intl.DateTimeFormat('sv-SE', {
      dateStyle: 'medium', timeStyle: 'short',
    }).format(new Date(model.sourceTimestamp))}`
    : 'Ingen providersnapshot för vald ticker.';

  return (
    <aside className="options-ladder" aria-label="Options Ladder">
      <header className="options-ladder-header">
        <h2>Options Ladder</h2>
        <span className="options-ladder-info" title={sourceTitle} aria-label={sourceTitle}>ⓘ</span>
      </header>

      <section className="options-ladder-overview" aria-label="Lägesöversikt">
        <span className="options-ladder-kicker">Lägesöversikt</span>
        <strong className={`options-ladder-state tone-${model.state.tone}`}>{model.state.label}</strong>
        <div className="options-ladder-net-grid">
          <div>
            <span>Net GEX</span>
            <strong className={Number(model.netGex) < 0 ? 'tone-danger' : Number(model.netGex) > 0 ? 'tone-positive' : 'tone-neutral'}>
              {formatCompact(model.netGex)}
            </strong>
          </div>
          <div>
            <span>Net DEX</span>
            <strong className={Number(model.netDex) < 0 ? 'tone-danger' : Number(model.netDex) > 0 ? 'tone-positive' : 'tone-neutral'}>
              {formatCompact(model.netDex)}
            </strong>
          </div>
        </div>
      </section>

      {model.rows.length ? (
        <table className="options-ladder-table">
          <thead>
            <tr>
              <th>Nivå</th>
              <th>Typ</th>
              <th>Avstånd</th>
            </tr>
          </thead>
          <tbody>
            {model.rows.map((row) => (
              <tr key={row.key} style={{ '--options-level-color': row.color }}>
                <td>{formatNumber(row.price)}</td>
                <td><span className="options-ladder-badge">{row.label}</span></td>
                <td>
                  <strong>{formatSigned(row.distancePct, 1, '%')}</strong>
                  <span>{formatSigned(row.distanceValue, 2)}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="options-ladder-empty">
          <strong>Inga optionsnivåer</strong>
          <span>Snapshotdata saknas för vald ticker.</span>
        </div>
      )}

      <footer className="options-ladder-footer">
        <span aria-hidden="true">ⓘ</span>
        <span>Avstånd i % relativt aktuell kurs ({formatNumber(latestPrice)})</span>
      </footer>
    </aside>
  );
}
