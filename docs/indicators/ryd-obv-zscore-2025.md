# Indicator: RYD OBV Z-Scores with Signals 2025

## Status

Status: planned
Implemented commit: TBD
TradingView verification: pending

## Purpose

This indicator recreates the user's TradingView OBV Z-score signal.

It calculates OBV, normalizes OBV as a Z-score over an 80-day lookback, and creates buy/sell raw signals when the Z-score crosses the configured extreme levels.

Likely category/timeframe:

```text
category: momentum
timeframe: short_to_medium_term
future telegram channel: momentum-signals
```

Do not implement Telegram routing yet.

## Source price rule for this repo

Use the same signal rules as the TradingView code, but use this repo's default adjusted source price:

```js
adj_close ?? close
```

That means:

- use `row.adj_close` when available
- otherwise use `row.close`
- use this source price for OBV direction comparisons

## Original TradingView/Pine Script code

```pinescript
//@version=4
study("RYD OBV Z-Scores with Signals 2025", overlay=false)

src = input(close, title="Source")
lookback = input(80, title="LookBack Length", minval=1)
upper0 = input(1.25, title="First Upper Bound", type=input.float)
upper1 = input(2.70, title="Second Upper Bound", type=input.float)
upperExtreme = input(6.0, title="Extreme Upper Bound (for Outliers)", type=input.float)
lower0 = input(-1.25, title="First Lower Bound", type=input.float)
lower1 = input(-2.70, title="Second Lower Bound", type=input.float)
lowerExtreme = input(-6.0, title="Extreme Lower Bound (for Outliers)", type=input.float)
colorBars = input(false, title="Color Price Bars Based on OBV?")

// Function that returns the Z-Score of the current OBV Value.
getZ(o, l) =>
    mean = sum(o, l) / l
    stDev = stdev(o, l)
    z = (o - mean) / stDev

// OBV Calculation.
obv = 0.0
obv := (src == src[1]) ? nz(obv[1]) : (src < src[1]) ? nz(obv[1]) - volume : nz(obv[1]) + volume

zScore = getZ(obv, lookback)

zColor = zScore >= upper1 ? color.rgb(255, 251, 0) : zScore <= -2.70 ? color.rgb(255, 251, 0) : zScore > 1.25 ? color.green : zScore >= -1.25 and zScore <= 1.25 ? color.gray : zScore < -1.25 ? color.red : color.fuchsia
plot(zScore, color=zColor, style=plot.style_histogram, linewidth=3, transp=0)
h0 = hline(upper0, color=color.rgb(136, 136, 136), linestyle=hline.style_dashed)
h1 = hline(upper1,  color=color.rgb(136, 136, 136), linestyle=hline.style_solid)
h2 = hline(upperExtreme,  color=color.rgb(136, 136, 136), linestyle=hline.style_solid)
m0 = hline(0, color=color.white, linestyle=hline.style_solid)
l0 = hline(lower0,  color=color.rgb(136, 136, 136), linestyle=hline.style_dashed)
l1 = hline(lower1,  color=color.rgb(136, 136, 136), linestyle=hline.style_solid)
l2 = hline(lowerExtreme,  color=color.rgb(136, 136, 136), linestyle=hline.style_solid)

// Signal generation for Buy when Z-Score crosses down through -2.7
buySignalCondition = crossover(zScore, -2.7)
plotshape(series=buySignalCondition, title="Buy Signal", location=location.bottom, color=color.rgb(52, 255, 86), style=shape.triangleup, size=size.small)

// Signal generation for Sell when Z-Score crosses below 2.7
sellSignalCondition = crossunder(zScore, 2.7)
plotshape(series=sellSignalCondition, title="Sell Signal (Cross Below 2.7)", location=location.top, color=color.rgb(255, 62, 62), style=shape.triangledown, size=size.small)

barcolor(colorBars ? zColor : na)
```

## Exact rules to implement

### Parameters

```text
lookback = 80
upper0 = 1.25
upper1 = 2.70
upperExtreme = 6.0
lower0 = -1.25
lower1 = -2.70
lowerExtreme = -6.0
```

### OBV

OBV starts at `0` for the first row of each ticker.

For each later row:

```text
if source == previous source: OBV = previous OBV
if source < previous source: OBV = previous OBV - volume
if source > previous source: OBV = previous OBV + volume
```

Source in this repo:

```js
adj_close ?? close
```

### Z-score

For each row after enough warmup:

```text
mean = sum(last 80 OBV values) / 80
stDev = stdev(last 80 OBV values)
zScore = (current OBV - mean) / stDev
```

Before 80 OBV values exist, `ryd_obv_zscore_80` should be `null`.

If stdev is zero, `ryd_obv_zscore_80` should be `null`.

### Buy signal

TradingView rule:

```pinescript
crossover(zScore, -2.7)
```

Repo implementation:

```text
previous zScore <= -2.7 AND current zScore > -2.7
```

### Sell signal

TradingView rule:

```pinescript
crossunder(zScore, 2.7)
```

Repo implementation:

```text
previous zScore >= 2.7 AND current zScore < 2.7
```

## Fields to store

Add raw indicator fields to `stock_daily_indicators`:

```text
ryd_obv
ryd_obv_zscore_80
ryd_obv_buy_signal
ryd_obv_sell_signal
ryd_obv_signal
```

Recommended values:

```text
ryd_obv_signal = buy | sell | none
```

## Codex task prompt

```text
Implement the indicator described in docs/indicators/ryd-obv-zscore-2025.md.

Important:
- Implement it as a separate module under lib/indicators/.
- Preserve the OBV, Z-score, crossover, and crossunder rules exactly as described in the doc.
- Use adj_close ?? close as the source price.
- Store raw values and raw signal fields in stock_daily_indicators.
- Add a SQL migration for the new fields.
- Add tests for OBV calculation, Z-score warmup, buy crossover, and sell crossunder.
- Integrate it into calculate:daily.
- Do not add Telegram behavior yet.
- Do not add backtest logic unless explicitly requested.
- Do not change the data-fetching pipeline.

When done:
1. Update this doc's status to implemented.
2. Add the implementation commit hash.
3. Ask the user to verify at least one signal date/value against TradingView.
```

## Manual TradingView verification

After implementation, verify at least one ticker/date against TradingView.

```text
Ticker:
Date:
TradingView zScore:
Repo zScore:
TradingView signal:
Repo signal:
Result:
```

Do not mark this indicator as `user_verified` until the user confirms the comparison.
