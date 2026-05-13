# Indicator: Market Breadth MA200 Forward Return Signal Model

## Status

Status: implemented
Implemented commit: uncommitted
TradingView verification: not_applicable
Manual verification: pending

## Purpose

This file specifies the signal model for the existing `% of stocks trading above 200-day moving average` market breadth indicator.

Reference image:

```text
docs/indicators/pictures/percent-over-ma-percentage.jpg
```

The image shows:

- OMXSPI price chart
- `% of stocks trading above 200-day moving average`
- forward average returns after different breadth buckets
- forward win ratios after different breadth buckets

The important insight is counterintuitive:

```text
Very low breadth is not automatically bearish.
When only 0-10% of stocks trade above MA200, historical forward returns are often strong.
This should be treated as a capitulation / washed-out breadth buy setup, not as a sell signal.
```

The signal model must therefore use the current breadth level and historical forward-return bucket statistics to classify market regime and generate deterministic signals.

## Recommended image rename

Current image:

```text
docs/indicators/pictures/percent-over-ma-percentage.jpg
```

Recommended future filename:

```text
docs/indicators/pictures/market-breadth-ma200-forward-return-signal-model.jpg
```

## Indicator category

```text
market_breadth
long_term_breadth
mean_reversion
capitulation
regime_filter
```

Primary timeframe:

```text
daily input
signal evaluated daily
forward model based on 5d, 10d, 1m, 3m, 6m, 12m historical outcomes
```

## Implementation notes

V1 is implemented as a separate daily model layer on top of stored `market_breadth_daily` data.

It does not change the existing breadth accumulator or `market_signal_daily`.

Current v1 design choices:

- input = existing `pct_above_sma200`
- priors = fixed reference-table priors from the image
- output = separate `market_breadth_ma200_forward_return_signal_daily`
- model version = `reference_static_v1`

This keeps the model deterministic and isolated.

An empirical companion layer is now also implemented as a separate daily table:

- input = existing `pct_above_sma200` plus stored `SPY` benchmark history
- output = `market_breadth_ma200_forward_return_empirical_daily`
- model version = `empirical_spy_v2`
- empirical priors are calculated only from history that was already known on each date

This keeps `reference_static_v1` stable while adding a parallel S&P500-native comparison layer without lookahead bias.

## Existing indicator input

The model expects an existing breadth value:

```text
percent_stocks_above_ma200
```

Definition:

```text
percent_stocks_above_ma200 = number_of_stocks_with_close_above_ma200 / number_of_valid_stocks * 100
```

For OMXSPI universe:

```text
close > 200-day moving average
```

If adjusted close exists, use:

```js
adj_close ?? close
```

## Bucket model

Bucket the current breadth percentage into 10 bands.

| Bucket key | Range |
|---|---|
| breadth_90_100 | >=90% and <=100% |
| breadth_80_90 | >=80% and <90% |
| breadth_70_80 | >=70% and <80% |
| breadth_60_70 | >=60% and <70% |
| breadth_50_60 | >=50% and <60% |
| breadth_40_50 | >=40% and <50% |
| breadth_30_40 | >=30% and <40% |
| breadth_20_30 | >=20% and <30% |
| breadth_10_20 | >=10% and <20% |
| breadth_0_10 | >=0% and <10% |

Boundary rule:

```text
100 belongs to 90_100
90 belongs to 90_100
80 belongs to 80_90
...
10 belongs to 10_20
0 belongs to 0_10
```

## Forward return table from reference image

The signal model must store these historical forward return expectations from the image as fixed model priors until recalculated from repo data.

Average forward return by breadth bucket:

| Breadth bucket | Next 5d | Next 10d | Next 1m | Next 3m | Next 6m | Next 12m |
|---|---:|---:|---:|---:|---:|---:|
| breadth_90_100 | 0.11 | 0.28 | 1.44 | 1.86 | 2.00 | 15.20 |
| breadth_80_90 | 0.23 | 0.47 | 0.60 | 4.53 | 9.26 | 14.13 |
| breadth_70_80 | 0.24 | 0.87 | 2.27 | 4.02 | 4.87 | 7.37 |
| breadth_60_70 | 0.23 | 0.20 | 0.48 | 0.75 | 1.18 | 0.52 |
| breadth_50_60 | -0.01 | -0.07 | 0.31 | 0.96 | 2.38 | 6.72 |
| breadth_40_50 | 0.60 | 1.22 | 1.34 | 2.65 | 5.24 | 7.85 |
| breadth_30_40 | -0.55 | -1.14 | -3.07 | -7.19 | -8.63 | -2.55 |
| breadth_20_30 | -1.00 | -2.00 | -3.36 | -8.13 | -6.99 | 1.21 |
| breadth_10_20 | -0.05 | -0.13 | -0.83 | 0.20 | -0.27 | 4.19 |
| breadth_0_10 | 0.59 | 0.88 | 2.27 | 4.27 | 10.90 | 23.65 |

