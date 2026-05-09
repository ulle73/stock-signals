# Indicator: PLCE Short Volume Z-Score via FINRA

## Status

Status: implemented
Implemented commit: uncommitted
TradingView verification: pending
FINRA data verification: pending

## Purpose

This indicator replaces the TradingView symbol:

```text
FINRA:PLCE_SHORT_VOLUME
```

with FINRA's official daily short sale volume file.

The original TradingView script uses `FINRA:PLCE_SHORT_VOLUME` as a daily series and creates buy/raw accumulation signals when PLCE short volume becomes extreme.

Likely category/timeframe:

```text
category: short_volume / options_proxy / contrarian_buy
timeframe: short_to_medium_term
future telegram channel: momentum-signals or risk-signals
```

Do not implement Telegram routing yet.

## Data source

Use FINRA's daily Reg SHO short sale volume file:

```text
https://cdn.finra.org/equity/regsho/daily/CNMSshvolYYYYMMDD.txt
```

Example for 2026-04-13:

```text
https://cdn.finra.org/equity/regsho/daily/CNMSshvol20260413.txt
```

The file format is pipe-delimited:

```text
Date|Symbol|ShortVolume|ShortExemptVolume|TotalVolume|Market
```

Important:

Do not sum all rows.

Use the row where:

```text
Symbol = PLCE
```

Then use:

```text
ShortVolume
```

as the replacement value for:

```text
FINRA:PLCE_SHORT_VOLUME
```

## User-verified lookup command

PowerShell example:

```powershell
$date = "20260413"
$symbol = "PLCE"
$url = "https://cdn.finra.org/equity/regsho/daily/CNMSshvol$date.txt"

$data = curl.exe -L $url -H "User-Agent: Mozilla/5.0"

$line = $data | Where-Object { $_ -match "^\d{8}\|$symbol\|" } | Select-Object -First 1

$line
```

Expected line shape:

```text
20260413|PLCE|ShortVolume|ShortExemptVolume|TotalVolume|Market
```

Mapping:

```text
Date              -> date
Symbol            -> symbol
ShortVolume       -> short_volume  ← this is FINRA:PLCE_SHORT_VOLUME replacement value
ShortExemptVolume -> short_exempt_volume
TotalVolume       -> total_volume
Market            -> market
```

## Data pipeline note

This indicator requires a new external FINRA data source because `FINRA:PLCE_SHORT_VOLUME` is not part of the existing Yahoo/FRED/S&P 500 pipeline.

Do not rewrite the existing data-fetching pipeline.

Implement the smallest possible separate FINRA fetch/storage path.

Recommended approach:

```text
lib/sources/finra-short-volume.js
lib/repositories/finra-short-volume.js
scripts/fetch-finra-short-volume.js
```

The existing `fetch:daily` pipeline should remain untouched unless explicitly approved.

## Suggested database table

Because this is external daily symbol-level data, prefer a dedicated table:

```text
finra_daily_short_volume
```

Recommended columns:

```text
id
date
symbol
short_volume
short_exempt_volume
total_volume
market
source
created_at
updated_at
unique(date, symbol)
```

For this indicator, filter/use:

```text
symbol = PLCE
short_volume = FINRA:PLCE_SHORT_VOLUME replacement value
```

## Original TradingView/Pine Script code

This is the original active PLCE short-volume block from the combined TradingView indicator.

```pinescript
// // Hämta historiska data för aktien


A_symbol = "FINRA:PLCE_SHORT_VOLUME"

A_price = request.security(A_symbol, "D", close)

// Funktion för att beräkna z-score
A_zscore(A_src, A_length) =>
    A_mean = ta.sma(A_src, A_length)
    A_stdev = ta.stdev(A_src, A_length)
    A_zscore = (A_src - A_mean) / A_stdev

// Använd z-score funktionen för tre olika periodinställningar
//A_length_1 = input(20, title="Z-Score Length 2.25")
A_length_2 = input(50, title="Z-Score Length 3")
A_length_3 = input(20, title="Z-Score Length 4")

//A_z_score_1 = A_zscore(A_price, A_length_1)
A_z_score_2 = A_zscore(A_price, A_length_2)
A_z_score_3 = A_zscore(A_price, A_length_3)

// Ange ett villkor för att PVLCE måste vara över 1750000
A_price_condition = A_price > 1750000 //1000000

// Skapa köpsignaler för varje z-score och periodinställning
//A_buy_signal_1 = A_z_score_1 > 2.25 and A_price_condition
A_buy_signal_2 = A_z_score_2 > 3 and A_price_condition
A_buy_signal_3 = A_z_score_3 > 3 and A_price_condition

// Markera köpsignaler med olika färger och former
//plotshape(A_buy_signal_1, color=color.green, style=shape.triangleup, location=location.belowbar, size=size.small)
plotshape(A_buy_signal_2, color=color.rgb(0, 4, 255), style=shape.triangleup, location=location.belowbar, size=size.small)
plotshape(A_buy_signal_3, color=color.rgb(0, 4, 255), style=shape.triangleup, location=location.belowbar, size=size.small)
```

The same TradingView symbol is also used later for a simpler threshold signal:

```pinescript
//Läs in data för "USI:PVLCE"
//symbol = "USI:PVLCE"
symbol = "FINRA:PLCE_SHORT_VOLUME"

pvlce = request.security(symbol, "D", close)

// Definiera en tröskel för köpsignalen
var float threshold = 3000000

// Generera köpsignal när "USI:PVLCE" är över tröskeln
plotshape(pvlce > threshold ? true : false, style=shape.triangleup, location=location.belowbar, color=color.rgb(0, 4, 255), size=size.normal, title = "PUT Volume extremes")
```

