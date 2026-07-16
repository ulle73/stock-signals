'use client';

const DIRECTION_META = Object.freeze({
  improving: { label: 'Stärks', symbol: '↑', tone: 'positive' },
  deteriorating: { label: 'Försvagas', symbol: '↓', tone: 'danger' },
  stable: { label: 'Stabil', symbol: '→', tone: 'neutral' },
  unknown: { label: 'Saknar trend', symbol: '·', tone: 'neutral' },
});

const VOLATILITY_LABELS = Object.freeze({
  compression: 'Kompression',
  normal: 'Normal',
  expansion: 'Expansion',
  extreme: 'Extrem',
});

function number(value, digits = 0) {
  if (!Number.isFinite(Number(value))) return '—';
  return Number(value).toLocaleString('sv-SE', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

function signedCompact(value) {
  if (!Number.isFinite(Number(value))) return '—';
  return new Intl.NumberFormat('sv-SE', { notation: 'compact', maximumFractionDigits: 1, signDisplay: 'always' }).format(Number(value));
}

function dateLabel(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('sv-SE', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${value}T00:00:00Z`));
}

function DirectionLine({ direction, prefix = '' }) {
  const meta = DIRECTION_META[direction] ?? DIRECTION_META.unknown;
  return <strong className={`chart-context-state tone-${meta.tone}`}>{prefix}{meta.label} <span aria-hidden="true">{meta.symbol}</span></strong>;
}

function ContextCard({ label, state, value, title }) {
  return (
    <article className="chart-context-card" title={title}>
      <span className="chart-context-label">{label}</span>
      {state}
      <span className="chart-context-value">{value}</span>
    </article>
  );
}

function optionsState(snapshot) {
  if (!snapshot) return { label: 'Ingen GEX/DEX-data', tone: 'neutral' };
  if (snapshot.stale || snapshot.sourceStatus !== 'active') return { label: 'Stale data', tone: 'warning' };
  if (Number(snapshot.netGex) > 0) return { label: 'Positiv gamma', tone: 'positive' };
  if (Number(snapshot.netGex) < 0) return { label: 'Negativ gamma', tone: 'danger' };
  return { label: snapshot.marketRegime || 'Neutral', tone: 'neutral' };
}

export default function ChartContextStrip({
  breadthContext,
  gexDexSnapshots = [],
  nextEarnings,
  relativeStrengthContext,
  volatilityContext,
}) {
  const rs = relativeStrengthContext;
  const breadth = breadthContext;
  const volatility = volatilityContext;
  const options = gexDexSnapshots.at(-1) ?? null;
  const optionState = optionsState(options);

  const rsTitle = rs
    ? `21d ${number(rs.percentile21d)} percentil · 63d ${number(rs.percentile63d)} · 126d ${number(rs.percentile126d)} · Data ${rs.asOf}`
    : 'Relativ styrka mot SPY saknas.';
  const breadthTitle = breadth
    ? `Sektor SMA20 ${number(breadth.sector?.sma20)}% · SMA50 ${number(breadth.sector?.sma50)}% · SMA200 ${number(breadth.sector?.sma200)}% · Nya 52v-högsta ${number(breadth.sector?.newHighs52w)} · Nya 52v-lägsta ${number(breadth.sector?.newLows52w)}`
    : 'Sektor- och marknadsbredd saknas.';
  const volatilityTitle = volatility
    ? `ATR14 ${number(volatility.atr14, 2)} · ATR ${number(volatility.atrPct, 2)}% av pris · Realiserad volatilitet 20d ${number(volatility.realizedVolatility20d, 1)}%`
    : 'Tillräcklig OHLC-historik för volatilitetsregim saknas.';
  const optionsTitle = options
    ? `Snapshot ${options.sourceTimestamp} · Net GEX ${signedCompact(options.netGex)} · Net DEX ${signedCompact(options.netDex)} · ${options.dealerPositioning ?? 'Okänd dealerpositionering'}`
    : 'Ingen providersnapshot för vald ticker.';

  return (
    <section className="chart-context-strip" aria-label="Beslutskontext">
      <div className="chart-context-cards">
        <ContextCard
          label="Relativ styrka"
          state={<DirectionLine direction={rs?.direction ?? 'unknown'} />}
          value={`63d-percentil ${number(rs?.percentile63d)}`}
          title={rsTitle}
        />
        <ContextCard
          label="Bredd"
          state={<DirectionLine direction={breadth?.direction ?? 'unknown'} prefix="Sektorn " />}
          value={`SMA50 ${number(breadth?.sector?.sma50)}% · Marknad ${number(breadth?.market?.sma50)}%`}
          title={breadthTitle}
        />
        <ContextCard
          label="Volatilitet"
          state={<strong className={`chart-context-state tone-${volatility?.regime === 'extreme' ? 'danger' : volatility?.regime === 'expansion' ? 'warning' : volatility?.regime === 'compression' ? 'positive' : 'neutral'}`}>{VOLATILITY_LABELS[volatility?.regime] ?? 'Saknar data'} <span aria-hidden="true">{DIRECTION_META[volatility?.direction]?.symbol ?? '·'}</span></strong>}
          value={`ATR-percentil ${number(volatility?.percentile)}`}
          title={volatilityTitle}
        />
        <ContextCard
          label="Optionsläge"
          state={<strong className={`chart-context-state tone-${optionState.tone}`}>{optionState.label}</strong>}
          value={`Net GEX ${signedCompact(options?.netGex)} · Net DEX ${signedCompact(options?.netDex)}`}
          title={optionsTitle}
        />
      </div>
      <div className="chart-next-event" title={nextEarnings ? `${nextEarnings.confirmed ? 'Bekräftat' : 'Preliminärt'} rapportdatum` : 'Nästa rapportdatum saknas'}>
        <span>Nästa rapport</span>
        <strong>{nextEarnings ? `${dateLabel(nextEarnings.date)} · ${nextEarnings.daysUntil} dagar` : '—'}</strong>
      </div>
    </section>
  );
}