Win ratio by breadth bucket:

| Breadth bucket | Next 5d | Next 10d | Next 1m | Next 3m | Next 6m | Next 12m |
|---|---:|---:|---:|---:|---:|---:|
| breadth_90_100 | 57.61 | 58.70 | 65.22 | 63.59 | 40.22 | 100.00 |
| breadth_80_90 | 38.71 | 43.37 | 41.31 | 54.17 | 61.42 | 60.47 |
| breadth_70_80 | 22.63 | 25.51 | 27.64 | 28.48 | 24.77 | 22.17 |
| breadth_60_70 | 21.31 | 21.19 | 21.76 | 25.77 | 26.58 | 20.16 |
| breadth_50_60 | 16.60 | 16.60 | 19.24 | 23.32 | 23.19 | 21.21 |
| breadth_40_50 | 18.14 | 19.18 | 18.56 | 19.18 | 18.76 | 17.11 |
| breadth_30_40 | 17.17 | 15.06 | 15.66 | 11.75 | 11.75 | 12.95 |
| breadth_20_30 | 31.93 | 28.15 | 26.47 | 18.91 | 24.37 | 39.08 |
| breadth_10_20 | 45.32 | 48.34 | 45.02 | 51.06 | 41.69 | 61.33 |
| breadth_0_10 | 52.15 | 53.59 | 59.81 | 69.86 | 68.42 | 77.99 |

All return values are percentage points.
All win-ratio values are percentages.

## Core interpretation

### Extremely low breadth is bullish contrarian

When breadth is in:

```text
breadth_0_10
```

This is a capitulation/washout signal. Even though market participation is extremely weak, historical forward returns in the reference table are strong, especially:

```text
Next 3m  = 4.27%
Next 6m  = 10.90%
Next 12m = 23.65%
```

The model should therefore output:

```text
CAPITULATION_BUY
```

not sell.

### 10-20% is early recovery / watchlist buy

When breadth is in:

```text
breadth_10_20
```

Short-term returns are weak/flat, but 12m forward return and win ratio are positive. This should be treated as:

```text
EARLY_RECOVERY_WATCH
```

or a cautious long-term accumulation setup.

### 20-40% is danger zone

When breadth is in:

```text
breadth_20_30
breadth_30_40
```

The reference table shows poor forward returns, especially over 1-6 months. This should be treated as the main bearish breadth regime.

Output should be:

```text
NO_NEW_BUYS
REDUCE_RISK
```

depending on slope/confirmation.

### 40-50% is improving / neutral-positive

When breadth is in:

```text
breadth_40_50
```

Forward returns are broadly positive. This is not extreme, but can support long signals if other indicators confirm.

Output:

```text
NEUTRAL_TO_RISK_ON
```

### 50-70% is neutral / maturing

When breadth is in:

```text
breadth_50_60
breadth_60_70
```

Forward returns are mixed/moderate. Use this as neutral.

Output:

```text
NEUTRAL
```

### 70-90% is strong breadth / expansion

When breadth is in:

```text
breadth_70_80
breadth_80_90
```

Market participation is strong. Historical forward returns are positive in several horizons, especially 3-12 months for 80-90%.

Output:

```text
RISK_ON
```

### 90-100% is broad strength but can be stretched

When breadth is in:

```text
breadth_90_100
```

This is broad participation. It can be bullish, but also potentially late-stage/stretched. Use as risk-on unless short-term overextension indicators disagree.

Output:

```text
BROAD_STRENGTH_RISK_ON
```

## Signal outputs

The model should output one of these deterministic signal labels:

```text
CAPITULATION_BUY
EARLY_RECOVERY_WATCH
NO_NEW_BUYS
REDUCE_RISK
NEUTRAL
NEUTRAL_TO_RISK_ON
RISK_ON
BROAD_STRENGTH_RISK_ON
```

Also output a simpler action field:

```text
BUY
WATCH
HOLD
NO_NEW_BUYS
REDUCE_RISK
RISK_ON
```

## Main signal rules

### Rule 1: Capitulation buy

```text
if bucket = breadth_0_10:
  signal = CAPITULATION_BUY
  action = BUY
  confidence = high
  horizon = position_3m_to_12m
```

Reason:

```text
0-10% breadth has strong historical 3m, 6m, and 12m forward returns.
```

### Rule 2: Early recovery watch

```text
if bucket = breadth_10_20:
  signal = EARLY_RECOVERY_WATCH
  action = WATCH
  confidence = medium
  horizon = swing_to_position
```

Upgrade to BUY if breadth slope confirms:

