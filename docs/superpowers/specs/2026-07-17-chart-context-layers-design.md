# Professional Chart Context Layers — Design

## Goal

Add five decision-support layers to `/chart` without turning the price chart into an indicator wall:

1. historical GEX/DEX levels,
2. relative strength context,
3. market and sector breadth context,
4. stock-specific volatility regime,
5. earnings context and markers.

The existing price, moving-average, volume, RYD OBV and signal behavior remains unchanged.

## Visual hierarchy

### Default view

The standard view shows:

- Call Wall, Put Wall and Gamma Flip as historical step lines when valid snapshots exist,
- earnings markers on dates that overlap real price bars,
- one compact context strip above the chart containing Relative Strength, Breadth, Volatility and Options Positioning.

The standard view does not add another oscillator pane.

### Optional detail

A compact `Kontext` toolbar group controls:

- `GEX/DEX` — main levels, on by default,
- `Fler nivåer` — DEX Resistance, DEX Support and Vol Trigger, off by default,
- `Rapporter` — earnings markers, on by default.

Missing optional data disables only the affected visual layer. It never prevents price history from loading.

## GEX/DEX

### Historical integrity

Only actual rows from `gex_dex_source_snapshots` are rendered. Each level starts at its first stored snapshot. No current value is projected backward before collection began.

Snapshots are collapsed to the latest observation per UTC date. Line data uses step interpolation between snapshot dates. The latest valid value is extended only to the latest chart date.

### Standard levels

- Call Wall: restrained cool-blue solid line.
- Put Wall: restrained magenta/red solid line.
- Gamma Flip: neutral amber dashed line.

### Optional levels

- DEX Resistance: muted violet.
- DEX Support: muted cyan.
- Vol Trigger: muted orange when the provider supplies a numeric `key_levels.vol_trigger` value.

Only the last value receives a compact right-axis label. No large badges are drawn inside the chart.

### Freshness

The options context card displays provider state, latest snapshot time and stale status. When the latest snapshot is stale, GEX/DEX lines become lower-opacity dashed lines and the card clearly says `Stale`.

## Relative strength

Use `stock_relative_strength_daily`.

The card shows:

- current 63-day percentile as the main value,
- `Stärks`, `Försvagas` or `Stabil` based on the latest 21-day relative-strength value versus five valid observations earlier,
- 21-day and 126-day values in the native tooltip.

No relative-strength line is added to the chart.

## Breadth

Use the selected company sector from `sp500_constituents`, `sector_breadth_daily`, and `market_breadth_daily`.

The card shows:

- sector direction from the change in `pct_above_sma50` versus five valid observations earlier,
- latest sector SMA50 breadth,
- latest market SMA50 breadth on the same line.

A move of at least 2 percentage points is improving or deteriorating; smaller changes are stable. SMA20, SMA200 and new-high/new-low fields are available in the tooltip.

## Volatility regime

This is stock-specific and is calculated from adjusted OHLC history, independently of the selected chart period.

- Calculate true range and Wilder ATR14.
- Compare the latest ATR14 as a percentage of close with the trailing 252-valid-observation distribution.
- Show percentile and regime:
  - 0–25: `Kompression`
  - 26–74: `Normal`
  - 75–89: `Expansion`
  - 90–100: `Extrem`
- Direction compares the latest ATR percentage with five valid observations earlier.

The card tooltip also shows latest ATR percentage and 20-day annualized realized volatility.

## Earnings

Use `stock_earnings_calendar_daily` and deduplicate by `earnings_date`.

- Historical report dates overlapping price bars render as compact amber `E` markers below price.
- Upcoming dates do not create artificial future candles or whitespace.
- The nearest upcoming report is shown in the context/header area with date, confirmation state and calendar-day distance.
- Missing or unconfirmed data is labeled explicitly.

## Data/API architecture

`lib/repositories/chart-data.js` remains the single chart payload boundary. Each new source is fetched through a dedicated fail-open helper and returned in top-level payload fields:

- `gexDexSnapshots`
- `relativeStrengthContext`
- `breadthContext`
- `volatilityContext`
- `earningsEvents`
- `nextEarnings`

Pure chart helpers normalize and classify each data family. The browser only renders server-provided normalized values and deterministic series data.

## Error handling

Every optional source is wrapped independently. A missing table, absent ticker data, stale provider response or malformed optional value results in an empty/null context layer and a server warning. Core OHLC data continues to return HTTP 200.

## Testing

Focused tests cover:

- no backward GEX/DEX projection,
- step-series construction and latest-date extension,
- stale options styling state,
- relative-strength direction and 63-day display value,
- breadth direction thresholds,
- Wilder ATR14, percentile and regime boundaries,
- earnings deduplication and marker-date filtering,
- fail-open repository source isolation,
- toolbar defaults and context-strip structure.

The complete Node test suite and Next.js production build must pass before the pull request is ready.