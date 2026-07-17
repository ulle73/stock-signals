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

function ExposureChart({
  annotations,
  historyByKey,
  metricKey,
  pctKey,
  rows,
  scope,
  spotStrike,
  title,
  toneKey,
}) {
  return (
    <section className="options-positioning-chart" aria-label={`${title} per strike`}>
      <header>
        <strong>{title} per strike</strong>
        <span>{title === 'GEX' ? 'Net GEX' : 'Net DEX'}</span>
      </header>
      <div className="options-positioning-axis" aria-hidden="true">
        <span>−max</span><span>0</span><span>+max</span>
      </div>
      <div className="options-positioning-rows">
        {rows.map((row) => {
          const levelAnnotations = annotations.get(row.strike) ?? [];
          const isSpot = row.strike === spotStrike;
          const value = row[metricKey];
          const tone = row[toneKey];
          const width = Math.max(0, Math.min(50, Number(row[pctKey] ?? 0) / 2));
          return (
            <div
              className={`options-positioning-row${isSpot ? ' is-spot' : ''}`}
              key={`${scope}-${row.strike}`}
              aria-label={`${title} strike ${formatNumber(row.strike)}: ${formatCompact(value)}`}
            >
              <div className="options-positioning-strike-cell">
                <strong>{formatNumber(row.strike)}</strong>
                <span className="options-positioning-row-labels">
                  {isSpot ? <span className="options-positioning-spot-badge">Spot</span> : null}
                  {levelAnnotations.map((annotation) => (
                    <KeyLevelBadge
                      annotation={annotation}
                      history={historyByKey[annotation.key] ?? []}
                      key={`${scope}-${row.strike}-${annotation.key}`}
                      scope={scope}
                    />
                  ))}
                </span>
              </div>
              <div className="options-positioning-bar-track" aria-hidden="true">
                <span className="options-positioning-bar-zero" />
                <i
                  className={`options-positioning-bar tone-${tone} ${Number(value) < 0 ? 'is-negative' : 'is-positive'}`}
                  style={{ width: `${width}%` }}
                />
              </div>
              <strong className={`options-positioning-value tone-${tone}`}>{formatCompact(value)}</strong>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export default function OptionsLadder({ latestPrice, snapshots = [] }) {
  const [ticker, setTicker] = useState('');
  const [strikePayload, setStrikePayload] = useState({ strikes: [] });
  const [strikeStatus, setStrikeStatus] = useState('loading');

  useEffect(() => {
    const nextTicker = new URLSearchParams(window.location.search).get('ticker')?.trim().toUpperCase() ?? '';
    setTicker(nextTicker);
  }, [snapshots]);

  useEffect(() => {
    if (!ticker) return undefined;
    const controller = new AbortController();
    let active = true;
    setStrikeStatus('loading');

    fetch(`/api/gex-dex-strikes?ticker=${encodeURIComponent(ticker)}`, { signal: controller.signal })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result?.error || `HTTP ${response.status}`);
        if (!active) return;
        setStrikePayload(result);
        setStrikeStatus('ready');
      })
      .catch((error) => {
        if (!active || error?.name === 'AbortError') return;
        console.warn('Options positioning strikes unavailable:', error?.message ?? error);
        setStrikePayload({ strikes: [] });
        setStrikeStatus('error');
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [ticker]);

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
          <>
            <ExposureChart
              annotations={model.gexAnnotations}
              historyByKey={historyByKey}
              metricKey="netGex"
              pctKey="gexPct"
              rows={model.rows}
              scope="gex"
              spotStrike={model.spotStrike}
              title="GEX"
              toneKey="gexTone"
            />
            <ExposureChart
              annotations={model.dexAnnotations}
              historyByKey={historyByKey}
              metricKey="netDex"
              pctKey="dexPct"
              rows={model.rows}
              scope="dex"
              spotStrike={model.spotStrike}
              title="DEX"
              toneKey="dexTone"
            />
          </>
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