```text
if bucket = breadth_10_20 and breadth_10d_change > 0 and breadth_20d_change > 0:
  signal = EARLY_RECOVERY_BUY
  action = BUY
  confidence = medium
```

### Rule 3: Bearish middle-low zone

```text
if bucket = breadth_20_30:
  signal = REDUCE_RISK
  action = REDUCE_RISK
  confidence = high
```

```text
if bucket = breadth_30_40:
  signal = NO_NEW_BUYS
  action = NO_NEW_BUYS
  confidence = high
```

Upgrade/downgrade using slope:

```text
if bucket in [breadth_20_30, breadth_30_40] and breadth_20d_change < 0:
  action = REDUCE_RISK
```

### Rule 4: Neutral-positive recovery

```text
if bucket = breadth_40_50:
  signal = NEUTRAL_TO_RISK_ON
  action = HOLD
  confidence = medium
```

If slope is positive:

```text
if bucket = breadth_40_50 and breadth_20d_change > 0:
  action = RISK_ON
```

### Rule 5: Neutral middle zone

```text
if bucket in [breadth_50_60, breadth_60_70]:
  signal = NEUTRAL
  action = HOLD
  confidence = medium
```

### Rule 6: Strong breadth / expansion

```text
if bucket in [breadth_70_80, breadth_80_90]:
  signal = RISK_ON
  action = RISK_ON
  confidence = medium_high
```

### Rule 7: Very broad strength

```text
if bucket = breadth_90_100:
  signal = BROAD_STRENGTH_RISK_ON
  action = RISK_ON
  confidence = medium
```

Add stretch warning if slope turns down:

```text
if bucket = breadth_90_100 and breadth_20d_change < 0:
  warning = breadth_stretch_rolling_over
```

## Slope / confirmation fields

Calculate:

```text
breadth_5d_change = current_breadth - breadth_5_trading_days_ago
breadth_10d_change = current_breadth - breadth_10_trading_days_ago
breadth_20d_change = current_breadth - breadth_20_trading_days_ago
breadth_50d_change = current_breadth - breadth_50_trading_days_ago
```

Slope interpretation:

```text
breadth_20d_change > 0 => improving breadth
breadth_20d_change < 0 => deteriorating breadth
```

Do not require positive slope for `CAPITULATION_BUY`. The whole point of the 0-10 bucket is that it can be a buy even when things look extremely weak.

## Expected return model

For each current bucket, attach the historical forward return and win-ratio priors from the tables.

Output fields:

```text
expected_return_5d
expected_return_10d
expected_return_1m
expected_return_3m
expected_return_6m
expected_return_12m
win_ratio_5d
win_ratio_10d
win_ratio_1m
win_ratio_3m
win_ratio_6m
win_ratio_12m
```

Example if current breadth = 8.5:

```text
bucket = breadth_0_10
expected_return_3m = 4.27
expected_return_6m = 10.90
expected_return_12m = 23.65
win_ratio_3m = 69.86
win_ratio_6m = 68.42
win_ratio_12m = 77.99
signal = CAPITULATION_BUY
action = BUY
```

## Confidence model

Base confidence on the strongest horizon for the signal type.

For capitulation:

```text
primary_horizon = 6m_to_12m
```

Confidence:

```text
if expected_return_6m >= 8 and win_ratio_6m >= 60: confidence = high
if expected_return_3m >= 2 and win_ratio_3m >= 55: confidence = medium_high
if expected_return_1m > 0 and win_ratio_1m >= 50: confidence = medium
else confidence = low
```

For risk-reduction buckets:

```text
if expected_return_3m < -5 or expected_return_6m < -5: confidence = high
if expected_return_1m < -2: confidence = medium_high
else confidence = medium
```

## Recommended database fields

If the existing indicator table already has breadth fields, add only missing columns.

Suggested fields:

```text
ma200_breadth_pct
ma200_breadth_bucket
ma200_breadth_5d_change
ma200_breadth_10d_change
ma200_breadth_20d_change
ma200_breadth_50d_change
ma200_breadth_signal
ma200_breadth_action
ma200_breadth_confidence
ma200_breadth_warning
ma200_expected_return_5d
ma200_expected_return_10d
ma200_expected_return_1m
ma200_expected_return_3m
ma200_expected_return_6m
ma200_expected_return_12m
ma200_win_ratio_5d
ma200_win_ratio_10d
ma200_win_ratio_1m
ma200_win_ratio_3m
ma200_win_ratio_6m
ma200_win_ratio_12m
ma200_forward_model_version
```

## Suggested output JSON

