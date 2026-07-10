function formatNumber(value, digits = 2) {
  if (value === null || value === undefined) return '—';
  const number = Number(value);
  if (!Number.isFinite(number)) return '—';

  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(number);
}

function formatCompactExposure(value) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return '—';
  const number = Number(value);
  const absolute = Math.abs(number);
  const sign = number > 0 ? '+' : number < 0 ? '−' : '';

  if (absolute >= 1_000_000_000) return `${sign}${(absolute / 1_000_000_000).toFixed(2)}bn`;
  if (absolute >= 1_000_000) return `${sign}${(absolute / 1_000_000).toFixed(1)}m`;
  if (absolute >= 1_000) return `${sign}${(absolute / 1_000).toFixed(1)}k`;
  return `${sign}${absolute.toFixed(0)}`;
}

function formatTimestamp(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('sv-SE', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'America/New_York',
  }).format(new Date(value));
}

function SignalPill({ signal }) {
  return <span className={`gex-dex-signal-pill tone-${signal.tone}`}>{signal.label}</span>;
}

function LevelLadder({ levels }) {
  return (
    <div className="gex-dex-level-ladder" aria-label="Viktigaste GEX-nivåerna">
      {levels.map((level) => (
        <div className={`gex-dex-level-row is-${level.tone}`} key={level.key}>
          <span>{level.label}</span>
          <strong>{formatNumber(level.value)}</strong>
        </div>
      ))}
    </div>
  );
}

function ExposureChart({ title, strikes, valueKey, barKey, toneKey }) {
  return (
    <div className="gex-dex-chart" aria-label={`${title} per strike`}>
      <div className="gex-dex-chart-header"><span>{title}</span><small>per strike</small></div>
      <div className="gex-dex-chart-rows">
        {strikes.map((strike) => (
          <div className="gex-dex-chart-row" key={`${title}-${strike.strike}`}>
            <span className={strike.isNearestSpotStrike ? 'is-spot-strike' : undefined}>{formatNumber(strike.strike, 0)}</span>
            <div className="gex-dex-bar-track">
              <i
                className={`tone-${strike[toneKey]}`}
                style={{ width: `${strike[barKey]}%` }}
              />
            </div>
            <strong className={`tone-${strike[toneKey]}`}>{formatCompactExposure(strike[valueKey])}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

function PositioningCard({ card }) {
  return (
    <article className={`gex-dex-card tone-${card.signal.tone}`}>
      <header className="gex-dex-card-header">
        <div>
          <p className="section-kicker">{card.ticker} · Options positioning</p>
          <div className="gex-dex-card-title-row">
            <h3>{formatNumber(card.spotPrice)}</h3>
            <span className={card.spotChangePct === null || card.spotChangePct === undefined ? 'tone-neutral' : card.spotChangePct >= 0 ? 'tone-positive' : 'tone-danger'}>
              {card.spotChangePct === null || card.spotChangePct === undefined ? '—' : `${card.spotChangePct >= 0 ? '+' : ''}${formatNumber(card.spotChangePct)}%`}
            </span>
          </div>
        </div>
        <div className="gex-dex-card-status">
          <SignalPill signal={card.signal} />
          <span className={`gex-dex-freshness tone-${card.freshness.tone}`}>{card.freshness.label}</span>
        </div>
      </header>

      <p className="gex-dex-signal-copy">{card.signal.detail}</p>

      <div className="gex-dex-map-grid">
        <LevelLadder levels={card.levels} />
        <dl className="gex-dex-facts">
          <div><dt>Gamma-regim</dt><dd>{card.gammaRegime}</dd></div>
          <div><dt>Net GEX</dt><dd>{formatCompactExposure(card.netGex)}</dd></div>
          <div><dt>Net DEX</dt><dd>{formatCompactExposure(card.netDex)}</dd></div>
          <div><dt>Flip-avstånd</dt><dd>{card.spotToGammaFlipAtr === null ? '—' : `${formatNumber(card.spotToGammaFlipAtr)} ATR`}</dd></div>
        </dl>
      </div>

      <div className="gex-dex-context-row">
        <span className={card.insideWalls ? 'is-active' : undefined}>Mellan walls</span>
        <span className={card.nearGammaFlip ? 'is-active' : undefined}>Nära gamma flip</span>
        <span className={card.gexDexConfluence ? 'is-active' : undefined}>GEX/DEX-confluence</span>
      </div>

      {card.strikes.length ? (
        <div className="gex-dex-charts">
          <ExposureChart title="GEX" strikes={card.strikes} valueKey="netGex" barKey="gexBarPct" toneKey="gexTone" />
          <ExposureChart title="DEX" strikes={card.strikes} valueKey="netDex" barKey="dexBarPct" toneKey="dexTone" />
        </div>
      ) : <p className="gex-dex-empty-chart">Inga strike-rader finns i den senaste snapshoten.</p>}

      <footer className="gex-dex-card-footnote">
        <span>{formatTimestamp(card.sourceTimestamp)} New York · {card.multiExpiry ? 'flera utgångar' : 'en utgång'}</span>
        <a href={card.sourceUrl} target="_blank" rel="noreferrer">GammaLens · {card.dataQuality}</a>
      </footer>
    </article>
  );
}

export function GexDexSectionView({ viewModel }) {
  if (!viewModel.cards.length) {
    return (
      <article className="card gex-dex-empty-state">
        <p className="section-kicker">Options positioning · Beta</p>
        <h2>GEX/DEX-snapshots saknas ännu</h2>
        <p>Kör den isolerade GammaLens-hämtningen för att visa SPY- och QQQ-kartor här.</p>
      </article>
    );
  }

  return (
    <div className="gex-dex-card-grid">
      {viewModel.cards.map((card) => <PositioningCard card={card} key={`${card.ticker}-${card.sourceTimestamp}`} />)}
    </div>
  );
}
