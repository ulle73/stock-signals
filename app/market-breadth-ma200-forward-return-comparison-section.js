import { getLatestMarketBreadthForwardReturnComparisonSnapshot } from '../lib/repositories/market-breadth-ma200-forward-return-comparison.js';
import { buildMarketBreadthForwardReturnComparisonViewModel } from '../lib/utils/market-breadth-ma200-forward-return-compare-view.js';

function n(value, digits = 2) {
  if (value === null || value === undefined) return '—';
  const number = Number(value);
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(number);
}

function pct(value, digits = 2) {
  return value === null || value === undefined ? '—' : `${n(value, digits)}%`;
}

function signedPct(value, digits = 2) {
  if (value === null || value === undefined) return '—';
  const number = Number(value);
  const sign = number > 0 ? '+' : '';
  return `${sign}${n(number, digits)}%`;
}

function signedPoints(value, digits = 2) {
  if (value === null || value === undefined) return '—';
  const number = Number(value);
  const sign = number > 0 ? '+' : '';
  return `${sign}${n(number, digits)} pp`;
}

function formatDate(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('sv-SE', {
    dateStyle: 'medium',
    timeZone: 'UTC',
  }).format(new Date(`${value}T00:00:00Z`));
}

function toneClass(tone) {
  return `tone-${tone || 'neutral'}`;
}

function status(value) {
  return value ? value.replaceAll('_', ' ') : 'No data';
}

function summaryLabel(summary) {
  if (summary.strongerHorizons > summary.weakerHorizons) {
    return 'Empirin starkare';
  }

  if (summary.weakerHorizons > summary.strongerHorizons) {
    return 'Empirin svagare';
  }

  return 'Blandad jämförelse';
}

export default async function MarketBreadthMa200ForwardReturnComparisonSection() {
  const snapshot = await getLatestMarketBreadthForwardReturnComparisonSnapshot();
  const viewModel = snapshot
    ? buildMarketBreadthForwardReturnComparisonViewModel(snapshot)
    : null;

  if (!viewModel) {
    return null;
  }

  return (
    <section className="card ma200-compare-card">
      <div className="ma200-compare-topline">
        <div>
          <p className="section-kicker">Breadth · Static vs Empirical</p>
          <h2>Aktiv MA200-bucket: {viewModel.bucketLabel}</h2>
          <p className="hero-copy compact">
            {pct(viewModel.breadthPct)} av universet ligger över 200-dagars just nu. Här jämförs
            {' '}`reference_static_v1` från referensbilden mot `empirical_spy_v2` byggd från sparad
            {' '}{viewModel.benchmarkSymbol}-historik.
          </p>
        </div>

        <div className="ma200-compare-status">
          <span className={`mini-pill ${toneClass(viewModel.summary.overallTone)}`}>
            {summaryLabel(viewModel.summary)}
          </span>
          <strong>{viewModel.summary.strongerHorizons}/{viewModel.horizons.length}</strong>
          <span>horisonter där empirin är starkare · {formatDate(viewModel.date)}</span>
        </div>
      </div>

      <div className="ma200-compare-metric-strip">
        <div className="metric-tile">
          <span>Statisk signal</span>
          <strong>{status(viewModel.staticAction)}</strong>
          <p className="footnote compact">
            {status(viewModel.staticSignal)} · {status(viewModel.staticConfidence)}
          </p>
        </div>
        <div className="metric-tile">
          <span>Tecken-enighet</span>
          <strong>{viewModel.summary.agreementCount}/{viewModel.horizons.length}</strong>
          <p className="footnote compact">horisonter där båda modellerna pekar åt samma håll</p>
        </div>
        <div className="metric-tile">
          <span>Min empirical sample</span>
          <strong>{n(viewModel.summary.minimumSampleCount, 0)}</strong>
          <p className="footnote compact">{viewModel.benchmarkSymbol}-observationer i glesaste horisonten</p>
        </div>
        <div className="metric-tile">
          <span>Största delta</span>
          <strong>{signedPoints(viewModel.summary.largestExpectedReturnDelta?.delta)}</strong>
          <p className="footnote compact">
            {viewModel.summary.largestExpectedReturnDelta?.horizonLabel ?? '—'} ·
            {' '}{n(viewModel.summary.largestExpectedReturnDelta?.sampleCount, 0)} samples
          </p>
        </div>
      </div>

      <div className="ma200-compare-grid">
        {viewModel.horizons.map((horizon) => (
          <article className={`ma200-compare-tile ${toneClass(horizon.expectedReturnTone)}`} key={horizon.key}>
            <div className="ma200-compare-tile-head">
              <p className="section-kicker">{horizon.label}</p>
              <span className={`mini-pill ${toneClass(horizon.expectedReturnTone)}`}>
                {signedPoints(horizon.expectedReturnDelta)}
              </span>
            </div>

            <div className="ma200-compare-values">
              <div>
                <span>Static return</span>
                <strong>{signedPct(horizon.staticExpectedReturn)}</strong>
              </div>
              <div>
                <span>Empirical return</span>
                <strong>{signedPct(horizon.empiricalExpectedReturn)}</strong>
              </div>
            </div>

            <div className="ma200-compare-meta">
              <div>
                <span>Static win</span>
                <strong>{pct(horizon.staticWinRatio)}</strong>
              </div>
              <div>
                <span>Empirical win</span>
                <strong>{pct(horizon.empiricalWinRatio)}</strong>
              </div>
            </div>

            <p className="footnote compact">
              Win delta {signedPoints(horizon.winRatioDelta)} · {n(horizon.sampleCount, 0)} samples
            </p>
          </article>
        ))}
      </div>

      <p className="footnote ma200-compare-footnote">
        `reference_static_v1` är en fast referenstabell från källbilden. `empirical_spy_v2` räknas
        om från lagrad breadth + {viewModel.benchmarkSymbol}-historik och använder bara datapunkter som
        var kända på respektive datum.
      </p>
    </section>
  );
}