```json
{
  "date": "2022-04-26",
  "ma200_breadth_pct": 20.1,
  "bucket": "breadth_20_30",
  "breadth_20d_change": -12.4,
  "signal": "REDUCE_RISK",
  "action": "REDUCE_RISK",
  "confidence": "high",
  "expected_returns": {
    "5d": -1.00,
    "10d": -2.00,
    "1m": -3.36,
    "3m": -8.13,
    "6m": -6.99,
    "12m": 1.21
  },
  "win_ratios": {
    "5d": 31.93,
    "10d": 28.15,
    "1m": 26.47,
    "3m": 18.91,
    "6m": 24.37,
    "12m": 39.08
  }
}
```

## Important behavior examples

### Example A: Extremely low breadth

```text
ma200_breadth_pct = 7.5
bucket = breadth_0_10
signal = CAPITULATION_BUY
action = BUY
```

Even though only 7.5% of stocks are above MA200, this is treated as a contrarian buy setup because historical forward 6m and 12m returns are strong.

### Example B: Weak but not washed-out breadth

```text
ma200_breadth_pct = 25.0
bucket = breadth_20_30
signal = REDUCE_RISK
action = REDUCE_RISK
```

This is worse than 0-10% because the historical table shows poor 1m, 3m, and 6m forward returns.

### Example C: Strong broad participation

```text
ma200_breadth_pct = 85.0
bucket = breadth_80_90
signal = RISK_ON
action = RISK_ON
```

### Example D: Very strong but rolling over

```text
ma200_breadth_pct = 92.0
breadth_20d_change = -8.0
bucket = breadth_90_100
signal = BROAD_STRENGTH_RISK_ON
action = RISK_ON
warning = breadth_stretch_rolling_over
```

## Implementation architecture

Create a separate signal-model module, or extend the existing MA200 breadth indicator module if it already exists.

Preferred new module:

```text
lib/indicators/market-breadth-ma200-forward-return-model.ts
```

Expected exported functions:

```ts
export function bucketMa200Breadth(percent: number): Ma200BreadthBucket
export function getMa200BreadthForwardStats(bucket: Ma200BreadthBucket): Ma200BreadthForwardStats
export function calculateMa200BreadthSlope(history: BreadthObservation[]): Ma200BreadthSlope
export function classifyMa200BreadthSignal(input: Ma200BreadthSignalInput): Ma200BreadthSignalResult
```

Add tests:

```text
tests/indicators/market-breadth-ma200-forward-return-model.test.ts
```

## Acceptance tests

Codex must add tests for:

1. Bucket assignment for 0, 9.99, 10, 19.99, 20, 89.99, 90, 100.
2. 0-10 bucket returns `CAPITULATION_BUY` and `BUY`.
3. 10-20 bucket returns `EARLY_RECOVERY_WATCH`.
4. 20-30 bucket returns `REDUCE_RISK`.
5. 30-40 bucket returns `NO_NEW_BUYS`.
6. 40-50 bucket returns `NEUTRAL_TO_RISK_ON`.
7. 70-90 buckets return `RISK_ON`.
8. 90-100 bucket returns `BROAD_STRENGTH_RISK_ON`.
9. Forward return priors match the reference table.
10. Win-ratio priors match the reference table.
11. Positive slope upgrades 10-20 to buy.
12. Negative slope in 20-40 keeps/reinforces risk reduction.
13. 0-10 does not require positive slope to be BUY.

## Do not do in Phase 1

- Do not treat low breadth automatically as bearish.
- Do not make 0-10 a sell signal.
- Do not ignore the historical forward return/win-ratio table.
- Do not add Telegram behavior yet.
- Do not alter the existing stock data-fetching pipeline.
- Do not hard-code the current chart value only; hard-code only the model priors from the reference table until recalculated from repo history.

## Codex task prompt

```text
Implement the Market Breadth MA200 Forward Return Signal Model described in docs/indicators/market-breadth-ma200-forward-return-signal-model.md.

Use the existing percent of stocks above MA200 breadth indicator as input. Add a deterministic signal model based on the bucketed historical forward return and win-ratio table from the reference image.

The most important rule: breadth_0_10 is a CAPITULATION_BUY / BUY setup despite extremely weak breadth, because historical forward 3m/6m/12m returns are strong. Do not classify 0-10 as bearish.

Implement bucket assignment, forward-return priors, win-ratio priors, slope fields, signal classification, action classification, confidence, and warning logic.

Add tests for all bucket boundaries and all signal mappings. Add database fields/migration only if needed. Do not add Telegram behavior. Do not change the existing stock data-fetching pipeline.

When done, update this file status to implemented and include the implementation commit.
```

## Manual verification

After implementation, verify:

```text
Date:
Current breadth %:
Bucket:
Expected return 3m:
Expected return 6m:
Expected return 12m:
Win ratio 3m:
Win ratio 6m:
Win ratio 12m:
Signal:
Action:
Result:
```

Also visually compare the model table to:

```text
docs/indicators/pictures/percent-over-ma-percentage.jpg
```
