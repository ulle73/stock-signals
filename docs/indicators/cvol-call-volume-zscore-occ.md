# Indicator: CVOL Call Volume Z-Score via OCC

## Status

Status: planned
Implemented commit: TBD
TradingView verification: pending
OCC data verification: pending

## Purpose

This indicator replaces the TradingView symbol `USI:CVOL` with an OCC daily options volume endpoint.

In the original TradingView script, `USI:CVOL` is used as `CALL VOLUME` and drives several sell/risk-warning signals when call volume becomes extreme.

In this repo, `USI:CVOL` should be approximated by OCC daily total call volume:

```text
OCC endpoint → entity.total_volume where exchange = "Total" → calls
```

Likely category/timeframe:

```text
category: risk / options_volume
timeframe: short_to_medium_term
future telegram channel: risk-signals or momentum-signals
```

Do not implement Telegram routing yet.

## Data source

Use this endpoint:

```text
https://marketdata.theocc.com/mdapi/daily-volume-totals?report_date=YYYY-MM-DD
```

Example:

```text
https://marketdata.theocc.com/mdapi/daily-volume-totals?report_date=2026-04-17
```

Expected response shape includes:

```json
{
  "statusType": "OK",
  "entity": {
    "total_volume": [
      {
        "exchange": "Total",
        "calls": 61722200,
        "puts": 37959098,
        "ratio": 0.61,
        "volume": 99681298,
        "market_share": 100
      }
    ]
  }
}
```

For this indicator:

```text
USI:CVOL ≈ entity.total_volume row where exchange = "Total" → calls
```

Example value for `2026-04-17`:

```text
calls = 61,722,200
```

Also store `puts`, `ratio`, and `volume` for future indicators.

## Data pipeline note

This indicator requires a new external daily series because OCC data is not part of the existing Yahoo/FRED/S&P 500 pipeline.

Do not rewrite the existing fetch pipeline.

Implement the smallest possible separate OCC fetch module/script/repository needed to store this daily series.

Recommended approach:

```text
lib/sources/occ.js
lib/repositories/occ-volume-totals.js
scripts/fetch-occ-volume-totals.js
```

or, preferably, a generic external series table if that fits the current schema direction.

The existing `fetch:daily` pipeline should remain untouched unless explicitly approved.

## Suggested database fields

Because this data is external market-wide daily data, prefer a dedicated table instead of adding it to `stock_daily_indicators`.

Recommended table:

```text
occ_daily_volume_totals
```

Recommended columns:

```text
id
report_date
exchange
calls
puts
ratio
volume
market_share
source
created_at
updated_at
unique(report_date, exchange)
```

For the CVOL replacement, use:

```text
exchange = "Total"
cvol_calls = calls
```

The indicator calculation can then output/store derived signal rows separately later, or use raw OCC rows directly when building signal events.

If the project already has a generic external daily series table by the time this is implemented, use that instead, but still preserve these values:

```text
calls
puts
ratio
volume
market_share
```

## Original TradingView/Pine Script code

This is the original `USI:CVOL` block from the combined TradingView indicator.

```pinescript
// Hämta historiska data för aktien
S_symbol = "USI:CVOL"
S_price = request.security(S_symbol, "D", close)

// Funktion för att beräkna z-score
S_zscore(S_src, S_length) =>
    S_mean = ta.sma(S_src, S_length)
    S_stdev = ta.stdev(S_src, S_length)
    S_zscore = (S_src - S_mean) / S_stdev

// Använd z-score funktionen för tre olika periodinställningar
S_length_1 = input(20, title="Z-Score Length 2.25")
S_length_2 = input(15, title="Z-Score Length 3")
S_length_3 = input(10, title="Z-Score Length 4")

S_z_score_1 = S_zscore(S_price, S_length_1)
S_z_score_2 = S_zscore(S_price, S_length_2)
S_z_score_3 = S_zscore(S_price, S_length_3)

// Ange ett villkor för att CVOLE måste vara över 30000000 och föregående två dagar över 20000000 respektive 10000000
S_price_condition = S_price > 30000000 and S_price[1] > 20000000 and S_price[2] > 10000000

// Skapa säljsignaler för varje z-score och periodinställning
S_sell_signal_1 = S_z_score_1 > 1.5 and S_price_condition
S_sell_signal_2 = S_z_score_2 > 2.5 and S_price_condition
S_sell_signal_3 = S_z_score_3 > 3 and S_price_condition

// Markera säljsignaler med olika färger och former (triangel nedåt)
plotshape(S_sell_signal_1, color=color.rgb(0, 4, 255), style=shape.triangledown, location=location.abovebar, size=size.small)
plotshape(S_sell_signal_2, color=color.rgb(0, 4, 255), style=shape.triangledown, location=location.abovebar, size=size.small)
plotshape(S_sell_signal_3, color=color.rgb(0, 4, 255), style=shape.triangledown, location=location.abovebar, size=size.small)
```

