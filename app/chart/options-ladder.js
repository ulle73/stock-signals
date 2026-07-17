'use client';

import {
  buildOptionsLadderHistory,
  buildOptionsLadderModel,
} from '../../lib/chart/options-ladder.js';

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

function formatHistoryDate(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('sv-SE', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${value}T00:00:00Z`));
}

function LevelHistoryTooltip({ history, row }) {
  const tooltipId = `options-ladder-history-${row.key}`;

  if (!history.length) {
    return <span className="options-ladder-badge">{row.label}</span>;
  }

  return (
    <div className="options-ladder-history-cell">
      <button
        type="button"
        className="options-ladder-history-trigger"
        aria-describedby={tooltipId}
        aria-label={`${row.label}: visa de senaste ${history.length} nivåerna`}
      >
        <span className="options-ladder-badge">{row.label}</span>
      </button>

      <div
        id={tooltipId}
        className="options-ladder-history-tooltip"
        role="tooltip"
        style={{ '--options-level-color': row.color }}
      >
        <header className="options-ladder-history-header">
          <span className="options-ladder-history-swatch" aria-hidden="true" />
          <div>
            <strong>{row.label}</strong>
            <span>Senaste 10 nivåerna</span>
          </div>
        </header>

        <div className="options-ladder-history-columns" aria-hidden="true">
          <span>Datum</span>
          <span>Nivå</span>
          <span>Δ</span>
        </div>

        <ol className="options-ladder-history-list">
          {history.map((item, index) => (
            <li
              key={`${row.key}-${item.sourceTimestamp ?? item.date}-${index}`}
              className={index === 0 ? 'is-latest' : undefined}
            >
              <time dateTime={item.date}>{formatHistoryDate(item.date)}</time>
              <strong>{formatNumber(item.value)}</strong>
              <span>{formatSigned(item.delta, 2)}</span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

export default function OptionsLadder({ latestPrice, snapshots = [] }) {
  const snapshot = snapshots.at(-1) ?? null;
  const model = buildOptionsLadderModel({ latestPrice, snapshot });
  const historyByKey = buildOptionsLadderHistory({ snapshots, limit: 10 });
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
                <td>
                  <LevelHistoryTooltip history={historyByKey[row.key] ?? []} row={row} />
                </td>
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
