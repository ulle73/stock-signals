import { Fragment } from 'react';
import { formatUtcDate, formatUtcDateTime } from '../lib/utils/date-format.js';

function formatNumber(value, digits = 2) {
  if (value === null || value === undefined) return '—';
  return new Intl.NumberFormat('sv-SE', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(Number(value));
}

function formatDate(value) {
  return formatUtcDate(value);
}

function formatDateTime(value) {
  return formatUtcDateTime(value);
}

function formatSignedPercent(value, digits = 2) {
  if (value === null || value === undefined) return '—';
  const number = Number(value);
  const sign = number > 0 ? '+' : '';
  return `${sign}${formatNumber(number, digits)}%`;
}

function sourceLabel(source) {
  if (source === 'indicator') return 'indikator';
  if (source === 'watchlist') return 'watchlist';
  return 'ingen aktiv historik';
}

function toneClass(tone) {
  return `tone-${tone || 'neutral'}`;
}

function formatMetricValue(value) {
  if (value === null || value === undefined || value === '') {
    return '—';
  }

  if (value instanceof Date) {
    return formatDateTime(value);
  }

  if (typeof value === 'number') {
    if (Number.isInteger(value)) {
      return formatNumber(value, 0);
    }

    return formatNumber(value, Math.abs(value) >= 100 ? 1 : 2);
  }

  if (
    typeof value === 'string'
    && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value)
  ) {
    return formatDateTime(value);
  }

  return value;
}

export function StockSignalBoardLoadingCard({
  title = 'Stock Signal Board laddar',
  copy = 'Bygger aktietabellen med alla aktiva signalchips i bakgrunden.',
}) {
  return (
    <section className="card stock-signal-board-card">
      <div className="stock-signal-board-topline">
        <div>
          <p className="section-kicker">Aktiesignaler · Samlad vy</p>
          <h2>{title}</h2>
          <p className="hero-copy compact">{copy}</p>
        </div>
      </div>
    </section>
  );
}

