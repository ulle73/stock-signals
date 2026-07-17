'use client';

import { CHART_PERIODS } from '../../lib/chart/chart-periods.js';
import {
  CHART_SERIES,
  CONTEXT_LAYER_KEYS,
  INDICATOR_KEYS,
  MOVING_AVERAGE_KEYS,
  SIGNAL_KEYS,
} from '../../lib/chart/series-registry.js';

function periodLabel(period) {
  return period === 'ALL' ? 'All' : period;
}

function ToggleButtons({ keys, unavailableKeys = [], visibleKeys, onToggle }) {
  return keys.map((key) => {
    const unavailable = unavailableKeys.includes(key);
    const active = visibleKeys.includes(key);
    const color = CHART_SERIES[key].color ?? '#fffb00';
    return (
      <button
        type="button"
        aria-pressed={active}
        className={active ? 'is-active' : undefined}
        disabled={unavailable}
        key={key}
        onClick={() => onToggle(key)}
        title={unavailable ? `${CHART_SERIES[key].label} saknas för vald period` : `Visa eller dölj ${CHART_SERIES[key].label}`}
      >
        <i aria-hidden="true" style={{ background: color }} />
        {CHART_SERIES[key].label}
      </button>
    );
  });
}

function TickerOptions({ items }) {
  return items.map((item) => (
    <option key={item.ticker} value={item.ticker}>
      {item.ticker} · {item.company_name}
    </option>
  ));
}

export default function ChartToolbar({
  constituents,
  onPeriodChange,
  onReset,
  onTickerChange,
  onToggleContextLayer,
  onToggleIndicator,
  onToggleOverlay,
  onToggleSignal,
  period,
  ticker,
  unavailableIndicators,
  unavailableOverlays,
  unavailableSignals,
  visibleContextLayers,
  visibleIndicators,
  visibleOverlays,
  visibleSignals,
}) {
  const featuredTickers = constituents.filter((item) => item.featured);
  const remainingTickers = constituents.filter((item) => !item.featured);

  return (
    <div className="chart-toolbar" aria-label="Chartkontroller">
      <label className="chart-toolbar-field" htmlFor="chart-ticker">
        <span>Aktie</span>
        <select
          id="chart-ticker"
          value={ticker}
          onChange={(event) => onTickerChange(event.target.value)}
        >
          <optgroup label="Prioriterade GEX/DEX">
            <TickerOptions items={featuredTickers} />
          </optgroup>
          <optgroup label="Övriga S&P 500">
            <TickerOptions items={remainingTickers} />
          </optgroup>
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
          <ToggleButtons
            keys={MOVING_AVERAGE_KEYS}
            unavailableKeys={unavailableOverlays}
            visibleKeys={visibleOverlays}
            onToggle={onToggleOverlay}
          />
        </div>
      </div>

      <div className="chart-toolbar-group chart-toolbar-indicators" role="group" aria-label="Egna indikatorer">
        <span>Indikatorer</span>
        <div className="chart-overlay-control">
          <ToggleButtons
            keys={INDICATOR_KEYS}
            unavailableKeys={unavailableIndicators}
            visibleKeys={visibleIndicators}
            onToggle={onToggleIndicator}
          />
        </div>
      </div>

      <div className="chart-toolbar-group chart-toolbar-signals" role="group" aria-label="Signalsymboler">
        <span>Signaler</span>
        <div className="chart-overlay-control">
          <ToggleButtons
            keys={SIGNAL_KEYS}
            unavailableKeys={unavailableSignals}
            visibleKeys={visibleSignals}
            onToggle={onToggleSignal}
          />
        </div>
      </div>

      <div className="chart-toolbar-group chart-toolbar-context" role="group" aria-label="Kontextlager">
        <span>Kontext</span>
        <div className="chart-overlay-control">
          <ToggleButtons
            keys={CONTEXT_LAYER_KEYS}
            visibleKeys={visibleContextLayers}
            onToggle={onToggleContextLayer}
          />
        </div>
      </div>

      <button type="button" className="chart-reset-button" onClick={onReset}>
        Återställ vy
      </button>
    </div>
  );
}
