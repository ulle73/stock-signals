import { getDashboardSnapshot } from '../lib/repositories/dashboard.js';
import { interpretMarketSignal } from '../lib/utils/signal-interpretation.js';
import {
  buildMarketSeriesCards,
  buildPositionStatusViewModel,
  normalizeTickerInput,
} from '../lib/utils/dashboard-view.js';

export const dynamic = 'force-dynamic';

function formatNumber(value, options = {}) {
  if (value === null || value === undefined) return 'No data';
  return new Intl.NumberFormat('en-US', options).format(Number(value));
}

function formatDate(value) {
  if (!value) return 'No data';
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeZone: 'UTC',
  }).format(new Date(`${value}T00:00:00Z`));
}

function formatTimestamp(value) {
  if (!value) return 'Still running';
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'UTC',
  }).format(new Date(value));
}

function formatStatus(value) {
  if (!value) return 'Unknown';
  return value.replaceAll('_', ' ');
}

function formatPercent(value, digits = 2) {
  if (value === null || value === undefined) return 'No data';
  return `${formatNumber(value, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}%`;
}

function formatPoints(value, digits = 1) {
  if (value === null || value === undefined) return 'No data';
  const number = Number(value);
  const sign = number > 0 ? '+' : '';
  return `${sign}${number.toFixed(digits)} pp`;
}

function statusTone(status) {
  return status === 'success'
    ? 'var(--accent)'
    : status === 'partial_success'
      ? '#8b5e00'
      : 'var(--danger)';
}

function toneClass(tone) {
  return `tone-${tone || 'neutral'}`;
}