## Exact rules to implement

### Source replacement

Replace:

```text
FINRA:PLCE_SHORT_VOLUME close
```

with:

```text
FINRA CNMSshvolYYYYMMDD.txt row where Symbol = PLCE → ShortVolume
```

### Values to store from FINRA

For each date where `PLCE` exists in the FINRA file, store:

```text
date
symbol
short_volume
short_exempt_volume
total_volume
market
```

### Main value

Use:

```text
short_volume
```

as `A_price` / `pvlce`.

### Z-score calculations

Calculate two Z-scores:

```text
A_z_score_2 = zscore(short_volume, 50)
A_z_score_3 = zscore(short_volume, 20)
```

Formula:

```text
mean = sma(short_volume, length)
stdev = stdev(short_volume, length)
zscore = (short_volume - mean) / stdev
```

Before enough lookback exists, z-score should be `null`.

If stdev is zero, z-score should be `null`.

### Price condition

Original TradingView condition:

```pinescript
A_price_condition = A_price > 1750000
```

Repo implementation:

```text
short_volume > 1,750,000
```

### Buy signals

```text
plce_short_volume_buy_signal_50 = zscore_50 > 3 AND short_volume > 1,750,000
plce_short_volume_buy_signal_20 = zscore_20 > 3 AND short_volume > 1,750,000
```

These are raw buy/contrarian accumulation signals.

### Simple threshold signal

Original TradingView condition:

```pinescript
pvlce > 3000000
```

Repo implementation:

```text
plce_short_volume_extreme_signal = short_volume > 3,000,000
```

The TradingView plot title is `PUT Volume extremes`, but the active source is `FINRA:PLCE_SHORT_VOLUME`. Use the FINRA short-volume value, not put volume.

## Suggested derived fields

If storing derived indicator values in a separate derived table or future signal layer, use names like:

```text
plce_short_volume
plce_short_exempt_volume
plce_total_volume
plce_short_volume_market
plce_short_volume_zscore_50
plce_short_volume_zscore_20
plce_short_volume_price_condition
plce_short_volume_buy_signal_50
plce_short_volume_buy_signal_20
plce_short_volume_extreme_signal
plce_short_volume_signal
```

Recommended `plce_short_volume_signal` values:

```text
none
buy_z50_gt_3
buy_z20_gt_3
extreme_gt_3000000
multiple_buy_signals
```

## Codex task prompt

```text
Implement the indicator/data intake described in docs/indicators/plce-short-volume-zscore-finra.md.

Important:
- This replaces TradingView FINRA:PLCE_SHORT_VOLUME using FINRA's daily Reg SHO short sale volume file.
- Fetch FINRA data from:
  https://cdn.finra.org/equity/regsho/daily/CNMSshvolYYYYMMDD.txt
- Parse pipe-delimited rows with columns:
  Date|Symbol|ShortVolume|ShortExemptVolume|TotalVolume|Market
- Do not sum all rows.
- Take the row where Symbol = PLCE.
- Use ShortVolume as the FINRA:PLCE_SHORT_VOLUME replacement value.
- Also store ShortExemptVolume, TotalVolume, and Market for future use.
- Add the smallest possible separate FINRA data fetch/storage path.
- Do not rewrite the existing Yahoo/FRED/S&P 500 fetch pipeline.
- Do not add Telegram behavior yet.
- Do not add backtest logic unless explicitly requested.

Implement:
1. FINRA source parser/fetcher for one date.
2. Database migration for daily FINRA short volume rows.
3. Repository upsert function with unique(date, symbol).
4. Script or integration to fetch FINRA data by date/date range.
5. Derived z-score calculation using PLCE ShortVolume for lengths 50 and 20.
6. Raw buy signal fields matching the TradingView rules.
7. Raw extreme threshold signal for ShortVolume > 3,000,000.
8. Tests for:
   - parsing the PLCE row
   - not summing all rows
   - saving ShortVolume/ShortExemptVolume/TotalVolume/Market
   - z-score warmup
   - price_condition using ShortVolume > 1,750,000
   - buy_signal_50 and buy_signal_20
   - extreme signal ShortVolume > 3,000,000

When done:
1. Update this doc's status to implemented.
2. Add the implementation commit hash.
3. Ask the user to verify at least one date against FINRA and one signal date/value against TradingView.
```

## Manual FINRA verification

Verify the raw FINRA value first.

```text
Date: 2026-04-13
Endpoint: https://cdn.finra.org/equity/regsho/daily/CNMSshvol20260413.txt
Expected symbol: PLCE
Expected row:
Expected short_volume:
Expected short_exempt_volume:
Expected total_volume:
Expected market:
Repo short_volume:
Repo short_exempt_volume:
Repo total_volume:
Repo market:
Result:
```

## Manual TradingView verification

After implementation, verify at least one signal/value against TradingView's `FINRA:PLCE_SHORT_VOLUME`.

```text
Ticker/source in TradingView: FINRA:PLCE_SHORT_VOLUME
Date:
TradingView close:
FINRA ShortVolume:
TradingView zscore 50:
Repo zscore 50:
TradingView zscore 20:
Repo zscore 20:
TradingView signal:
Repo signal:
Result:
```

Do not mark this indicator as `user_verified` until the user confirms the comparison.