export function StockSignalBoardView({ viewModel, hasMore = false, isLoadingMore = false, onLoadMore = null }) {
  if (!viewModel?.rows?.length) {
    return null;
  }

  const watchlistIsLagging =
    viewModel.summary.latestIndicatorDate &&
    viewModel.summary.latestWatchlistDate &&
    viewModel.summary.latestWatchlistDate < viewModel.summary.latestIndicatorDate;

  return (
    <section className="card stock-signal-board-card">
      <div className="stock-signal-board-topline">
        <div>
          <p className="section-kicker">Aktiesignaler · Samlad vy</p>
          <h2>Alla aktier, aktiva signaler först</h2>
          <p className="hero-copy compact">
            Tabellen visar senaste indikatorrad för hela universet. Aktier med aktiv signal idag
            ligger överst, och varje ticker kan fällas ut för att visa alla aktieindikatorer,
            även när de är neutrala.
          </p>
        </div>

        <div className="stock-signal-board-status">
          <span className={`mini-pill ${toneClass(viewModel.summary.activeNowCount ? 'positive' : 'neutral')}`}>
            {viewModel.summary.activeNowCount}/{viewModel.summary.totalTickers} aktiva nu
          </span>
          <strong>{formatDate(viewModel.summary.latestIndicatorDate)}</strong>
          <span>senaste indikatorsnapshot</span>
        </div>
      </div>

      <div className="stock-signal-board-metric-strip">
        <div className="metric-tile">
          <span>Totalt univers</span>
          <strong>{viewModel.summary.totalTickers}</strong>
          <p className="footnote compact">aktiva S&amp;P 500-tickers med signalvy</p>
        </div>
        <div className="metric-tile">
          <span>Aktiva nu</span>
          <strong>{viewModel.summary.activeNowCount}</strong>
          <p className="footnote compact">minst en aktiesignal eller watchlist just nu</p>
        </div>
        <div className="metric-tile">
          <span>RYD OBV aktiva</span>
          <strong>{viewModel.summary.obvActiveCount}</strong>
          <p className="footnote compact">buy/sell på senaste rad</p>
        </div>
        <div className="metric-tile">
          <span>Price z-score</span>
          <strong>{viewModel.summary.priceZscoreActiveCount}</strong>
          <p className="footnote compact">reversal-signal via z-score-kors</p>
        </div>
        <div className="metric-tile">
          <span>IBS + RSI</span>
          <strong>{viewModel.summary.ibsRsiActiveCount}</strong>
          <p className="footnote compact">mean-reversion med översåld trigger</p>
        </div>
        <div className="metric-tile">
          <span>MACD-V</span>
          <strong>{viewModel.summary.macdVActiveCount}</strong>
          <p className="footnote compact">trendstatus via volatilitet-normaliserad MACD</p>
        </div>
        <div className="metric-tile">
          <span>20d breakout</span>
          <strong>{viewModel.summary.breakoutActiveCount}</strong>
          <p className="footnote compact">utbrott över 20-dagarsintervall</p>
        </div>
        <div className="metric-tile">
          <span>TF Sync</span>
          <strong>{viewModel.summary.tfSyncActiveCount}</strong>
          <p className="footnote compact">1W + 1D + senaste 60m i samma färgriktning</p>
        </div>
        <div className="metric-tile">
          <span>PLCE threshold</span>
          <strong>{viewModel.summary.plceActiveCount}</strong>
          <p className="footnote compact">short-volymtröskel aktiv på senaste rad</p>
        </div>
        <div className="metric-tile">
          <span>Volymavvikelser</span>
          <strong>{viewModel.summary.volumeActiveCount}</strong>
          <p className="footnote compact">accumulation, distribution eller extremvolym</p>
        </div>
        <div className="metric-tile">
          <span>Watchlist-tickers</span>
          <strong>{viewModel.summary.watchlistCount}</strong>
          <p className="footnote compact">
            snapshot {formatDate(viewModel.summary.latestWatchlistDate)}
            {watchlistIsLagging ? ' · äldre än indikatorraden' : ''}
          </p>
        </div>
      </div>

      <div className="table-wrap signal-board-wrap">
        <table className="signal-board-table">
          <thead>
            <tr>
              <th>Ticker</th>
              <th>Bolag</th>
              <th>Sektor</th>
              <th>Pris</th>
              <th>1d</th>
              <th>RVOL20</th>
              <th>Aktiv nu</th>
              <th>Senast aktiv</th>
              <th>Detaljer</th>
            </tr>
          </thead>
          <tbody>
            {viewModel.rows.map((row) => {
              const activeDetailCount = row.indicatorDetails.filter((item) => item.isActive).length;

              return (
                <Fragment key={row.ticker}>
                  <tr className="signal-board-primary-row">
                    <td className="signal-board-ticker-cell">
                      <strong>{row.ticker}</strong>
                    </td>
                    <td className="signal-board-company-cell">
                      <strong>{row.companyName}</strong>
                      <span>{formatDate(row.currentDate)}</span>
                    </td>
                    <td>{row.sector ?? '—'}</td>
                    <td>{formatNumber(row.currentPrice)}</td>
                    <td className={`signal-board-return-cell ${toneClass(row.dailyReturnPct > 0 ? 'positive' : row.dailyReturnPct < 0 ? 'danger' : 'neutral')}`}>
                      {formatSignedPercent(row.dailyReturnPct)}
                    </td>
                    <td>{formatNumber(row.relativeVolume20)}</td>
                    <td>
                      <div className="signal-board-pill-stack">
                        {row.currentSignals.length
                          ? row.currentSignals.map((signal) => (
                            <span className={`mini-pill ${toneClass(signal.tone)}`} key={`${row.ticker}-${signal.key}`}>
                              {signal.label}
                            </span>
                          ))
                          : <span className={`mini-pill ${toneClass('neutral')}`}>Neutral</span>}
                      </div>
                    </td>
                    <td className="signal-board-latest-cell">
                      <strong>{row.latestSignal.label}</strong>
                      <span>{formatDate(row.latestSignal.date)} · {sourceLabel(row.latestSignal.source)}</span>
                    </td>
                    <td className="signal-board-detail-count-cell">
                      <strong>{activeDetailCount}/{row.indicatorDetails.length}</strong>
                      <span>signaler aktiva</span>
                    </td>
                  </tr>
                  <tr className="signal-board-detail-row">
                    <td colSpan={9}>
                      <details className="signal-board-details">
                        <summary className="signal-board-detail-summary">
                          <div className="signal-board-detail-summary-copy">
                            <strong>Visa alla indikatorer för {row.ticker}</strong>
                            <span>
                              {row.currentSignals.length
                                ? `${row.currentSignals.length} aktiva signaler nu. Senast aktiv: ${row.latestSignal.label}.`
                                : 'Alla aktieindikatorer är neutrala på senaste raden.'}
                            </span>
                          </div>
                          <span className={`mini-pill ${toneClass(row.currentSignalTone)}`}>
                            {activeDetailCount}/{row.indicatorDetails.length}
                          </span>
                        </summary>
                        <div className="signal-board-detail-grid">
                          {row.indicatorDetails.map((item) => (
                            <article
                              className="signal-board-detail-card"
                              data-tone={item.tone}
                              key={`${row.ticker}-${item.key}`}
                            >
                              <div className="signal-board-detail-card-head">
                                <div>
                                  <p className="panel-label">{item.label}</p>
                                  <strong>{item.signalLabel}</strong>
                                </div>
                                <span className={`mini-pill ${toneClass(item.tone)}`}>
                                  {item.isActive ? 'Aktiv' : 'Neutral'}
                                </span>
                              </div>

                              {item.metrics.length ? (
                                <dl className="signal-board-detail-metrics">
                                  {item.metrics.map((metric) => (
                                    <div className="signal-board-detail-metric" key={`${row.ticker}-${item.key}-${metric.label}`}>
                                      <dt>{metric.label}</dt>
                                      <dd>{formatMetricValue(metric.value)}</dd>
                                    </div>
                                  ))}
                                </dl>
                              ) : (
                                <p className="footnote compact">
                                  Ingen extra datapunkt på senaste raden.
                                </p>
                              )}
                            </article>
                          ))}
                        </div>
                      </details>
                    </td>
                  </tr>
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {viewModel.pagination ? (
        <div className="stock-signal-board-pagination">
          <p className="footnote compact stock-signal-board-footnote">
            Visar {viewModel.rows.length} av {viewModel.pagination.totalRows} tickers i tabellen.
          </p>
          {hasMore && onLoadMore ? (
            <button
              className="stock-signal-board-load-more"
              disabled={isLoadingMore}
              onClick={onLoadMore}
              type="button"
            >
              {isLoadingMore ? 'Laddar fler…' : 'Ladda fler'}
            </button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