function renderBacktestRow(row) {
  return (
    <tr key={row.code}>
      <td>{row.name}</td>
      <td>{formatPercent(row.cagr)}</td>
      <td>{formatPercent(row.max_drawdown)}</td>
      <td>{formatPercent(row.time_in_market_pct)}</td>
      <td>{formatTimestamp(row.finished_at)}</td>
    </tr>
  );
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

function renderRecentSignalRow(row) {
  const interpretation = interpretMarketSignal(row);

  return (
    <tr key={row.date}>
      <td>{formatDate(row.date)}</td>
      <td>
        <span className={`mini-pill ${toneClass(interpretation.tone)}`}>
          {interpretation.emoji} {interpretation.headlineLabel}
        </span>
      </td>
      <td>{interpretation.displayScore ?? 'No data'}</td>
      <td>{formatPercent(row.pct_above_50)}</td>
      <td>{formatPoints(row.pct_above_50_14d_change)}</td>
      <td>{formatStatus(row.divergence_status)}</td>
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
  const latestSignal = snapshot.latestSignal;
  const interpretation = interpretMarketSignal(latestSignal);
  const backtests = snapshot.backtests;
  const recentSignals = snapshot.recentSignals ?? [];
  const positionStatus = buildPositionStatusViewModel({
    ...snapshot.positionStatus,
    backtests,
  });
  const positionCurrent = positionStatus.current;
  const activeCautionFlags = positionStatus.flags.caution.filter((flag) => flag.active);
  const latestPositionBacktest = positionStatus.backtest.position;
  const benchmarkBacktest = positionStatus.backtest.benchmark;
  const drawdownDeltaCopy = positionStatus.backtest.deltaDrawdownPct === null
    ? 'ingen drawdown-data'
    : `${formatNumber(Math.abs(positionStatus.backtest.deltaDrawdownPct), { maximumFractionDigits: 2 })} pp ${positionStatus.backtest.deltaDrawdownPct > 0 ? 'lägre drawdown' : positionStatus.backtest.deltaDrawdownPct < 0 ? 'högre drawdown' : 'oförändrad drawdown'}`;
  const cagrDeltaCopy = positionStatus.backtest.deltaCagrPct === null
    ? 'ingen CAGR-data'
    : `${formatNumber(Math.abs(positionStatus.backtest.deltaCagrPct), { maximumFractionDigits: 2 })} pp ${positionStatus.backtest.deltaCagrPct < 0 ? 'lägre CAGR' : positionStatus.backtest.deltaCagrPct > 0 ? 'högre CAGR' : 'oförändrad CAGR'}`;

  return (
    <main className="page-shell">
      <section className={`signal-hero ${toneClass(interpretation.tone)}`}>
        <div>
          <p className="eyebrow">Dagens marknadsläge · {formatDate(latestSignal?.date)}</p>
          <div className="signal-headline">
            <span className="signal-emoji">{interpretation.emoji}</span>
            <div>
              <h1>{interpretation.headlineLabel}</h1>
              <p className="hero-copy">{interpretation.actionBias}</p>
            </div>
          </div>
        </div>
        <div className="thermometer-card">
          <p className="panel-label">Market Regime Score</p>
          <strong>{interpretation.displayScore ?? '—'}<span>/100</span></strong>
          <div className="thermometer-track">
            <div
              className={`thermometer-fill ${toneClass(interpretation.tone)}`}
              style={{ width: `${interpretation.displayScore ?? 0}%` }}
            />
          </div>
          <p className="footnote">Raw model score: {formatNumber(interpretation.rawScore, { maximumFractionDigits: 2 })}</p>
        </div>
      </section>

      <section className="horizon-grid">
        {[
          ['Kort sikt', '1–3 dagar', interpretation.shortTerm],
          ['Swing', '1–4 veckor', interpretation.swingTerm],
          ['Position', '1–6 månader', interpretation.positionTerm],
        ].map(([title, subtitle, item]) => (
          <article className={`horizon-card ${toneClass(item.tone)}`} key={title}>
            <p className="section-kicker">{subtitle}</p>
            <h2>{title}: {item.label}</h2>
            <p className="footnote">{item.detail}</p>
          </article>
        ))}
      </section>

      {positionCurrent ? (
        <section className="dashboard-grid position-grid">
          <article className={`card position-status-card ${toneClass(positionCurrent.tone)}`}>
            <div className="position-card-head">
              <div>
                <p className="section-kicker">Dagens positionsbeslut</p>
                <h2>{formatPercent(positionCurrent.appliedEquityPct, 0)} investerat</h2>
                <p className="hero-copy compact">
                  {positionCurrent.decision}. Status per {formatDate(positionCurrent.date)}.
                </p>
              </div>
              <span className={`mini-pill ${toneClass(positionCurrent.tone)}`}>
                {positionCurrent.signalLabel}
              </span>
            </div>

            <div className="metric-grid position-metric-grid">
              <div className="metric-tile">
                <span>Applicerad aktievikt</span>
                <strong>{formatPercent(positionCurrent.appliedEquityPct, 0)}</strong>
                <p className="footnote compact">{formatPercent(positionCurrent.appliedCashPct, 0)} kassa</p>
              </div>
              <div className="metric-tile">
                <span>Rå modellvikt</span>
                <strong>{formatPercent(positionCurrent.rawEquityPct, 0)}</strong>
                <p className="footnote compact">{positionCurrent.rawDecision}</p>
              </div>
              <div className="metric-tile">
                <span>Mot gårdagen</span>
                <strong>{positionCurrent.dayOverDayChangePct === null ? '—' : formatPoints(positionCurrent.dayOverDayChangePct, 0)}</strong>
                <p className="footnote compact">Applicerad viktändring</p>
              </div>
              <div className="metric-tile">
                <span>Risklager</span>
                <strong>{positionCurrent.hardRiskOffCount} hårda / {positionCurrent.cautionCount} caution</strong>
                <p className="footnote compact">{positionCurrent.reasonSummary ? formatStatus(positionCurrent.reasonSummary) : 'Ingen sammanfattning'}</p>
              </div>
            </div>

            <div className="position-note">
              <p className="section-kicker">Bekräftelselager</p>
              <p className="hero-copy compact">
                {positionCurrent.isPending
                  ? `Råmodellen vill ${formatPercent(positionCurrent.rawEquityPct, 0)} aktievikt, men den applicerade modellen väntar fortfarande. ${positionStatus.persistence.directionLabel}: ${positionStatus.persistence.progressLabel.toLowerCase()}.`
                  : 'Ingen väntande viktändring just nu.'}
              </p>
            </div>

            <div className="position-flag-section">
              <p className="section-kicker">Hårda riskflaggor</p>
              <div className="pill-list">
                {positionStatus.flags.hard.map((flag) => (
                  <span className={`mini-pill ${toneClass(flag.active ? flag.tone : 'neutral')}`} key={flag.key}>
                    {flag.active ? 'Aktiv' : 'Av'} · {flag.label}
                  </span>
                ))}
              </div>
            </div>

            <div className="position-flag-section">
              <p className="section-kicker">Aktiv makrokontext</p>
              <div className="pill-list">
                {activeCautionFlags.length
                  ? activeCautionFlags.map((flag) => (
                    <span className={`mini-pill ${toneClass(flag.tone)}`} key={flag.key}>
                      Aktiv · {flag.label}
                    </span>
                  ))
                  : (
                    <span className={`mini-pill ${toneClass('neutral')}`}>
                      Inga mjuka varningsflaggor just nu
                    </span>
                  )}
              </div>
            </div>
          </article>

          <article className="card position-context-card">
            <p className="section-kicker">Strategikoll</p>
            <div className="metric-grid compact-grid">
              <div className="metric-tile">
                <span>Senaste viktändring</span>
                <strong>
                  {positionStatus.latestChange
                    ? `${formatPercent(positionStatus.latestChange.previousEquityPct, 0)} → ${formatPercent(positionStatus.latestChange.newEquityPct, 0)}`
                    : 'Ingen ännu'}
                </strong>
                <p className="footnote compact">
                  {positionStatus.latestChange
                    ? `${formatDate(positionStatus.latestChange.date)} · ${positionStatus.latestChange.decision}`
                    : 'Ingen applicerad ändring sparad ännu.'}
                </p>
              </div>
              <div className="metric-tile">
                <span>Breadth-input</span>
                <strong>{positionCurrent.marketSignal ? formatStatus(positionCurrent.marketSignal) : 'No data'}</strong>
                <p className="footnote compact">
                  Regime score {positionCurrent.marketRegimeScore === null ? '—' : formatNumber(positionCurrent.marketRegimeScore, { maximumFractionDigits: 1 })}
                </p>
              </div>
            </div>

            <div className="backtest-compare-grid">
              <div className="comparison-tile">
                <p className="section-kicker">Position Macro v1</p>
                <strong>{latestPositionBacktest ? formatPercent(latestPositionBacktest.cagr) : 'No data'}</strong>
                <p className="footnote compact">
                  CAGR · Max DD {latestPositionBacktest ? formatPercent(latestPositionBacktest.max_drawdown) : 'No data'}
                </p>
              </div>
              <div className="comparison-tile">
                <p className="section-kicker">Buy & Hold SPY</p>
                <strong>{benchmarkBacktest ? formatPercent(benchmarkBacktest.cagr) : 'No data'}</strong>
                <p className="footnote compact">
                  CAGR · Max DD {benchmarkBacktest ? formatPercent(benchmarkBacktest.max_drawdown) : 'No data'}
                </p>
              </div>
              <div className="comparison-tile">
                <p className="section-kicker">Skillnad</p>
                <strong>{positionStatus.backtest.deltaDrawdownPct === null ? 'No data' : `${formatNumber(positionStatus.backtest.deltaDrawdownPct, { maximumFractionDigits: 2 })} pp`}</strong>
                <p className="footnote compact">
                  {drawdownDeltaCopy}, men {cagrDeltaCopy}
                </p>
              </div>
            </div>

            <p className="footnote">
              Senaste backtest: {latestPositionBacktest?.finished_at ? formatTimestamp(latestPositionBacktest.finished_at) : 'Ej kört ännu'}.
            </p>
          </article>
        </section>
      ) : null}

      <section className="dashboard-grid signal-grid">
        <article className={`card price-breadth-card ${toneClass(interpretation.priceBreadth.tone)}`}>
          <p className="section-kicker">Price vs Breadth</p>
          <h2>{interpretation.priceBreadth.label}</h2>
          <div className="price-breadth-values">
            <div>
              <span>SPX 14d</span>
              <strong>{interpretation.priceBreadth.spx}</strong>
            </div>
            <div>
              <span>SMA50 breadth 14d</span>
              <strong>{interpretation.priceBreadth.breadth}</strong>
            </div>
          </div>
          <p className="hero-copy compact">{interpretation.priceBreadth.detail}</p>
        </article>

        <article className="card">
          <p className="section-kicker">Varför denna signal?</p>
          <ul className="insight-list">
            {interpretation.explanationBullets.map((bullet) => (
              <li key={bullet}>✅ {bullet}</li>
            ))}
            {interpretation.warningBullets.map((bullet) => (
              <li className="warning-item" key={bullet}>⚠️ {bullet}</li>
            ))}
          </ul>
        </article>
      </section>

      <section className="card">
        <p className="section-kicker">Indikator-heatmap</p>
        <div className="heatmap-grid">
          {interpretation.heatmap.map((item) => (
            <div className={`heatmap-tile ${toneClass(item.tone)}`} key={item.key}>
              <span>{item.label}</span>
              <strong>{item.value}</strong>
            </div>
          ))}
        </div>
      </section>

      <section className="card">
        <p className="section-kicker">Senaste 10 signaler</p>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Datum</th>
                <th>Signal</th>
                <th>Score</th>
                <th>% &gt; SMA50</th>
                <th>SMA50 14d</th>
                <th>Divergens</th>
              </tr>
            </thead>
            <tbody>
              {recentSignals.length
                ? recentSignals.map(renderRecentSignalRow)
                : (
                  <tr>
                    <td colSpan="6">No signal history available yet.</td>
                  </tr>
                )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="dashboard-grid">
        <article className="card">
          <p className="section-kicker">Coverage</p>
          <div className="metric-grid">
            <div className="metric-tile"><span>Active tickers</span><strong>{formatNumber(coverage.active_ticker_count)}</strong></div>
            <div className="metric-tile"><span>Tickers with prices</span><strong>{formatNumber(coverage.priced_ticker_count)}</strong></div>
            <div className="metric-tile"><span>Total price rows</span><strong>{formatNumber(coverage.total_price_rows)}</strong></div>
            <div className="metric-tile"><span>Latest stock date</span><strong>{formatDate(coverage.latest_price_date)}</strong></div>
          </div>
          <p className="footnote">Historical stock coverage spans {formatDate(coverage.earliest_price_date)} to {formatDate(coverage.latest_price_date)}.</p>
        </article>

        <article className="card">
          <p className="section-kicker">Latest fetch run</p>
          <strong className="status-pill" style={{ color: statusTone(latestRun?.status) }}>{formatStatus(latestRun?.status)}</strong>
          <p className="panel-copy">
            {latestRun
              ? `${latestRun.successful_items ?? 0}/${latestRun.total_items ?? 0} items, finished ${formatTimestamp(latestRun.finished_at)}`
              : 'No fetch run has been recorded yet.'}
          </p>
        </article>
      </section>

      <section className="dashboard-grid">
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

        <article className="card">
          <p className="section-kicker">Backtests</p>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Strategy</th><th>CAGR</th><th>Max DD</th><th>Time in market</th><th>Finished</th></tr>
              </thead>
              <tbody>
                {backtests.length ? backtests.map(renderBacktestRow) : <tr><td colSpan="5">No backtest runs available yet.</td></tr>}
              </tbody>
            </table>
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
                {tickerCompany ? `${tickerCompany.company_name} · ${tickerCompany.sector ?? 'Sector unknown'}` : 'Ticker not found in the active constituent list.'}
              </p>
            </div>
            <form className="ticker-form">
              <label htmlFor="ticker">Ticker</label>
              <div className="ticker-form-row">
                <input id="ticker" name="ticker" defaultValue={selectedTicker} placeholder="AAPL" />
                <button type="submit">Load</button>
              </div>
            </form>
          </div>

          <div className="metric-grid compact-grid">
            <div className="metric-tile"><span>Rows stored</span><strong>{formatNumber(tickerStats.row_count)}</strong></div>
            <div className="metric-tile"><span>First date</span><strong>{formatDate(tickerStats.first_date)}</strong></div>
            <div className="metric-tile"><span>Latest date</span><strong>{formatDate(tickerStats.latest_date)}</strong></div>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Date</th><th>Close</th><th>Adj close</th><th>SMA5</th><th>SMA10</th><th>SMA20</th><th>SMA50</th><th>SMA200</th><th>Volume</th></tr>
              </thead>
              <tbody>
                {snapshot.tickerSnapshot.prices.length ? snapshot.tickerSnapshot.prices.map(renderPriceRow) : <tr><td colSpan="9">No prices available for this ticker.</td></tr>}
              </tbody>
            </table>
          </div>
        </article>

        <article className="card roadmap-card">
          <p className="section-kicker">Signal design</p>
          <h2>Thermometer + horizons + heatmap.</h2>
          <ol className="path-list">
            <li>Thermometer shows the combined regime in one readable 0–100 display score.</li>
            <li>Horizons separate day/swing/position context so one signal does not do everything.</li>
            <li>Heatmap explains which indicators support or weaken the headline read.</li>
            <li>Price vs breadth remains the primary divergence lens.</li>
          </ol>
          <p className="footnote">This branch does not change the saved model calculation yet. It only adds a clearer interpretation layer and dashboard layout.</p>
        </article>
      </section>
    </main>
  );
}
