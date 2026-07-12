# RYD OBV Chart Panel Design

## Goal

Extend the existing professional `/chart` workspace with the already calculated RYD OBV indicator, without changing indicator calculations, raw data fetching, schemas, thresholds, or signal rules.

## Visual result

The chart keeps three synchronized panes in this order:

1. Price candles with selectable SMA overlays.
2. Trading volume.
3. `RYD OBV Z-Scores with Signals 2025`.

The RYD pane must match the supplied TradingView reference as closely as practical within Lightweight Charts 5.2:

- Z-score rendered as a histogram.
- Positive non-extreme bars are green.
- Negative non-extreme bars are red.
- Neutral bars between `-1.25` and `1.25` are gray.
- Extreme bars at or beyond `+2.70` or `-2.70` are yellow.
- Horizontal guides at `0`, `±1.25`, `±2.70`, and `±6.0`.
- Existing sell signals render as red downward arrows above the histogram.
- Existing buy signals render as green upward arrows below the histogram.
- A subtle pane title reads `RYD OBV Z-Scores with Signals 2025`.

## Raw OBV

The raw `ryd_obv` series is available as a user toggle named `Rå OBV`.

- It is off by default.
- It renders as a thin line in the same RYD pane.
- It uses an independent left price scale so the Z-score histogram remains readable.
- The left scale is only visible while raw OBV is enabled.

## Data contract

The chart repository reads these existing `stock_daily_indicators` fields:

- `ryd_obv`
- `ryd_obv_zscore_80`
- `ryd_obv_buy_signal`
- `ryd_obv_sell_signal`
- `ryd_obv_signal`

Normalization adds only finite numeric values and normalized booleans/signals to each chart bar. Rows with fewer than 80 warmup observations retain `null`/missing Z-score data and do not create histogram points.

## Interaction

The toolbar gets an `Indikatorer` group:

- `RYD Z-score` is always enabled when data exists and controls visibility of the RYD pane series.
- `Rå OBV` is optional and disabled when no raw OBV data exists.

The crosshair legend adds:

- `RYD Z`
- `RYD OBV` when raw OBV is enabled
- the stored signal value translated to neutral Swedish copy (`Köp-korsning`, `Sälj-korsning`, or `Ingen`)

No recommendation, position sizing, entry, stop, target, or advice is added.

## Architecture

A focused `lib/chart/ryd-obv-series.js` module owns pure presentation transformations:

- histogram color selection
- histogram point construction
- raw OBV line construction
- signal marker construction
- immutable threshold definitions

`financial-chart.js` remains responsible for Lightweight Charts lifecycle, panes, price lines, markers, crosshair values, resizing, and cleanup.

## Pane sizing

Default desktop proportions:

- Price: remaining height after lower panes
- Volume: approximately 14–16%, with a minimum of 88px
- RYD OBV: approximately 24–27%, with a minimum of 150px

The chart keeps one shared time scale. Users can resize pane separators because the existing chart configuration already enables pane resizing.

## Error and missing-data behavior

- Missing RYD data never prevents price and volume from rendering.
- The RYD controls are disabled when their corresponding data series is unavailable.
- Signal markers are created only for dates that also have a finite Z-score point.
- Duplicate dates continue to use the final normalized database row.

## Testing

Add automated coverage for:

- database fields included in chart rows
- numeric, boolean, and signal normalization
- 80-day warmup gaps
- exact histogram color boundaries
- raw OBV line construction
- buy/sell marker construction
- registry pane assignments and defaults
- existing chart tests and production build remain green
