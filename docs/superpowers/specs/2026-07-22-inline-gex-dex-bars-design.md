# Inline GEX/DEX Chart Bars Design

## Goal

Render the latest GEX and DEX per-strike exposure directly inside the main Lightweight Charts price pane so the rows stay vertically aligned with the chart price scale during vertical zoom, price-scale drag, resize, ticker changes, and period changes.

## Approved layout

- GEX is drawn from the left edge of the main price pane and grows inward.
- DEX is drawn from the right edge of the main price pane and grows inward.
- Each side may occupy at most 30% of the pane width.
- Bars use independent absolute-value scales for GEX and DEX so both remain readable.
- Positive values are green; negative values are red.
- Only strike rows whose `priceSeries.priceToCoordinate(strike)` result lies inside the main pane are rendered.
- Strike labels and compact values are rendered near their respective chart edges.
- Spot and key-level badges remain in the existing options-positioning panel; this branch adds the inline overlay without removing the panel so the user can compare both designs.

## Architecture

Create an isolated Lightweight Charts series primitive attached to the candlestick series. The primitive receives normalized strike rows and uses the attached series API to convert every strike price to a live Y coordinate. Its pane renderer draws the bars using media-coordinate canvas dimensions, which makes the overlay follow the chart's current price scale without synchronizing a separate DOM chart.

The strike endpoint remains `/api/gex-dex-strikes`. `ChartWorkspace` owns the single strike request and passes the payload to both `FinancialChart` and `OptionsLadder`, eliminating duplicate requests. Strike failures remain fail-open: the price chart still works and the inline overlay simply renders nothing.

## Components

- `lib/chart/gex-dex-inline-bars.js`: pure normalization, scaling and geometry helpers plus the primitive implementation.
- `app/chart/chart-workspace.js`: fetches strike data once per ticker and passes it to both consumers.
- `app/chart/financial-chart.js`: attaches/detaches the primitive to the price series.
- `app/chart/options-ladder.js`: accepts an optional preloaded strike payload and keeps its existing internal fetch only as a backward-compatible fallback.
- `tests/gex-dex-inline-bars.test.js`: verifies 30% caps, independent scaling, direction, and visible-price filtering contract.

## Rendering details

- Maximum bar width: `paneWidth * 0.30` per side.
- Reserved edge label width is included inside each 30% zone.
- Minimum visible bar width for non-zero values: 2 px.
- GEX origin: left edge after strike label; bars extend right.
- DEX origin: right edge before strike/value label; bars extend left.
- Rows use 5 px bars with low opacity so candles remain dominant.
- The primitive uses z-order `bottom` so bars sit above the pane background/grid but below candles and crosshair.
- The primitive does not contribute autoscale information; options strikes never compress the candlestick scale.

## Error handling

Invalid strikes and non-finite exposures are ignored. Missing or empty strike payloads detach or clear the primitive. The existing chart and Options Positioning empty/error states remain unchanged.

## Acceptance criteria

1. On vertical zoom or price-scale dragging, every rendered strike bar remains aligned with its strike price.
2. On chart resize, neither GEX nor DEX exceeds 30% of the current pane width.
3. GEX appears on the left and DEX on the right.
4. Positive and negative exposures remain visually distinct.
5. Horizontal time scrolling does not move the edge overlays horizontally.
6. No database, provider, migration, indicator, or existing GEX/DEX level-line behavior changes.
7. The branch is pushed but not merged to `main`.