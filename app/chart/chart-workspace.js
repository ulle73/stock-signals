'use client';

import dynamic from 'next/dynamic';
import { useEffect, useMemo, useState } from 'react';
import {
  CHART_SERIES,
  DEFAULT_VISIBLE_INDICATORS,
  DEFAULT_VISIBLE_OVERLAYS,
  DEFAULT_VISIBLE_SIGNALS,
  INDICATOR_KEYS,
  MOVING_AVERAGE_KEYS,
  SIGNAL_KEYS,
} from '../../lib/chart/series-registry.js';
import { signalControlsUnavailable } from '../../lib/chart/signal-controls.js';
import ChartToolbar from './chart-toolbar.js';

const FinancialChart = dynamic(() => import('./financial-chart.js'), {
  ssr: false,
  loading: () => <ChartSkeleton copy="Chartmotorn laddas…" />,
});

function ChartSkeleton({ copy = 'Prishistoriken laddas…' }) {
  return (
    <div className="chart-workspace-skeleton" role="status" aria-live="polite">
      <div className="chart-skeleton-legend" />
      <div className="chart-skeleton-grid" />
      <span>{copy}</span>
    </div>
  );
}

function formatPrice(value, currency = 'USD') {
  if (!Number.isFinite(Number(value))) return '—';
  return new Intl.NumberFormat('sv-SE', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value));
}

function formatSignedPercent(value) {
  if (!Number.isFinite(Number(value))) return '—';
  const number = Number(value);
  return `${number > 0 ? '+' : ''}${number.toFixed(2)}%`;
}

function formatDate(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('sv-SE', {
    dateStyle: 'medium',
    timeZone: 'UTC',
  }).format(new Date(`${value}T00:00:00Z`));
}

