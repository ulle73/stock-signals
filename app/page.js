import { getDashboardSnapshot } from '../lib/repositories/dashboard.js';
import {
  buildMarketSeriesCards,
  normalizeTickerInput,
} from '../lib/utils/dashboard-view.js';

export const dynamic = 'force-dynamic';

function formatNumber(value, options = {}) {
  if (value === null || value === undefined) {
    return 'No data';
  }

  return new Intl.NumberFormat('en-US', options).format(Number(value));
}

function formatDate(value) {
  if (!value) {
    return 'No data';
  }

  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeZone: 'UTC',
  }).format(new Date(`${value}T00:00:00Z`));
}

function formatTimestamp(value) {
  if (!value) {
    return 'Still running';
  }

  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'UTC',
  }).format(new Date(value));
}

function formatStatus(value) {
  if (!value) {
    return 'Unknown';
  }

  return value.replaceAll('_', ' ');
}

function statusTone(status) {
  return status === 'success'
    ? 'var(--accent)'
    : status === 'partial_success'
      ? '#8b5e00'
      : 'var(--danger)';
}

function renderPriceRow(row) {
  return (
    <tr key={row.date}>
      <td>{formatDate(row.date)}</td>
      <td>{formatNumber(row.close, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
      <td>{formatNumber(row.adj_close, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
      <td>{formatNumber(row.sma5, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
      <td>{formatNumber(row.sma10, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
      <td>{formatNumber(row.sma20, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
      <td>{formatNumber(row.sma50, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
      <td>{formatNumber(row.sma200, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
      <td>{formatNumber(row.volume)}</td>
    </tr>
  );
}

export default async function Home({ searchParams }) {
  const resolvedSearchParams = await searchParams;
  const selectedTicker = normalizeTickerInput(resolvedSearchParams?.ticker);
  const snapshot = await getDashboardSnapshot(selectedTicker);
  const marketCards = buildMarketSeriesCards(snapshot.marketSeries);
  const tickerCompany = snapshot.tickerSnapshot.company;
  const tickerStats = snapshot.tickerSnapshot.stats;
  const latestRun = snapshot.latestRun;
  const coverage = snapshot.coverage;

  return (
    <main className="page-shell">
      <section className="hero-card">
        <p className="eyebrow">Stock Signals</p>
        <div className="hero-grid">
          <div>
            <h1>Production market data, readable in one place.</h1>
            <p className="hero-copy">
              This view is the handoff between raw market data and the later indicator,
              threshold, and Telegram alert pipeline.
            </p>
          </div>
          <div className="hero-panel">
            <p className="panel-label">Latest fetch run</p>
            <strong
              className="status-pill"
              style={{ color: statusTone(latestRun?.status) }}
            >
              {formatStatus(latestRun?.status)}
            </strong>
            <p className="panel-copy">
              {latestRun
                ? `${latestRun.successful_items ?? 0}/${latestRun.total_items ?? 0} items, finished ${formatTimestamp(latestRun.finished_at)}`
                : 'No fetch run has been recorded yet.'}
            </p>
          </div>
        </div>
      </section>

      <section className="dashboard-grid">
        <article className="card">
          <p className="section-kicker">Coverage</p>
          <div className="metric-grid">
            <div className="metric-tile">
              <span>Active tickers</span>
              <strong>{formatNumber(coverage.active_ticker_count)}</strong>
            </div>
            <div className="metric-tile">
              <span>Tickers with prices</span>
              <strong>{formatNumber(coverage.priced_ticker_count)}</strong>
            </div>
            <div className="metric-tile">
              <span>Total price rows</span>
              <strong>{formatNumber(coverage.total_price_rows)}</strong>
            </div>
            <div className="metric-tile">
              <span>Latest stock date</span>
              <strong>{formatDate(coverage.latest_price_date)}</strong>
            </div>
          </div>
          <p className="footnote">
            Historical stock coverage spans {formatDate(coverage.earliest_price_date)} to {formatDate(coverage.latest_price_date)}.
          </p>
        </article>

        <article className="card">
          <p className="section-kicker">Macro series</p>
          <div className="series-list">
            {marketCards.map((card) => (
              <div className="series-row" key={card.seriesId}>
                <div>
                  <p className="series-label">{card.label}</p>
                  <p className="series-copy">{card.description}</p>
                </div>
                <div className="series-value-block">
                  <strong>{card.value ? formatNumber(card.value, { maximumFractionDigits: 2 }) : 'No data'}</strong>
                  <span>{formatDate(card.date)}</span>
                </div>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="detail-grid">
        <article className="card">
          <div className="ticker-header">
            <div>
              <p className="section-kicker">Ticker drilldown</p>
              <h2>{selectedTicker}</h2>
              <p className="hero-copy compact">
                {tickerCompany
                  ? `${tickerCompany.company_name} · ${tickerCompany.sector ?? 'Sector unknown'}`
                  : 'Ticker not found in the active constituent list.'}
              </p>
            </div>
            <form className="ticker-form">
              <label htmlFor="ticker">Ticker</label>
              <div className="ticker-form-row">
                <input
                  id="ticker"
                  name="ticker"
                  defaultValue={selectedTicker}
                  placeholder="AAPL"
                />
                <button type="submit">Load</button>
              </div>
            </form>
          </div>

          <div className="metric-grid compact-grid">
            <div className="metric-tile">
              <span>Rows stored</span>
              <strong>{formatNumber(tickerStats.row_count)}</strong>
            </div>
            <div className="metric-tile">
              <span>First date</span>
              <strong>{formatDate(tickerStats.first_date)}</strong>
            </div>
            <div className="metric-tile">
              <span>Latest date</span>
              <strong>{formatDate(tickerStats.latest_date)}</strong>
            </div>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Close</th>
                  <th>Adj close</th>
                  <th>SMA5</th>
                  <th>SMA10</th>
                  <th>SMA20</th>
                  <th>SMA50</th>
                  <th>SMA200</th>
                  <th>Volume</th>
                </tr>
              </thead>
              <tbody>
                {snapshot.tickerSnapshot.prices.length
                  ? snapshot.tickerSnapshot.prices.map(renderPriceRow)
                  : (
                    <tr>
                      <td colSpan="9">No prices available for this ticker.</td>
                    </tr>
                  )}
              </tbody>
            </table>
          </div>
        </article>

        <article className="card roadmap-card">
          <p className="section-kicker">Alert path</p>
          <h2>Indicators first, rules second, Telegram last.</h2>
          <ol className="path-list">
            <li>Define the indicator formulas and warmup rules.</li>
            <li>Persist daily indicator values in dedicated tables.</li>
            <li>Store threshold rules per indicator, direction, and channel.</li>
            <li>Dispatch matching rule hits to one or more Telegram channels.</li>
          </ol>
          <p className="footnote">
            Thresholds and alert logic should not be hardcoded into the fetch job.
            They should sit on top of saved indicator values so rules can change
            without rebuilding the raw data layer.
          </p>
        </article>
      </section>
    </main>
  );
}
