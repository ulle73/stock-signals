# Chart Overlay Indicators Design

## Goal

Extend the professional `/chart` workspace with four existing or approved overlay indicators from the user's TradingView master chart. Implement them in a fixed order, with one isolated commit and push per indicator so any individual indicator can be reverted without removing the others.

Implementation order:

1. TF Sync
2. PLCE / PUT Volume Extremes
3. CVOL extreme call volume
4. 2Y + 10Y Yield

The chart must remain descriptive. It must not add entries, stops, targets, position sizing, or advice.

## Branch and commit isolation

Branch: `codex/chart-overlay-indicators-v1`

Each indicator is a self-contained vertical slice containing:

- chart-data repository fields or a dedicated market-wide repository join
- normalization
- pure marker transformation module
- chart toggle/registry definition
- Lightweight Charts series/markers
- focused tests
- one production commit and push

Required production commit sequence:

1. `feat(chart): add TF Sync markers`
2. `feat(chart): add PLCE volume-extreme markers`
3. `feat(chart): add CVOL call-volume markers`
4. `feat(chart): add 2Y 10Y yield markers`

Documentation or temporary CI commits may exist separately, but no production commit may combine two indicators.

## Shared rendering architecture

Price-overlay markers must not be attached directly to the candlestick series when that would make symbols touch candles. Each indicator gets an invisible price-anchored series with explicit numeric anchor values and a configurable ATR/range-based visual gap.

Marker helpers are pure modules under `lib/chart/` and return:

- anchor points by date
- Lightweight Charts marker definitions
- availability metadata

All marker series:

- use pane 0
- hide price lines, crosshair dots, titles, and last-value badges
- share the chart time scale
- render only when the indicator toggle is active
- skip dates with no valid stored signal
- never invent or forward-fill a signal

The toolbar adds a separate `Signaler` group. Each indicator has an independent toggle and disabled state when no data exists in the selected period.

Default visibility:

- TF Sync: on
- PLCE / PUT Volume Extremes: on
- CVOL: on
- 2Y + 10Y Yield: on

This matches the supplied TradingView master-chart behavior. Users can hide any layer independently.

## 1. TF Sync

### Existing data

Use the already stored per-ticker fields from `stock_daily_indicators`:

- `tf_sync_buy_signal`
- `tf_sync_sell_signal`
- `tf_sync_buy_active`
- `tf_sync_sell_active`
- `tf_sync_signal`

The calculation remains unchanged. A signal is generated only when daily, weekly-derived, and latest stored 60-minute candle direction align and the active state changes.

### Visual treatment

Match the TradingView reference at the top of the main price pane:

- buy signal: small bright-green downward triangle in a fixed top marker lane
- sell signal: small bright-red downward triangle in the same top marker lane

The marker lane is anchored above the highest visible price for each signal date using the candle high plus a volatility-aware gap. Both colors point downward, matching the user's row of red and green triangles at the top of the chart.

The markers must not overlap the price candles or right price scale labels.

### Data scope

TF Sync is ticker-specific. It follows the selected ticker and chart period.

## 2. PLCE / PUT Volume Extremes

### Existing data

Use the stored market-wide PLCE threshold signal derived from FINRA short volume:

- `plce_threshold_value`
- `plce_threshold_buy_signal`
- `plce_threshold_signal`

The current production rule remains unchanged:

- signal when PLCE short volume is greater than 3,000,000

No recalculation occurs in the browser.

### Visual treatment

Match the supplied TradingView chart:

- large saturated-blue upward triangle
- placed below the price candle with a guaranteed air gap
- larger than TF Sync and normal chart markers

The marker is shown on all ticker charts because the source is a market-wide external risk/volume overlay in the original master indicator.

The toolbar label is `PUT volym extrem`.

## 3. CVOL extreme call volume

### Existing data

Use the existing OCC-derived CVOL daily indicator layer:

- `cvol_sell_signal_1`
- `cvol_sell_signal_2`
- `cvol_sell_signal_3`
- `cvol_signal`

The existing thresholds and OCC calculations remain unchanged.

### Visual treatment

Match the original TradingView code:

- blue downward triangle above price
- one rendered marker per date, even when multiple CVOL thresholds trigger simultaneously
- marker size can increase one step when `multiple_sell_signals` is stored
- guaranteed gap above the candle high