## Exact rules to implement

### Source replacement

Replace:

```text
USI:CVOL close
```

with:

```text
OCC total call volume = entity.total_volume[exchange = "Total"].calls
```

### Values to store from OCC

For each `report_date`, store the `Total` row:

```text
calls
puts
ratio
volume
market_share
```

### Z-score calculations

Use `calls` as `S_price`.

Calculate three Z-scores:

```text
S_z_score_1 = zscore(calls, 20)
S_z_score_2 = zscore(calls, 15)
S_z_score_3 = zscore(calls, 10)
```

Formula:

```text
mean = sma(calls, length)
stdev = stdev(calls, length)
zscore = (calls - mean) / stdev
```

Before enough lookback exists, z-score should be `null`.

If stdev is zero, z-score should be `null`.

### Price/volume condition

Original TradingView condition:

```pinescript
S_price_condition = S_price > 30000000 and S_price[1] > 20000000 and S_price[2] > 10000000
```

Repo implementation:

```text
today calls > 30,000,000
previous trading/report row calls > 20,000,000
two rows ago calls > 10,000,000
```

Use previous stored OCC report rows, not calendar days, because weekends/holidays may not have data.

### Sell signals

```text
cvol_sell_signal_1 = zscore_20 > 1.5 AND price_condition
cvol_sell_signal_2 = zscore_15 > 2.5 AND price_condition
cvol_sell_signal_3 = zscore_10 > 3.0 AND price_condition
```

These are raw sell/risk-warning signals.

Do not route them to Telegram yet.

## Suggested derived fields

If storing derived indicator values in a separate derived table or future signal layer, use names like:

```text
cvol_calls
cvol_puts
cvol_ratio
cvol_total_volume
cvol_zscore_20
cvol_zscore_15
cvol_zscore_10
cvol_price_condition
cvol_sell_signal_1
cvol_sell_signal_2
cvol_sell_signal_3
cvol_signal
```

Recommended `cvol_signal` values:

```text
none
sell_z20_gt_1_5
sell_z15_gt_2_5
sell_z10_gt_3
multiple_sell_signals
```

## Codex task prompt

```text
Implement the indicator/data intake described in docs/indicators/cvol-call-volume-zscore-occ.md.

Important:
- This replaces TradingView USI:CVOL using OCC daily volume totals.
- Fetch OCC data from:
  https://marketdata.theocc.com/mdapi/daily-volume-totals?report_date=YYYY-MM-DD
- Use entity.total_volume where exchange = "Total".
- Use calls as the CVOL replacement value.
- Also store puts, ratio, total volume, and market_share for future use.
- Add the smallest possible separate OCC data fetch/storage path.
- Do not rewrite the existing Yahoo/FRED/S&P 500 fetch pipeline.
- Do not add Telegram behavior yet.
- Do not add backtest logic unless explicitly requested.

Implement:
1. OCC source parser/fetcher for one report_date.
2. Database migration for OCC daily volume totals or an approved generic external daily series table.
3. Repository upsert function with unique(report_date, exchange).
4. Script or integration to fetch OCC data by date/date range.
5. Derived z-score calculation using calls for lengths 20, 15, and 10.
6. Raw sell signal fields matching the TradingView rules.
7. Tests for:
   - parsing the Total row
   - saving calls/puts/ratio/volume/market_share
   - z-score warmup
   - price_condition using previous stored rows
   - sell_signal_1, sell_signal_2, sell_signal_3

When done:
1. Update this doc's status to implemented.
2. Add the implementation commit hash.
3. Ask the user to verify at least one date against OCC and one signal date/value against TradingView.
```

## Manual OCC verification

Verify the raw OCC value first.

```text
Date: 2026-04-17
Endpoint: https://marketdata.theocc.com/mdapi/daily-volume-totals?report_date=2026-04-17
Expected exchange: Total
Expected calls: 61722200
Expected puts: 37959098
Expected ratio: 0.61
Expected volume: 99681298
Repo calls:
Repo puts:
Repo ratio:
Repo volume:
Result:
```

## Manual TradingView verification

After implementation, verify at least one signal/value against TradingView's `USI:CVOL` if available.

Because this repo uses OCC as an approximation/replacement source, small differences against TradingView are possible if TradingView's `USI:CVOL` uses a different vendor or adjustment method.

```text
Ticker/source in TradingView: USI:CVOL
Date:
TradingView CVOL close:
OCC calls:
TradingView zscore 20:
Repo zscore 20:
TradingView zscore 15:
Repo zscore 15:
TradingView zscore 10:
Repo zscore 10:
TradingView signal:
Repo signal:
Result:
```

Do not mark this indicator as `user_verified` until the user confirms the comparison.
