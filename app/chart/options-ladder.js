'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  buildOptionsPositioningLevelHistory,
  buildOptionsPositioningModel,
} from '../../lib/chart/options-positioning.js';

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

function formatSigned(value, digits = 2) {
  if (!Number.isFinite(Number(value))) return '—';
  return new Intl.NumberFormat('sv-SE', {
    signDisplay: 'always',
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(Number(value));
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

function formatTimestamp(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('sv-SE', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'America/New_York',
  }).format(new Date(value));
}

function KeyLevelBadge({ annotation, history = [], scope }) {
  const tooltipId = `options-positioning-${scope}-${annotation.key}-${String(annotation.value).replace('.', '-')}`;
  const badge = (
    <span
      className="options-positioning-level-badge"
      style={{ '--level-color': annotation.color }}
      title={`${annotation.label}: ${formatNumber(annotation.value)}`}
    >
      {annotation.label}
      {!annotation.exact ? <small>{formatNumber(annotation.value)}</small> : null}
    </span>
  );

  if (!history.length) return badge;

  return (
    <span className="options-positioning-tooltip-wrap">
      <button
        type="button"
        className="options-positioning-tooltip-trigger"
        aria-describedby={tooltipId}
        aria-label={`${annotation.label}: visa de senaste ${history.length} nivåerna`}
      >
        {badge}
      </button>
      <span id={tooltipId} className="options-positioning-history-tooltip" role="tooltip">
        <strong>{annotation.label} · senaste 10</strong>
        <span className="options-positioning-history-head" aria-hidden="true">
          <span>Datum</span><span>Nivå</span><span>Δ</span>
        </span>
        <span className="options-positioning-history-list">
          {history.map((item, index) => (
            <span key={`${annotation.key}-${item.sourceTimestamp ?? item.date}-${index}`} className={index === 0 ? 'is-latest' : undefined}>
              <time dateTime={item.date}>{formatHistoryDate(item.date)}</time>
              <b>{formatNumber(item.value)}</b>
              <em>{formatSigned(item.delta)}</em>
            </span>
          ))}
        </span>
      </span>
    </span>
  );
}

function MetricBar({ value, pct, tone }) {
  const width = Math.max(0, Math.min(50, Number(pct ?? 0) / 2));
  return (
    <>
      <div className="options-positioning-bar-track" aria-hidden="true">
        <span className="options-positioning-bar-zero" />
        <i
          className={`options-positioning-bar tone-${tone} ${Number(value) < 0 ? 'is-negative' : 'is-positive'}`}
          style={{ width: `${width}%` }}
        />
      </div>
      <strong className={`options-positioning-value tone-${tone}`}>{formatCompact(value)}</strong>
    </>
  );
}

function mergeAnnotations(...groups) {
  const unique = new Map();
  for (const annotation of groups.flat()) {
    if (!unique.has(annotation.key)) unique.set(annotation.key, annotation);
  }
  return [...unique.values()];
}

function CombinedExposureLadder({ historyByKey, model }) {
  return (
    <section className="options-positioning-combined" aria-label="GEX och DEX per strike">
      <header className="options-positioning-combined-head">
        <div>
          <strong>Strike</strong>
          <span>Nyckelnivåer</span>
        </div>
        <div data-metric="gex">
          <strong>GEX per strike</strong>
          <span>Net GEX</span>
        </div>
        <div data-metric="dex">
          <strong>DEX per strike</strong>
          <span>Net DEX</span>
        </div>
      </header>

      <div className="options-positioning-combined-axis" aria-hidden="true">
        <span>Högst → lägst</span>
        <span className="options-positioning-metric-axis"><i>−max</i><i>0</i><i>+max</i></span>
        <span className="options-positioning-metric-axis"><i>−max</i><i>0</i><i>+max</i></span>
      </div>

      <div className="options-positioning-rows">
        {model.rows.map((row) => {
          const isSpot = row.strike === model.spotStrike;
          const levelAnnotations = mergeAnnotations(
            model.gexAnnotations.get(row.strike) ?? [],
            model.dexAnnotations.get(row.strike) ?? []
          );

          return (
            <div
              className={`options-positioning-row${isSpot ? ' is-spot' : ''}`}
              key={row.strike}
              aria-label={`Strike ${formatNumber(row.strike)}, GEX ${formatCompact(row.netGex)}, DEX ${formatCompact(row.netDex)}`}
            >
              <div className="options-positioning-strike-cell">
                <strong>{formatNumber(row.strike)}</strong>
                <span className="options-positioning-row-labels">
                  {isSpot ? <span className="options-positioning-spot-badge">Spot</span> : null}
                  {levelAnnotations.map((annotation) => (
                    <KeyLevelBadge
                      annotation={annotation}
                      history={historyByKey[annotation.key] ?? []}
                      key={`${row.strike}-${annotation.key}`}
                      scope="combined"
                    />
                  ))}
                </span>
              </div>

              <div className="options-positioning-metric" data-metric="gex">
                <MetricBar value={row.netGex} pct={row.gexPct} tone={row.gexTone} />
              </div>

              <div className="options-positioning-metric" data-metric="dex">
                <MetricBar value={row.netDex} pct={row.dexPct} tone={row.dexTone} />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export default function OptionsLadder({
  latestPrice,
  snapshots = [],
  strikePayload: providedStrikePayload = null,
  strikeStatus: providedStrikeStatus = null,
  ticker: providedTicker = '',
}) {
  const [fallbackTicker, setFallbackTicker] = useState('');
  const [localStrikePayload, setLocalStrikePayload] = useState({ strikes: [] });
  const [localStrikeStatus, setLocalStrikeStatus] = useState('loading');
  const ticker = String(providedTicker || fallbackTicker).trim().toUpperCase();

  useEffect(() => {
    if (providedTicker) {
      setFallbackTicker(String(providedTicker).trim().toUpperCase());
      return;
    }
    const nextTicker = new URLSearchParams(window.location.search).get('ticker')?.trim().toUpperCase() ?? '';
    setFallbackTicker(nextTicker);
  }, [providedTicker, snapshots]);

  useEffect(() => {
    if (providedStrikePayload) return undefined;
    if (!ticker) return undefined;
    const controller = new AbortController();
    let active = true;
    setLocalStrikeStatus('loading');

    fetch(`/api/gex-dex-strikes?ticker=${encodeURIComponent(ticker)}`, { signal: controller.signal })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result?.error || `HTTP ${response.status}`);
        if (!active) return;
        setLocalStrikePayload(result);
        setLocalStrikeStatus('ready');
      })
      .catch((error) => {
        if (!active || error?.name === 'AbortError') return;
        console.warn('Options positioning strikes unavailable:', error?.message ?? error);
        setLocalStrikePayload({ strikes: [] });
        setLocalStrikeStatus('error');
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [providedStrikePayload, ticker]);

  const strikePayload = providedStrikePayload ?? localStrikePayload;
  const strikeStatus = providedStrikeStatus ?? localStrikeStatus;
  const model = useMemo(() => buildOptionsPositioningModel({
    latestPrice: strikePayload.spotPrice ?? latestPrice,
    snapshots,
    strikes: strikePayload.strikes ?? [],
    maxPerSide: 30,
  }), [latestPrice, snapshots, strikePayload]);
  const historyByKey = useMemo(
    () => buildOptionsPositioningLevelHistory({ snapshots, limit: 10 }),
    [snapshots]
  );

  return (
    <aside className="options-positioning" aria-label="Optionspositionering">
      <header className="options-positioning-header">
        <div>
          <h2>Optionspositionering</h2>
          <span>{ticker || 'Vald ticker'}</span>
        </div>
        <strong className={`tone-${model.state.tone}`}>{model.state.label}</strong>
      </header>

      <section className="options-positioning-summary" aria-label="Optionsöversikt">
        <div><span>Spot</span><strong>{formatNumber(model.spotPrice)}</strong></div>
        <div><span>Net GEX</span><strong className={Number(model.netGex) < 0 ? 'tone-danger' : 'tone-positive'}>{formatCompact(model.netGex)}</strong></div>
        <div><span>Net DEX</span><strong className={Number(model.netDex) < 0 ? 'tone-danger' : 'tone-positive'}>{formatCompact(model.netDex)}</strong></div>
      </section>

      <div className="options-positioning-scroll">
        {strikeStatus === 'loading' ? (
          <div className="options-positioning-message">Strike-datan laddas…</div>
        ) : null}
        {strikeStatus === 'error' ? (
          <div className="options-positioning-message">Strike-datan är tillfälligt otillgänglig.</div>
        ) : null}
        {strikeStatus === 'ready' && model.rows.length ? (
          <CombinedExposureLadder historyByKey={historyByKey} model={model} />
        ) : null}
        {strikeStatus === 'ready' && !model.rows.length ? (
          <div className="options-positioning-message">Inga strike-nivåer finns i senaste snapshoten.</div>
        ) : null}
      </div>

      <footer className="options-positioning-footer">
        <span>Uppdaterad {formatTimestamp(model.sourceTimestamp)} New York</span>
        <span>{model.dataQuality ? `GammaLens · ${model.dataQuality}` : 'GammaLens'}</span>
      </footer>
    </aside>
  );
}
