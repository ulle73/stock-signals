# Professional Chart V1 — Design Specification

## Status

Approved for implementation planning.

## Goal

Add a production-grade, maintainable chart area to `stock-signals` without changing existing market, signal, ranking, database, or portfolio logic.

The first version introduces a dedicated `/chart` route and a new `Chart` item in the primary navigation. The chart displays daily OHLC candles, volume, and the existing SMA5, SMA10, SMA20, SMA50, and SMA200 series.

The architecture must be ready for later additions such as GEX/DEX levels, gamma flip, call/put walls, DEX support/resistance, RYD OBV, MACD-V, TF Sync, breakouts, and volume events without requiring a chart rewrite.

## Non-goals

V1 does not:

- change any indicator calculation or threshold;
- create new buy, sell, entry, stop, target, or portfolio recommendations;
- add GEX/DEX, RYD OBV, MACD-V, TF Sync, or signal markers yet;
- replace the existing dashboard;
- alter database tables or migrations;
- introduce live broker execution or real-time streaming;
- expose chart-library internals throughout the application.

## Product behavior

### Navigation

Add a `Chart` navigation item that opens `/chart`.

The existing dashboard navigation and sections remain unchanged. The chart is a separate workspace rather than another large section appended to the current dashboard.

### Chart workspace

The `/chart` page contains:

- a ticker selector;
- period controls: `3M`, `6M`, `1Y`, `2Y`, and `All`;
- toggles for SMA5, SMA10, SMA20, SMA50, and SMA200;
- latest price, daily change, company name, sector, and latest data date;
- a large candlestick pane;
- a compact synchronized volume pane;
- crosshair values for date, OHLC, volume, and visible moving averages;
- zoom, horizontal pan, and reset-view behavior;
- explicit loading, empty-data, partial-data, and error states;
- visible TradingView attribution as required by the Lightweight Charts license.

The chart must not display financial advice, a buy plan, or action labels.

## Visual design

The chart should look like a professional market-analysis product rather than a decorative dashboard card.

Principles:

- the chart is the dominant visual element and should occupy roughly 70–75% of the usable desktop viewport height;
- restrained dark surfaces, limited glow, and strong contrast;
- candles remain visually dominant over overlays;
- moving averages use thin, distinct, centrally configured styles;
- labels and legends must not cover important price action;
- the right price scale and bottom time scale remain readable at common desktop widths;
- mobile and tablet layouts use a reduced toolbar without changing the data contract;
- missing values are omitted rather than connected through invalid gaps;
- toolbar controls remain keyboard accessible and expose clear active states.

## Technical architecture

### Chart engine

Use TradingView Lightweight Charts version 5.x.

The library is loaded only on the `/chart` route and only in a client component. Server-rendered page content must not access browser APIs.

### Component boundaries

```text
app/chart/page.js                     Server route and initial data loading
app/chart/chart-workspace.js          Client workspace state and controls
app/chart/financial-chart.js          Chart lifecycle and rendering boundary
app/chart/chart-toolbar.js            Ticker, period, MA toggles, reset
app/chart/crosshair-legend.js         Current crosshair values
lib/repositories/chart-data.js        Database query only
lib/chart/normalize-chart-data.js     Stable transformation and validation
lib/chart/series-registry.js          Series definitions and future extensibility
lib/chart/chart-theme.js              Central visual configuration
```

Exact file names may follow established repository conventions, but the responsibilities must remain separated.

### FinancialChart boundary

`FinancialChart` owns:

- chart creation and cleanup;
- `ResizeObserver` integration;
- price, volume, and MA series creation;
- series visibility changes;
- crosshair subscription and cleanup;
- visible-range updates;
- fit/reset behavior.

It does not:

- query the database;
- calculate indicators;
- decide market actions;
- own URL routing;
- know table or column names.

### Series registry

All chart layers are registered through one internal series registry.

V1 keys:

- `price`
- `volume`
- `sma5`
- `sma10`
- `sma20`
- `sma50`
- `sma200`

Future keys can include:

- `callWall`
- `putWall`
- `gammaFlip`
- `dexSupport`
- `dexResistance`
- `rydObv`
- `macdV`
- `tfSync`
- `breakoutEvents`
- `volumeEvents`

Future layers must be addable through the registry and stable chart data contract instead of direct one-off chart manipulation.

## Data architecture

### Repository query

Add a chart-specific repository function rather than expanding the current small ticker snapshot query.

The repository function receives:

- ticker;
- start date or period;
- a safe maximum row limit.

It returns ascending daily rows containing:

- date;
- open;
- high;
- low;
- close;
- adjusted close where relevant;
- volume;
- SMA5;
- SMA10;
- SMA20;
- SMA50;
- SMA200.

The SQL query must be parameterized. The server must cap the maximum number of rows and reject malformed ticker or period values.