The marker is market-wide and therefore appears on all selected ticker charts for matching dates.

The toolbar label is `CVOL extrem`.

## 4. 2Y + 10Y Yield

### Existing source and missing production layer

The original Pine logic uses:

- US 2-year Treasury yield
- US 10-year Treasury yield
- effective federal funds rate
- prior values and a state machine (`isLong`, `isShort`, `isInverted`)

The repo documents FRED series for 2Y and 10Y yields. The implementation must first verify the existing stored series IDs and availability for:

- DGS2
- DGS10
- FEDFUNDS or the repo's approved equivalent

If any required series is not stored and refreshed in production, this indicator's commit must add the smallest isolated fetch/storage integration needed. It must not alter unrelated macro pipelines.

### Signal logic

Port the stored Pine rules exactly, including state transitions:

- `FRR2_10 = (5 * TenYear - TwoYear) / (4 * TenYear)`
- inverted state when `FRR2_10 < 1`
- buy when not long, `FRR2_10 > 1.10`, smoothed EFFR falls below current EFFR after previously being at or above it
- sell when not short, the system was inverted, and `FRR2_10 > 1.005`

The implementation must be deterministic over sorted daily rows and store derived daily signal rows. It must not calculate state only inside the browser.

### Visual treatment

Match the TradingView reference:

- buy: very large white upward triangle below price
- sell: very large white downward triangle above price
- guaranteed air gap from candles
- visually larger than PLCE markers

The toolbar label is `2Y + 10Y`.

## Marker placement and collision rules

Each marker layer uses a dedicated vertical offset tier so simultaneous signals remain readable:

- TF Sync top lane: highest fixed tier
- CVOL above-price tier: close to price but outside candle high
- 2Y + 10Y above-price sell tier: farther above CVOL
- PLCE below-price tier: close below price but outside candle low
- 2Y + 10Y below-price buy tier: farther below PLCE

Offsets use a bounded daily range/ATR-like value derived from existing chart OHLC rows. If the daily range is zero or missing, use a percentage of adjusted close. The marker anchor logic is deterministic and unit tested.

No marker may touch a candle or another marker from the same date. When several same-side markers occur, their tiers remain fixed rather than being dynamically reordered.

## API and data contracts

Ticker-specific fields may be selected directly through the chart query's `stock_daily_indicators` join.

Market-wide indicators must be joined by date through isolated repository helpers. The resulting normalized chart bar may include:

```text
tf_sync_buy_signal
tf_sync_sell_signal
tf_sync_signal
plce_threshold_value
plce_threshold_buy_signal
plce_threshold_signal
cvol_sell_signal_1
cvol_sell_signal_2
cvol_sell_signal_3
cvol_signal
yield_2y_10y_buy_signal
yield_2y_10y_sell_signal
yield_2y_10y_signal
```

Missing market-wide dates produce null/false values and do not block price rendering.

## Controls and legend

The toolbar gains a compact `Signaler` group with four toggles.

The crosshair legend shows only concise event labels on dates where a marker is present:

- `TF Sync: Grön` or `TF Sync: Röd`
- `PUT volym extrem`
- `CVOL extrem`
- `2Y + 10Y: Köp` or `2Y + 10Y: Sälj`

These are event descriptions, not recommendations.

## Error handling

- A missing optional indicator table or empty period must not crash `/chart`.
- Ticker price and RYD OBV remain renderable if any new overlay has no data.
- SQL joins remain parameterized.
- Market-wide repository failures are logged and represented as unavailable overlays rather than fabricated data.
- The 2Y + 10Y layer must fail closed when source coverage is incomplete.

## Testing and verification

Each indicator commit must independently pass:

- focused marker transformation tests
- chart normalization tests
- repository/query contract tests
- full Node test suite
- Next.js production build

Additional required checks:

- exact colors, shape directions, sizes, and default visibility
- no duplicate CVOL marker on multi-trigger dates
- deterministic marker tier placement
- no last-value/name badges from invisible marker series
- toggle state does not recreate or corrupt the price chart
- missing indicator data does not affect candles, MA, volume, or RYD OBV

After each production commit is pushed, record its SHA before starting the next indicator. This provides a known reset point for every stage.
