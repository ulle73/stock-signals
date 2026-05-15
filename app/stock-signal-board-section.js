import { getStockSignalBoardRows } from '../lib/repositories/stock-signal-board.js';
import { buildStockSignalBoardViewModel } from '../lib/utils/stock-signal-board-view.js';

function formatNumber(value, digits = 2) {
  if (value === null || value === undefined) return '—';
  return new Intl.NumberFormat('sv-SE', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(Number(value));
}

function formatPercent(value, digits = 2) {
  if (value === null || value === undefined) return '—';
  return `${formatNumber(value, digits)}%`;
}

function formatSignedPercent(value, digits = 2) {
  if (value === null || value === undefined) return '—';
  const number = Number(value);
  const sign = number > 0 ? '+' : '';
  return `${sign}${formatNumber(number, digits)}%`;
}

function formatDate(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('sv-SE', {
    dateStyle: 'medium',
    timeZone: 'UTC',
  }).format(new Date(`${value}T00:00:00Z`));
}

function sourceLabel(source) {
  if (source === 'indicator') return 'indikator';
  if (source === 'watchlist') return 'watchlist';
  return 'ingen aktiv historik';
}

function toneClass(tone) {
  return `tone-${tone || 'neutral'}`;
}

export default async function StockSignalBoardSection() {
  const rows = await getStockSignalBoardRows();
  const viewModel = buildStockSignalBoardViewModel(rows);

  if (!viewModel.rows.length) {
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
            ligger överst, och om en aktie är neutral visas senaste historiska signal separat.
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
          <span>RYD OBV aktiva</span>
          <strong>{viewModel.summary.obvActiveCount}</strong>
          <p className="footnote compact">buy/sell på senaste rad</p>
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
              <th>Watchlist</th>
            </tr>
          </thead>
          <tbody>
            {viewModel.rows.map((row) => (
              <tr key={row.ticker}>
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
                <td className="signal-board-watchlist-cell">
                  {row.watchlist ? (
                    <>
                      <strong>{row.watchlist.bias === 'long' ? 'Long watchlist' : 'Short watchlist'}</strong>
                      <span>
                        {row.watchlist.setup ?? '—'} · score {formatNumber(row.watchlist.score, 1)}
                      </span>
                    </>
                  ) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="footnote stock-signal-board-footnote">
        Basen kommer från `stock_daily_indicators`. `swing_watchlist_daily` adderas som extra
        aktiesignal när tickern finns i senaste watchlist-snapshoten.
        {watchlistIsLagging
          ? ` Watchlisten ligger just nu en dag efter indikatorsnapshoten (${formatDate(viewModel.summary.latestWatchlistDate)} vs ${formatDate(viewModel.summary.latestIndicatorDate)}).`
          : ''}
      </p>
    </section>
  );
}