### Stable frontend contract

The client receives a chart-specific object independent of database implementation details:

```js
{
  ticker: "AAPL",
  companyName: "Apple Inc.",
  sector: "Information Technology",
  currency: "USD",
  latestDate: "2026-07-10",
  bars: [
    {
      time: "2026-07-10",
      open: 210.2,
      high: 214.1,
      low: 209.4,
      close: 213.6,
      volume: 58400000,
      sma5: 211.8,
      sma10: 209.7,
      sma20: 207.4,
      sma50: 198.2,
      sma200: 184.6
    }
  ]
}
```

### Normalization rules

Before reaching the chart:

- rows are sorted in ascending date order;
- duplicate dates are removed deterministically;
- OHLC rows with invalid or non-finite required values are rejected;
- zero is not treated as missing;
- optional MA values are converted to numbers or omitted;
- volume is converted to a non-negative finite number;
- dates remain daily business-day values compatible with Lightweight Charts;
- no interpolation is performed across missing indicator values;
- all transformations are deterministic and independently testable.

## State and URL behavior

The selected ticker and period should be represented in URL search parameters so the view can be bookmarked and refreshed without losing context.

Example:

```text
/chart?ticker=AAPL&period=1Y
```

Invalid or unavailable values fall back to a documented default ticker and `1Y` period.

MA visibility may be persisted locally, but V1 should prefer a predictable default over complex preference storage.

Recommended default visibility:

- SMA20: on;
- SMA50: on;
- SMA200: on;
- SMA5: off;
- SMA10: off.

## Loading and error behavior

### Loading

Show a stable skeleton sized like the final chart. Avoid layout shifts.

### Empty data

Display an explicit message that no usable chart history exists for the selected ticker and period. Do not render a blank chart.

### Partial data

The chart may render valid candles even when one or more moving averages are unavailable. The toolbar indicates unavailable overlays without treating the whole chart as failed.

### Query or rendering error

Show a recoverable error state with a retry action. Log technical detail server-side or to the existing error channel, while keeping user-facing copy concise.

## Performance

- Dynamically load the chart client component and library only on `/chart`.
- Create each chart instance once per mounted workspace.
- Use `setData` for initial or full ticker/period replacement.
- Reserve `update` for later incremental/live updates.
- Avoid React state updates on every pointer movement when direct legend updates or throttling is sufficient.
- Resize through `ResizeObserver`, with proper observer cleanup.
- Query only the history required by the selected period, subject to a safe cap.
- Cache server results where compatible with the repository's current data-refresh model.
- Avoid large serialized props outside the chart route.

## Accessibility

- All toolbar controls are native buttons or accessible controls.
- Active overlays are represented by text/state, not color alone.
- Controls have visible focus styles.
- Chart summary information remains available as text outside the canvas.
- Error and loading messages use appropriate live-region behavior.
- The chart does not claim full screen-reader equivalence to a visual financial chart, but essential latest-value context is provided semantically.

## Testing

### Unit tests

Test chart-data normalization for:

- ascending and descending input;
- duplicate dates;
- missing moving averages;
- invalid OHLC values;
- valid zero values;
- malformed volume;
- period filtering;
- empty input.

### Component tests

Test:

- default MA visibility;
- toggling each MA;
- ticker and period URL changes;
- unavailable MA state;
- loading, empty, partial, and error states;
- cleanup of subscriptions and observers;
- reset-view behavior.

### Integration and build verification

- production Next.js build passes;
- existing tests continue to pass;
- `/chart` renders with real repository data;
- existing dashboard behavior and routes remain unchanged;
- desktop, tablet, and mobile layouts are visually inspected;
- no console errors or leaked chart instances occur during repeated navigation.

## Acceptance criteria

The feature is complete when:

1. `Chart` appears in the main navigation and opens `/chart`.
2. The route renders a large responsive candlestick chart using stored daily data.
3. Volume and SMA5/10/20/50/200 are supported, with SMA20/50/200 visible by default.
4. Ticker and period controls update the chart and URL safely.
5. Crosshair information displays correct OHLC, volume, and visible MA values.
6. Loading, empty, partial, and error states are clear and stable.
7. The chart remains usable after resizing and repeated route navigation.
8. Existing signal calculations, database schema, thresholds, and dashboard sections are unchanged.
9. Automated tests and production build pass.
10. The internal boundaries support adding GEX/DEX levels and separate indicator panes without rewriting the chart foundation.

## Primary risk

The most expensive failure would be coupling the page directly to Lightweight Charts and the current five moving averages. That would make every later GEX/DEX or indicator-pane addition a structural rewrite.

The design avoids that by separating database access, normalized chart data, series registration, chart lifecycle, and workspace controls from the first set of visible overlays.
