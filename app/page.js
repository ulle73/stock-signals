import { Suspense } from 'react';
import { getDashboardSnapshot } from '../lib/repositories/dashboard.js';
import { getActiveConstituents } from '../lib/repositories/constituents.js';
import { interpretMarketSignal } from '../lib/utils/signal-interpretation.js';
import { getVolumeEventLabel } from '../lib/utils/volume-events.js';
import MarketBreadthMa200ForwardReturnComparisonSection from './market-breadth-ma200-forward-return-comparison-section.js';
import StockSignalBoardClientSection from './stock-signal-board-client-section.js';
import {
  buildMarketSeriesCards,
  buildPositionStatusViewModel,
  resolveSelectedTicker,
} from '../lib/utils/dashboard-view.js';

export const dynamic = 'force-dynamic';

function formatNumber(value, options = {}) {
  if (value === null || value === undefined) return 'No data';
  return new Intl.NumberFormat('en-US', options).format(Number(value));
}

function formatDate(value) {
  if (!value) return 'No data';
  return new Intl.DateTimeFormat('sv-SE', {
    dateStyle: 'medium',
    timeZone: 'UTC',
  }).format(new Date(`${value}T00:00:00Z`));
}

function formatTimestamp(value) {
  if (!value) return 'Still running';
  return new Intl.DateTimeFormat('sv-SE', {
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
      ? 'var(--caution)'
      : 'var(--danger)';
}

function toneClass(tone) {
  return `tone-${tone || 'neutral'}`;
}

function numericToneClass(value) {
  if (value === null || value === undefined) return 'tone-neutral';
  const number = Number(value);
  if (!Number.isFinite(number) || number === 0) return 'tone-neutral';
  return number > 0 ? 'tone-positive' : 'tone-danger';
}

function renderBacktestRow(row) {
  return (
    <tr key={row.code}>
      <td>{row.name}</td>
      <td className={numericToneClass(row.cagr)}>{formatPercent(row.cagr)}</td>
      <td className={numericToneClass(row.max_drawdown)}>{formatPercent(row.max_drawdown)}</td>
      <td>{formatPercent(row.time_in_market_pct)}</td>
      <td>{formatTimestamp(row.finished_at)}</td>
    </tr>
  );
}

function movingAverageCellStyle(adjClose, movingAverage) {
  if (adjClose === null || adjClose === undefined || movingAverage === null || movingAverage === undefined) {
    return undefined;
  }

  const adjCloseNumber = Number(adjClose);
  const movingAverageNumber = Number(movingAverage);

  if (!Number.isFinite(adjCloseNumber) || !Number.isFinite(movingAverageNumber) || adjCloseNumber === movingAverageNumber) {
    return undefined;
  }

  return adjCloseNumber > movingAverageNumber
    ? { background: 'var(--positive-bg)', color: 'var(--accent)', fontWeight: 700 }
    : { background: 'var(--danger-bg)', color: 'var(--danger)', fontWeight: 700 };
}

function volumeCellStyle(tone) {
  if (!tone || tone === 'neutral') return undefined;

  const styleByTone = {
    positive: { background: 'var(--positive-bg)', color: 'var(--accent)', fontWeight: 700 },
    caution: { background: 'var(--caution-bg)', color: 'var(--caution)', fontWeight: 700 },
    warning: { background: 'var(--warning-bg)', color: 'var(--warning)', fontWeight: 700 },
    danger: { background: 'var(--danger-bg)', color: 'var(--danger)', fontWeight: 700 },
  };

  return styleByTone[tone] ?? undefined;
}

function renderMovingAverageCell(row, key) {
  return (
    <td style={movingAverageCellStyle(row.adj_close, row[key])}>
      {formatNumber(row[key], { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
    </td>
  );
}

function renderVolumeCell(row) {
  const relativeVolume = row.relative_volume20 === null || row.relative_volume20 === undefined
    ? null
    : Number(row.relative_volume20);
  const eventLabel = getVolumeEventLabel(row.volume_event);

  return (
    <td style={volumeCellStyle(row.volume_event_tone)}>
      <div>{formatNumber(row.volume)}</div>
      {Number.isFinite(relativeVolume) ? (
        <div style={{ fontSize: '0.78rem', marginTop: 4, opacity: 0.82 }}>
          {formatNumber(relativeVolume, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}x · {eventLabel}
        </div>
      ) : null}
    </td>
  );
}

function renderPriceRow(row) {
  return (
    <tr key={row.date}>
      <td>{formatDate(row.date)}</td>
      <td>{formatNumber(row.close, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
      <td>{formatNumber(row.adj_close, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
      {renderMovingAverageCell(row, 'sma5')}
      {renderMovingAverageCell(row, 'sma10')}
      {renderMovingAverageCell(row, 'sma20')}
      {renderMovingAverageCell(row, 'sma50')}
      {renderMovingAverageCell(row, 'sma200')}
      {renderVolumeCell(row)}
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

function SectionIntro({ eyebrow, title, copy, right }) {
  return (
    <div className="category-heading">
      <div>
        <p className="category-eyebrow">{eyebrow}</p>
        <h2>{title}</h2>
      </div>
      {copy ? <p className="category-helper">{copy}</p> : null}
      {right ?? null}
    </div>
  );
}

function KpiCard({ label, value, copy, tone = 'neutral' }) {
  return (
    <div className={`kpi-card ${toneClass(tone)}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      {copy ? <small>{copy}</small> : null}
    </div>
  );
}

function ReasonTile({ item }) {
  return (
    <div className={`reason-tile ${toneClass(item.tone)}`}>
      <span>{item.label}</span>
      <strong>{item.value}</strong>
      <small>{item.detail ?? '—'}</small>
      <div className="reason-spark" aria-hidden="true" />
    </div>
  );
}

function SectionLoadingCard({ title, copy }) {
  return (
    <section className="card">
      <p className="section-kicker">Laddar sektion</p>
      <h2>{title}</h2>
      <p className="hero-copy compact">{copy}</p>
    </section>
  );
}

export default async function Home({ searchParams }) {
  const resolvedSearchParams = await searchParams;
  const activeConstituents = await getActiveConstituents();
  const selectedTicker = resolveSelectedTicker(resolvedSearchParams?.ticker, activeConstituents);
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
  const displayScore = Number(interpretation.displayScore ?? 0);
  const scorePct = Number.isFinite(displayScore) ? Math.max(0, Math.min(100, displayScore)) : 0;
  const appliedEquityPct = positionCurrent?.appliedEquityPct ?? null;
  const exposurePct = appliedEquityPct === null ? 0 : Math.max(0, Math.min(100, Number(appliedEquityPct)));
  const drawdownDeltaCopy = positionStatus.backtest.deltaDrawdownPct === null
    ? 'ingen drawdown-data'
    : `${formatNumber(Math.abs(positionStatus.backtest.deltaDrawdownPct), { maximumFractionDigits: 2 })} pp ${positionStatus.backtest.deltaDrawdownPct > 0 ? 'lägre drawdown' : positionStatus.backtest.deltaDrawdownPct < 0 ? 'högre drawdown' : 'oförändrad drawdown'}`;
  const cagrDeltaCopy = positionStatus.backtest.deltaCagrPct === null
    ? 'ingen CAGR-data'
    : `${formatNumber(Math.abs(positionStatus.backtest.deltaCagrPct), { maximumFractionDigits: 2 })} pp ${positionStatus.backtest.deltaCagrPct < 0 ? 'lägre CAGR' : positionStatus.backtest.deltaCagrPct > 0 ? 'högre CAGR' : 'oförändrad CAGR'}`;

  return (
    <main className="page-shell restyle-page">
      <section className="category-section" id="oversikt">
        <SectionIntro
          eyebrow="Översikt"
          title="Börsläge just nu"
          copy="Första skärmen ska svara på två saker: är börsen riskvänlig eller farlig, och hur mycket exponering ska modellen ha?"
        />

        <div className={`market-hero ${toneClass(interpretation.tone)}`}>
          <div className="market-hero-main">
            <div className="regime-orb" aria-hidden="true" />
            <div>
              <p className="eyebrow">Dagens marknadsläge · {formatDate(latestSignal?.date)}</p>
              <h1>{interpretation.headlineLabel}</h1>
              <p className="hero-subline">{interpretation.actionBias}</p>
            </div>
          </div>

          <div className="hero-number-row">
            <div className="hero-number-card">
              <p className="panel-label">Marknadslägescore</p>
              <strong>{interpretation.displayScore ?? '—'}<span>/100</span></strong>
              <p className="footnote compact">Raw score {formatNumber(interpretation.rawScore, { maximumFractionDigits: 2 })}</p>
            </div>
            <div className="hero-number-card">
              <p className="panel-label">Rekommenderad exponering</p>
              <strong>{positionCurrent ? formatPercent(positionCurrent.appliedEquityPct, 0) : '—'}</strong>
              <p className="footnote compact">{positionCurrent ? positionCurrent.signalLabel : 'Ingen positionsrad'}</p>
            </div>
          </div>

          <div className="risk-scale-card">
            <p className="panel-label">Risktermometer</p>
            <div className="risk-scale-track" aria-label={`Score ${scorePct} av 100`}>
              <span className="risk-scale-thumb" style={{ left: `${scorePct}%` }} />
            </div>
            <div className="risk-scale-points"><span>0</span><span>25</span><span>50</span><span>75</span><span>100</span></div>
            <div className="risk-scale-labels"><span>Risk-Off</span><span>Neutral</span><span>Risk-On</span></div>
          </div>
        </div>

        <section className="horizon-grid restyle-horizons">
          {[
            ['↗', 'Kort sikt', '1–3 dagar', interpretation.shortTerm],
            ['⌁', 'Swing', '1–4 veckor', interpretation.swingTerm],
            ['◎', 'Position', '1–6 månader', interpretation.positionTerm],
          ].map(([icon, title, subtitle, item]) => (
            <article className={`horizon-card ${toneClass(item.tone)}`} key={title}>
              <span className="horizon-icon" aria-hidden="true">{icon}</span>
              <div>
                <p className="section-kicker">{subtitle}</p>
                <h2>{title}: {item.label}</h2>
                <p className="footnote compact">{item.detail}</p>
              </div>
              <span aria-hidden="true">›</span>
            </article>
          ))}
        </section>

        <section className="category-section">
          <SectionIntro
            eyebrow="Modellens bevis"
            title="Varför modellen lutar så här"
            copy="Rådata är kvar, men visas som snabba beslutskort så man ser drivarna utan att läsa hela databasen."
          />
          <div className="metric-strip">
            {interpretation.heatmap.map((item) => <ReasonTile item={item} key={item.key} />)}
          </div>
        </section>

        {positionCurrent ? (
          <section className="decision-grid">
            <article className={`card decision-card ${toneClass(positionCurrent.tone)}`}>
              <div
                className="exposure-ring"
                style={{ background: `conic-gradient(var(--accent) 0 ${exposurePct}%, rgba(255, 255, 255, 0.08) ${exposurePct}% 100%)` }}
                aria-label={`${formatPercent(positionCurrent.appliedEquityPct, 0)} investerat`}
              >
                <div>
                  <strong>{formatPercent(positionCurrent.appliedEquityPct, 0)}</strong>
                  <span>investerat</span>
                </div>
              </div>
              <div>
                <p className="section-kicker">Så bör du ligga nu</p>
                <div className="decision-facts">
                  <div className="decision-fact"><span>Riskmodell</span><strong>{formatPercent(positionCurrent.rawEquityPct, 0)}</strong></div>
                  <div className="decision-fact"><span>Marknadsregim</span><strong>{formatStatus(positionCurrent.marketSignal)}</strong></div>
                  <div className="decision-fact"><span>Risknivå</span><strong>{positionCurrent.hardRiskOffCount} hårda / {positionCurrent.cautionCount} caution</strong></div>
                </div>
                <p className="decision-note"><span>Exekveringsnotis</span>{positionCurrent.decision}. {positionCurrent.isPending ? positionStatus.persistence.progressLabel : 'Ingen väntande viktändring just nu.'}</p>
                <div className="pill-list">
                  {positionStatus.flags.hard.map((flag) => (
                    <span className={`mini-pill ${toneClass(flag.active ? flag.tone : 'neutral')}`} key={flag.key}>
                      {flag.active ? 'Aktiv' : 'Av'} · {flag.label}
                    </span>
                  ))}
                  {activeCautionFlags.length
                    ? activeCautionFlags.map((flag) => (
                      <span className={`mini-pill ${toneClass(flag.tone)}`} key={flag.key}>Aktiv · {flag.label}</span>
                    ))
                    : <span className={`mini-pill ${toneClass('neutral')}`}>Inga mjuka varningsflaggor just nu</span>}
                </div>
              </div>
            </article>

            <article className="card">
              <p className="section-kicker">Viktigaste signalerna idag</p>
              <ul className="signal-list">
                {interpretation.explanationBullets.map((bullet) => (
                  <li key={bullet}><span className="signal-dot">✓</span><span>{bullet}</span></li>
                ))}
                {interpretation.warningBullets.map((bullet) => (
                  <li key={bullet}><span className="signal-dot">!</span><span>{bullet}</span></li>
                ))}
              </ul>
            </article>
          </section>
        ) : null}
      </section>

      <section className="category-section" id="ma200">
        <SectionIntro
          eyebrow="Exekvering"
          title="Aktiv MA200-bucket"
          copy="Här ligger den taktiska exekveringen. Översikten visar bara beslutet; detaljerna ligger samlade under rätt kategori."
        />
        <Suspense
          fallback={(
            <SectionLoadingCard
              title="MA200-bucket"
              copy="Läser in jämförelsen mellan statisk och empirisk MA200-data."
            />
          )}
        >
          <MarketBreadthMa200ForwardReturnComparisonSection />
        </Suspense>
      </section>

      <section className="category-section" id="signaler">
        <SectionIntro
          eyebrow="Signaler"
          title="Regimhistorik och signaltolkning"
          copy="Det här är förklaringslagret: historiken, pris/bredd-läget och varför dagens regim får sin etikett."
        />
        <div className="category-grid-two">
          <article className="card">
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
          </article>

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
        </div>
      </section>

      <section className="category-section" id="data">
        <SectionIntro
          eyebrow="Datatäckning"
          title="Är datan komplett nog att lita på?"
          copy="Det här ska inte ligga bland marknadssignalerna. Det är en hälsokontroll av underlaget."
        />
        <div className="category-grid-wide">
          <article className="card">
            <div className="kpi-row">
              <KpiCard label="Aktiva tickers" value={formatNumber(coverage.active_ticker_count)} copy="I universet" tone="positive" />
              <KpiCard label="Tickers med priser" value={formatNumber(coverage.priced_ticker_count)} copy="Prisdata finns" tone="positive" />
              <KpiCard label="Totalt antal price rows" value={formatNumber(coverage.total_price_rows)} copy="Historiska rader" />
              <KpiCard label="Senaste prisdatum" value={formatDate(coverage.latest_price_date)} copy={`Från ${formatDate(coverage.earliest_price_date)}`} tone="positive" />
            </div>
          </article>

          <article className="card">
            <p className="section-kicker">Senaste fetch run</p>
            <strong className="status-pill" style={{ color: statusTone(latestRun?.status) }}>{formatStatus(latestRun?.status)}</strong>
            <p className="panel-copy compact">
              {latestRun
                ? `${latestRun.successful_items ?? 0}/${latestRun.total_items ?? 0} items, färdig ${formatTimestamp(latestRun.finished_at)}`
                : 'No fetch run has been recorded yet.'}
            </p>
          </article>
        </div>
      </section>

      <section className="category-section" id="makro">
        <SectionIntro
          eyebrow="Makro"
          title="Makro just nu"
          copy="Makroinputen är samlad här så den inte blandas ihop med rena pris- och breadth-signaler."
        />
        <article className="card">
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

      <section className="category-section" id="backtester">
        <SectionIntro
          eyebrow="Backtester"
          title="Strategier och förväntansbild"
          copy="Backtester hör hemma som kontext, inte som primär signal. Här kan man jämföra CAGR, drawdown och tid i marknaden."
        />
        <div className="category-grid-wide">
          <article className="card">
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Strategi</th><th>CAGR</th><th>Max DD</th><th>Time in market</th><th>Färdig</th></tr>
                </thead>
                <tbody>
                  {backtests.length ? backtests.map(renderBacktestRow) : <tr><td colSpan="5">No backtest runs available yet.</td></tr>}
                </tbody>
              </table>
            </div>
          </article>

          <article className="card">
            <p className="section-kicker">Strategikoll</p>
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
                <p className="footnote compact">{drawdownDeltaCopy}, men {cagrDeltaCopy}</p>
              </div>
            </div>
            <p className="footnote compact">
              Senaste backtest: {latestPositionBacktest?.finished_at ? formatTimestamp(latestPositionBacktest.finished_at) : 'Ej kört ännu'}.
            </p>
          </article>
        </div>
      </section>

      <section className="category-section" id="ticker">
        <SectionIntro
          eyebrow="Ticker"
          title="Tickerdetalj och heatmap"
          copy="Enskild aktie har sin egen vy. Här ligger glidande medelvärden, volym och tickerns signaldesign."
        />
        <section className="detail-grid">
          <article className="card ticker-panel">
            <div className="ticker-header">
              <div>
                <p className="section-kicker">Ticker drilldown</p>
                <h2>{selectedTicker}</h2>
                <p className="hero-copy compact">
                  {tickerCompany ? `${tickerCompany.company_name} · ${tickerCompany.sector ?? 'Sector unknown'}` : 'Company metadata unavailable'}
                </p>
              </div>
              <form className="ticker-form">
                <label htmlFor="ticker">Ticker</label>
                <div className="ticker-form-row">
                  <select id="ticker" name="ticker" defaultValue={selectedTicker}>
                    {activeConstituents.map((item) => (
                      <option key={item.ticker} value={item.ticker}>
                        {item.ticker} · {item.company_name}
                      </option>
                    ))}
                  </select>
                  <button type="submit">Ladda</button>
                </div>
              </form>
            </div>

            <div className="metric-grid compact-grid">
              <div className="metric-tile"><span>Rader hämtade</span><strong>{formatNumber(tickerStats.row_count)}</strong></div>
              <div className="metric-tile"><span>Första datum</span><strong>{formatDate(tickerStats.first_date)}</strong></div>
              <div className="metric-tile"><span>Senaste datum</span><strong>{formatDate(tickerStats.latest_date)}</strong></div>
            </div>

            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Datum</th><th>Close</th><th>Adj close</th><th>SMA5</th><th>SMA10</th><th>SMA20</th><th>SMA50</th><th>SMA200</th><th>Volym</th></tr>
                </thead>
                <tbody>
                  {snapshot.tickerSnapshot.prices.length ? snapshot.tickerSnapshot.prices.map(renderPriceRow) : <tr><td colSpan="9">No prices available for this ticker.</td></tr>}
                </tbody>
              </table>
            </div>
          </article>

          <article className="card roadmap-card">
            <p className="section-kicker">Signaldesign</p>
            <h2>Thermometer + horizons + heatmap.</h2>
            <ol className="path-list">
              <li>Thermometer visar dagens kombinerade regim på en läsbar 0–100-skala.</li>
              <li>Horizons separerar dag/swing/position så en signal inte behöver göra allt.</li>
              <li>Heatmap förklarar vilka indikatorer som stärker eller försvagar huvudläget.</li>
              <li>Price vs breadth är kvar som primär divergenskontroll.</li>
            </ol>
            <p className="footnote">Den här branchen ändrar inte modellberäkningen. Den flyttar informationen till rätt kategori och lägger grunden för resten av restylingen.</p>
          </article>
        </section>
      </section>

      <section className="category-section" id="alla-aktier">
        <SectionIntro
          eyebrow="Alla aktier"
          title="Aktiva signaler först"
          copy="Fulla aktiescannern ligger sist och får egen kategori, så översikten inte drunknar i alla tickers."
        />
        <StockSignalBoardClientSection />
      </section>
    </main>
  );
}
