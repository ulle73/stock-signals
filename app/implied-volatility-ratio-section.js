import { getLatestImpliedVolatilityRatioSignalRows } from '../lib/repositories/implied-volatility-ratio-signals.js';
import { buildImpliedVolatilityRatioDashboardView } from '../lib/utils/implied-volatility-ratio-dashboard-view.js';

function formatDate(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('sv-SE', {
    dateStyle: 'medium',
    timeZone: 'UTC',
  }).format(new Date(`${value}T00:00:00Z`));
}

function formatNumber(value, digits = 1) {
  if (value === null || value === undefined) return '—';
  return new Intl.NumberFormat('sv-SE', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(Number(value));
}

export default async function ImpliedVolatilityRatioSection() {
  const rows = await getLatestImpliedVolatilityRatioSignalRows();
  const viewModel = buildImpliedVolatilityRatioDashboardView(rows);

  if (!viewModel.rows.length) {
    return null;
  }

  return (
    <section className="card ivol-rvol-card">
      <div className="ivol-rvol-topline">
        <div className="ivol-rvol-title-block">
          <span className="ivol-rvol-title-rail" aria-hidden="true" />
          <div>
            <h2>Hur ser marknaden på framtida volatilitet?</h2>
            <p className="ivol-rvol-intro">
              Höga nivåer av Implied Volatility Ratio Z-Score 1y innebär att förväntad volatilitet
              är mycket högre än realiserad volatilitet, vilket signalerar nervositet och att många
              tagit skydd.
            </p>
          </div>
        </div>

        <aside className="ivol-rvol-category-card">
          <span>Volatility</span>
          <strong>Short-Term</strong>
        </aside>
      </div>

      <div className="ivol-rvol-layout">
        <div className="ivol-rvol-chart-card">
          <div className="ivol-rvol-legend">
            <span className="ivol-rvol-legend-item">
              <span className="ivol-rvol-legend-diamond" aria-hidden="true" />
              Implied Volatility Ratio (IVOL/RVOL), z-score 1y
            </span>
            <span className="ivol-rvol-legend-item">
              <span className="ivol-rvol-legend-dot" aria-hidden="true" />
              1 Week Ago
            </span>
            <span className="ivol-rvol-legend-item">
              <span className="ivol-rvol-legend-range" aria-hidden="true" />
              1Y High-Low Range
            </span>
          </div>

          <div className="ivol-rvol-chart">
            <div className="ivol-rvol-axis">
              {viewModel.ticks.map((tick) => (
                <span
                  className="ivol-rvol-axis-tick"
                  key={tick.value}
                  style={{ left: `${tick.positionPct}%` }}
                >
                  {tick.value}
                </span>
              ))}
            </div>

            <div className="ivol-rvol-grid">
              {viewModel.ticks.map((tick) => (
                <span
                  className="ivol-rvol-grid-line"
                  key={tick.value}
                  style={{ left: `${tick.positionPct}%` }}
                />
              ))}
            </div>

            <div className="ivol-rvol-rows">
              {viewModel.rows.map((row) => (
                <div className="ivol-rvol-row" key={row.assetKey}>
                  <div className="ivol-rvol-row-label">{row.displayLabel}</div>
                  <div className="ivol-rvol-row-track">
                    <span
                      className="ivol-rvol-range-bar"
                      style={{
                        left: `${row.rangeStartPct}%`,
                        width: `${row.rangeWidthPct}%`,
                      }}
                    />
                    <span
                      className="ivol-rvol-week-dot"
                      style={{ left: `${row.oneWeekAgoPositionPct}%` }}
                      title={`1 vecka sedan: ${formatNumber(row.oneWeekAgoZScore)}`}
                    />
                    <span
                      className="ivol-rvol-current-diamond"
                      style={{ left: `${row.currentPositionPct}%` }}
                      title={`Nu: ${formatNumber(row.currentZScore)}`}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <aside className="ivol-rvol-note-card">
          <div className="ivol-rvol-note-head">
            <span className="ivol-rvol-note-icon" aria-hidden="true">i</span>
          </div>

          <div className="ivol-rvol-note-copy">
            <p>
              Ett högt värde på Implied Volatility Ratio signalerar risk off. Förväntad volatilitet
              är mycket högre än realiserad volatilitet.
            </p>
            <p>
              Många har skyddat sig för nedgång, något vi brukar se efter ett prisfall. När många är
              både mentalt och finansiellt förberedda på en nedgång utgör det ett stöd till marknaden
              eftersom det finns ett latent köptryck som realiseras när dessa aktörer stänger sina skydd.
            </p>
            <p>
              För ytterligare en dimension kan indikatorn sättas i relation till realiserad volatilitet
              senaste 30 dagarna. Har vi t.ex. en låg nivå på Implied Volatility Ratio tillsammans med
              låg realiserad volatilitet är det signal på korrektion/rekyl. Är Implied Volatility Ratio
              hög tillsammans med hög RVOL är det signal på Short Squeeze.
            </p>
            <p>
              Indikatorn ska också sättas i kontext med Trend &amp; Trade Range och marknadsregimer.
              Kombination av #BullishTrend, pris vid nedre delen av Trade Range, fungerar i rådande
              marknadsregim och hög Implied Volatility Ratio är en stark köpsignal.
            </p>
          </div>
        </aside>
      </div>

      <p className="footnote ivol-rvol-footnote">
        Snapshot {formatDate(viewModel.date)} · {viewModel.rows.length} aktiva proxyserier i IVOL/RVOL-matrisen.
      </p>
    </section>
  );
}
