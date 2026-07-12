'use client';

import { CHART_PERIODS } from '../../lib/chart/chart-periods.js';
import {
  CHART_SERIES,
  MOVING_AVERAGE_KEYS,
} from '../../lib/chart/series-registry.js';

function periodLabel(period) {
  return period === 'ALL' ? 'All' : period;
}

export default function ChartToolbar({
  constituents,
  onPeriodChange,
  onReset,
  onTickerChange,
  onToggleOverlay,
  period,
  ticker,
  unavailableOverlays,
  visibleOverlays,
}) {
  return (
    <div className="chart-toolbar" aria-label="Chartkontroller">
      <label className="chart-toolbar-field" htmlFor="chart-ticker">
        <span>Aktie</span>
        <select
          id="chart-ticker"
          value={ticker}
          onChange={(event) => onTickerChange(event.target.value)}
        >
          {constituents.map((item) => (
            <option key={item.ticker} value={item.ticker}>
              {item.ticker} · {item.company_name}
            </option>
          ))}
        </select>
      </label>

      <div className="chart-toolbar-group" role="group" aria-label="Tidsperiod">
        <span>Period</span>
        <div className="chart-segmented-control">
          {CHART_PERIODS.map((value) => (
            <button
              type="button"
              className={period === value ? 'is-active' : undefined}
              aria-pressed={period === value}
              key={value}
              onClick={() => onPeriodChange(value)}
            >
              {periodLabel(value)}
            </button>
          ))}
        </div>
      </div>

      <div className="chart-toolbar-group chart-toolbar-overlays" role="group" aria-label="Glidande medelvärden">
        <span>Överlays</span>
        <div className="chart-overlay-control">
          {MOVING_AVERAGE_KEYS.map((key) => {
            const unavailable = unavailableOverlays.includes(key);
            const active = visibleOverlays.includes(key);
            return (
              <button
                type="button"
                aria-pressed={active}
                className={active ? 'is-active' : undefined}
                disabled={unavailable}
                key={key}
                onClick={() => onToggleOverlay(key)}
                title={unavailable ? `${CHART_SERIES[key].label} saknas för vald period` : `Visa eller dölj ${CHART_SERIES[key].label}`}
              >
                <i aria-hidden="true" style={{ background: CHART_SERIES[key].color }} />
                {CHART_SERIES[key].label}
              </button>
            );
          })}
        </div>
      </div>

      <button type="button" className="chart-reset-button" onClick={onReset}>
        Återställ vy
      </button>
    </div>
  );
}