export default function ChartWorkspace({ constituents, initialPeriod, initialTicker }) {
  const [ticker, setTicker] = useState(initialTicker);
  const [period, setPeriod] = useState(initialPeriod);
  const [visibleOverlays, setVisibleOverlays] = useState([...DEFAULT_VISIBLE_OVERLAYS]);
  const [visibleIndicators, setVisibleIndicators] = useState([...DEFAULT_VISIBLE_INDICATORS]);
  const [visibleSignals, setVisibleSignals] = useState([...DEFAULT_VISIBLE_SIGNALS]);
  const [payload, setPayload] = useState(null);
  const [status, setStatus] = useState('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [retryToken, setRetryToken] = useState(0);
  const [resetToken, setResetToken] = useState(0);

  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set('ticker', ticker);
    url.searchParams.set('period', period);
    window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
  }, [period, ticker]);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    async function loadChartData() {
      setStatus('loading');
      setErrorMessage('');
      setPayload(null);

      try {
        const response = await fetch(
          `/api/chart-data?ticker=${encodeURIComponent(ticker)}&period=${encodeURIComponent(period)}`,
          { signal: controller.signal }
        );
        const result = await response.json();

        if (!response.ok) {
          throw new Error(result?.error || `HTTP ${response.status}`);
        }
        if (!active) return;

        setPayload(result);
        setStatus(result?.bars?.length ? 'ready' : 'empty');
      } catch (error) {
        if (error?.name === 'AbortError' || !active) return;
        console.error('Professional chart load failed:', error);
        setErrorMessage(error?.message || 'Chartdatan kunde inte laddas.');
        setStatus('error');
      }
    }

    void loadChartData();

    return () => {
      active = false;
      controller.abort();
    };
  }, [period, retryToken, ticker]);

  const unavailableOverlays = useMemo(() => {
    const bars = payload?.bars ?? [];
    return MOVING_AVERAGE_KEYS.filter(
      (key) => !bars.some((bar) => Number.isFinite(Number(bar[key])))
    );
  }, [payload]);

  const unavailableIndicators = useMemo(() => {
    const bars = payload?.bars ?? [];
    return INDICATOR_KEYS.filter((key) => {
      const dataKey = CHART_SERIES[key].dataKey;
      return !bars.some((bar) => Number.isFinite(Number(bar[dataKey])));
    });
  }, [payload]);

  const unavailableSignals = useMemo(
    () => signalControlsUnavailable(payload?.bars ?? []),
    [payload]
  );

  const dailyTone = Number(payload?.dailyChangePct) > 0
    ? 'positive'
    : Number(payload?.dailyChangePct) < 0
      ? 'danger'
      : 'neutral';

  function toggleList(setter, unavailable, key) {
    if (unavailable.includes(key)) return;
    setter((current) => (
      current.includes(key)
        ? current.filter((item) => item !== key)
        : [...current, key]
    ));
  }

  return (
    <section className="chart-workspace" aria-labelledby="chart-workspace-title">
      <header className="chart-workspace-header">
        <div>
          <p className="section-kicker">Professionell chart · Daily</p>
          <div className="chart-title-row">
            <h1 id="chart-workspace-title">{payload?.ticker ?? ticker}</h1>
            <span className="chart-company-name">{payload?.companyName ?? 'Laddar bolagsdata…'}</span>
          </div>
          <p className="chart-workspace-context">
            {payload?.sector ?? 'Sektor saknas'} · Justerade priser · Senaste data {formatDate(payload?.latestDate)}
          </p>
        </div>

        <div className="chart-price-summary" aria-label="Senaste prisutveckling">
          <strong>{formatPrice(payload?.latestPrice, payload?.currency)}</strong>
          <span className={`tone-${dailyTone}`}>
            {formatSignedPercent(payload?.dailyChangePct)} senaste handelsdagen
          </span>
        </div>
      </header>

      <ChartToolbar
        constituents={constituents}
        ticker={ticker}
        period={period}
        visibleIndicators={visibleIndicators}
        visibleOverlays={visibleOverlays}
        visibleSignals={visibleSignals}
        unavailableIndicators={unavailableIndicators}
        unavailableOverlays={unavailableOverlays}
        unavailableSignals={unavailableSignals}
        onTickerChange={setTicker}
        onPeriodChange={setPeriod}
        onToggleIndicator={(key) => toggleList(setVisibleIndicators, unavailableIndicators, key)}
        onToggleOverlay={(key) => toggleList(setVisibleOverlays, unavailableOverlays, key)}
        onToggleSignal={(key) => toggleList(setVisibleSignals, unavailableSignals, key)}
        onReset={() => setResetToken((value) => value + 1)}
      />

      <div className="chart-workspace-frame">
        {status === 'loading' ? <ChartSkeleton /> : null}

        {status === 'error' ? (
          <div className="chart-workspace-message" role="alert">
            <strong>Charten kunde inte laddas</strong>
            <span>{errorMessage}</span>
            <button type="button" onClick={() => setRetryToken((value) => value + 1)}>
              Försök igen
            </button>
          </div>
        ) : null}

        {status === 'empty' ? (
          <div className="chart-workspace-message" role="status">
            <strong>Ingen användbar prishistorik</strong>
            <span>Välj en annan ticker eller period.</span>
          </div>
        ) : null}

        {status === 'ready' && payload ? (
          <FinancialChart
            bars={payload.bars}
            currency={payload.currency}
            period={payload.period}
            resetToken={resetToken}
            ticker={payload.ticker}
            visibleIndicators={visibleIndicators}
            visibleOverlays={visibleOverlays}
            visibleSignals={visibleSignals}
          />
        ) : null}
      </div>

      <footer className="chart-workspace-footer">
        <span>{payload?.bars?.length ?? 0} handelsdagar · {period}</span>
        {unavailableOverlays.length ? (
          <span>{unavailableOverlays.length} MA-serier saknar data i vald period</span>
        ) : <span>Alla MA-serier tillgängliga</span>}
        {unavailableIndicators.length === INDICATOR_KEYS.length
          ? <span>RYD OBV saknar data i vald period</span>
          : <span>RYD OBV tillgänglig</span>}
        <a href="https://www.tradingview.com/" target="_blank" rel="noreferrer">
          Charting by TradingView Lightweight Charts™
        </a>
      </footer>
    </section>
  );
}
