# Indicator: Implied Volatility Ratio / RVOL Short Squeeze

## Status

Status: implemented
Implemented commit: uncommitted
TradingView verification: not_applicable
Manual verification: pending

## Purpose

This indicator recreates the volatility matrix shown in the reference image:

```text
docs/indicators/pictures/Skärmbild_20221031_121804.png
```

The reference image title is:

```text
Hur ser marknaden på framtida volatilitet?
```

The indicator compares implied volatility against realised volatility across many assets. It measures whether the market is pricing much more future volatility than what has recently been realised.

The key idea:

```text
High Implied Volatility Ratio means implied volatility is high relative to realised volatility.
This can signal fear, protection demand, nervousness, and potential future short-squeeze / relief-rally setups.
```

This is a short-term volatility/risk-sentiment indicator. It should be used as:

- a market nervousness indicator
- a protection/crowding indicator
- a short-squeeze filter
- a risk-on/risk-off confirmation tool
- a cross-asset relative opportunity matrix

It should not automatically buy every high-IV asset. The signal must be interpreted together with trend, trade range, RVOL, market regime, and asset-level confirmation.

## Recommended image rename

Current image:

```text
docs/indicators/pictures/Skärmbild_20221031_121804.png
```

Recommended future filename:

```text
docs/indicators/pictures/implied-volatility-ratio-rvol-short-squeeze.png
```

## Timeframe

Primary timeframe:

```text
short_term
```

Calculation timeframe:

```text
daily
```

Category:

```text
volatility
short_term
implied_volatility
realised_volatility
short_squeeze
risk_sentiment
cross_asset
```

## Implementation notes

V1 is implemented as a separate external indicator pipeline, not inside `fetch:daily`.

Current v1 proxy universe:

- `SPY` + `^VIX`
- `QQQ` + `^VXN`
- `DIA` + `^VXD`
- `GLD` + `^GVZ`
- `USO` + `^OVX`
- `EWZ` + `^VXEWZ`
- `EFA` + `^VXEFA`
- `IWM` + `^VIX` (broad US equity vol proxy)
- `XLE` + `^OVX` (energy equities via oil vol proxy)
- `SMH` + `^VXN` (semiconductors via Nasdaq vol proxy)
- `ARKK` + `^VXN` (high-beta growth via Nasdaq vol proxy)
- `GDX` + `^GVZ` (gold miners via gold vol proxy)
- `FXE` + `^EVZ`
- `UUP` + `^EVZ`
- `XLK` + `^VXN` (technology via Nasdaq vol proxy)
- `XLF` + `^VIX` (financials via broad US equity vol proxy)
- `XLV` + `^VIX` (healthcare via broad US equity vol proxy)

This keeps the existing data pipeline untouched while still using actual implied-volatility proxy series where Yahoo exposes enough history.

Assets whose proxy history is too short are intentionally left out of v1 instead of being fabricated.

## Core formula

The core ratio is:

```text
implied_volatility_ratio = implied_volatility / realised_volatility
```

Then calculate a 1-year z-score of that ratio:

```text
ivol_rvol_ratio_z_1y = (current_ratio - mean(ratio, 252 trading days)) / stddev(ratio, 252 trading days)
```

If fewer than 126 valid daily observations exist, the z-score should be null.

## Interpretation

### High ratio

```text
implied volatility is much higher than realised volatility
```

This means the market expects future movement that has not yet appeared in realised price action.

Possible meaning:

- investors are nervous
- many have bought protection
- protection demand is elevated
- market may already be hedged
- if the feared downside does not happen, hedges can unwind
- this can create latent buying pressure
- high IVOL/RVOL + bullish trend/range can create short-squeeze or relief-rally setups

### Low ratio

```text
implied volatility is low relative to realised volatility
```

Possible meaning:

- market may be complacent
- options market is not pricing enough risk
- realised movement is high but implied protection is cheap/low
- can be unstable if trend/range deteriorates

## Cross-asset matrix

The reference image shows a horizontal matrix/bar chart. Each row is an asset. Each row should show:

- asset name
- current IVOL/RVOL ratio z-score
- value one week ago
- 1-year high-low range
- current marker
- 1-week-ago marker

Visual encoding:

```text
black diamond = current IVOL/RVOL z-score
red dot = 1 week ago IVOL/RVOL z-score
grey horizontal bar = 1-year high-low z-score range
```

Do not hard-code chart values. Calculate from data.

## Assets / rows visible in reference image

Implement the first version with a configurable cross-asset universe. The image includes examples like:

| Row key | Display name | Asset type |
|---|---|---|
| msci_europe | MSCI Europe | equity_index |
| xle_energy | SPDR Energy Sector XLE | equity_sector |
| uup_us_dollar | PowerShares US Dollar | currency_etf |
| agq_ultra_silver | ProShares Ultra Silver | leveraged_commodity_etf |
| tlt_20y_treasury | iShares 20+ Yr Trsy Bond | bond_etf |
| eem_em_equity | iShares MSCI EM | equity_index |
| hyg_high_yield | iShares iBoxx High Yield | credit_etf |
| xlb_materials | SPDR Materials Sector XLB | equity_sector |
| omx_sweden | Sweden OMX | equity_index |
| agg_us_bonds | iShares Core US Aggregate Bond | bond_etf |
| corn | PowerShares Agriculture/Corn | commodity_etf |
| gld_gold | SPDR Gold Trust | commodity_etf |
| spy_sp500 | SPDR S&P 500 SPY | equity_index |
| ief_7_10y_treasury | iShares 7-10 Yr Trsy Bond | bond_etf |
| vnq_real_estate | Vanguard Real Estate Index | real_estate_etf |
| kbe_banks | SPDR Bank Sector | equity_sector |
| natural_gas | United States Natural Gas | commodity_etf |
| xlK_tech | SPDR Tech XLK | equity_sector |
| bitcoin | CoinShares Bitcoin / BTC proxy | crypto |
| tip_tips | iShares TIPS Bond | inflation_linked_bond |
| sp500_growth | iShares S&P 500 Growth | factor_etf |
| stoxx_oil | United States Oil / oil proxy | commodity_etf |
| xlv_healthcare | SPDR Healthcare XLV | equity_sector |
| qqq_nasdaq | PowerShares QQQ | equity_index |
| metal_fund | Invesco Base Metals Fund | commodity_etf |
| energy_fund | Invesco Energy Fund | commodity_etf |
| msci_japan | iShares MSCI Japan | equity_index |

The implementation should use a source/proxy map, because not every row has direct options/implied-volatility data.

## Required input data

For each asset:

```text
asset_key
asset_name
asset_type
source_symbol
close
implied_volatility
realised_volatility
period_date
```

Realised volatility can be calculated from returns.

Implied volatility can come from:

1. option implied volatility where available
2. volatility index proxy where available
3. vendor/API field if available
4. fallback placeholder if not available

Do not fabricate implied volatility. If IV is unavailable, set source_status = missing and exclude the asset from scoring.

## Realised volatility calculation

Use daily log returns:

```text
log_return = ln(close_t / close_t_minus_1)
```

Default realised-volatility window:

```text
30 trading days
```

Annualised realised volatility:

```text
realised_volatility_30d = stddev(log_return over 30 trading days) * sqrt(252) * 100
```

Alternative windows can be stored later, but Phase 1 uses 30d.

## Implied volatility input

Use implied volatility in annualised percentage terms.

Examples:

```text
implied_volatility = 28.5
realised_volatility_30d = 18.0
ratio = 1.5833
```

If the source gives decimal volatility, convert to percent consistently before ratio calculation.

## IVOL/RVOL ratio

```text
ivol_rvol_ratio = implied_volatility / realised_volatility_30d
```

If realised volatility is zero/null:

```text
ivol_rvol_ratio = null
```

## Z-score

Use 252 trading days:

```text
ivol_rvol_ratio_z_1y = (ivol_rvol_ratio - rolling_mean_252) / rolling_std_252
```

Minimum valid observations:

```text
126
```

## One-week-ago value

```text
ivol_rvol_ratio_z_1w_ago = value from 5 trading days ago
```

Also calculate:

```text
ivol_rvol_ratio_z_1w_change = current_z - z_1w_ago
```

## 1-year high-low range

```text
ivol_rvol_ratio_z_1y_min = min(ivol_rvol_ratio_z_1y over 252 trading days)
ivol_rvol_ratio_z_1y_max = max(ivol_rvol_ratio_z_1y over 252 trading days)
```

These values are used for the grey visual range bar.

## RVOL / volume confirmation

The reference text mentions combining implied volatility ratio with low realised volatility, low RVOL, trend and trade range.

If volume data exists, calculate relative volume:

```text
rvol_20d = volume / average(volume, 20 trading days)
```

Classify:

```text
rvol_20d < 0.75 => low_rvol
rvol_20d >= 0.75 and rvol_20d <= 1.50 => normal_rvol
rvol_20d > 1.50 => high_rvol
```

## Trend confirmation

Calculate:

```text
close_above_ma20
close_above_ma50
close_above_ma200
ma20_slope_20d
ma50_slope_20d
```

Trend regime:

```text
if close > ma20 and ma20_slope_20d > 0: short_term_uptrend
if close > ma50 and close > ma200: medium_term_uptrend
if close < ma20 and ma20_slope_20d < 0: short_term_downtrend
else neutral_trend
```

## Trade range confirmation

Calculate 20-day range position:

```text
range_position_20d = (close - rolling_low_20d) / (rolling_high_20d - rolling_low_20d)
```

Classification:

```text
range_position_20d >= 0.70 => upper_range
range_position_20d <= 0.30 => lower_range
otherwise => middle_range
```

## Signal logic

The raw IVOL/RVOL z-score alone is not enough. Combine it with trend, range, and RVOL.

### 1. High implied volatility ratio

```text
if ivol_rvol_ratio_z_1y >= 2.0:
  ivol_rvol_level = very_high
elif ivol_rvol_ratio_z_1y >= 1.0:
  ivol_rvol_level = high
elif ivol_rvol_ratio_z_1y <= -1.0:
  ivol_rvol_level = low
else:
  ivol_rvol_level = normal
```

### 2. Short squeeze / relief setup

A strong short squeeze setup occurs when implied volatility is high while realised action and volume are calm and trend/range starts to turn positive.

```text
if ivol_rvol_ratio_z_1y >= 2.0
and rvol_20d < 0.75
and realised_volatility_30d is not rising sharply
and range_position_20d >= 0.50
and close_above_ma20 = true:
  signal = SHORT_SQUEEZE_SETUP
  action = WATCH_OR_BUY
```

Upgrade to BUY:

```text
if signal = SHORT_SQUEEZE_SETUP
and close_above_ma50 = true
and ma20_slope_20d > 0
and ivol_rvol_ratio_z_1w_change <= 0:
  signal = SHORT_SQUEEZE_BUY
  action = BUY
```

Rationale:

- options market is nervous
- many may already be protected
- price begins to improve
- implied-volatility premium starts easing
- hedges can unwind into buying pressure

### 3. Fear / risk-off warning

If IVOL/RVOL is high and trend is still deteriorating, treat it as fear/risk-off, not buy.

```text
if ivol_rvol_ratio_z_1y >= 2.0
and close_above_ma20 = false
and ma20_slope_20d < 0
and range_position_20d <= 0.50:
  signal = HIGH_IVOL_RVOL_RISK_OFF
  action = NO_NEW_BUYS
```

### 4. Complacency warning

If IVOL/RVOL is very low while trend/range weakens:

```text
if ivol_rvol_ratio_z_1y <= -1.0
and close_above_ma20 = false
and ma20_slope_20d < 0:
  signal = COMPLACENCY_BREAKDOWN_RISK
  action = REDUCE_RISK
```

### 5. Normal/neutral

```text
if none of the above:
  signal = NEUTRAL_VOLATILITY
  action = HOLD
```

## Cross-asset ranking

Each day, rank all valid assets by:

```text
ivol_rvol_ratio_z_1y descending
```

Fields:

```text
ivol_rvol_rank
ivol_rvol_percentile
```

Top-ranked assets show where the market has the highest implied-volatility premium versus realised volatility.

## Opportunity score

Calculate an opportunity score from 0 to 100.

```text
opportunity_score =
  35 * normalized(ivol_rvol_ratio_z_1y) +
  20 * trend_score +
  15 * range_score +
  15 * low_rvol_score +
  15 * vol_premium_easing_score
```

Where:

```text
trend_score = 1 if close_above_ma20 and ma20_slope_20d > 0 else 0
range_score = range_position_20d
low_rvol_score = 1 if rvol_20d < 0.75 else 0
vol_premium_easing_score = 1 if ivol_rvol_ratio_z_1w_change < 0 else 0
```

Clamp to:

```text
0 <= opportunity_score <= 100
```

## Database fields

Suggested table:

```sql
create table if not exists implied_volatility_ratio_signals_daily (
  date date not null,
  asset_key text not null,
  asset_name text not null,
  asset_type text,
  source_symbol text,
  source_status text not null default 'active',

  close numeric,
  implied_volatility numeric,
  realised_volatility_30d numeric,
  ivol_rvol_ratio numeric,
  ivol_rvol_ratio_z_1y numeric,
  ivol_rvol_ratio_z_1w_ago numeric,
  ivol_rvol_ratio_z_1w_change numeric,
  ivol_rvol_ratio_z_1y_min numeric,
  ivol_rvol_ratio_z_1y_max numeric,

  rvol_20d numeric,
  rvol_bucket text,

  close_above_ma20 boolean,
  close_above_ma50 boolean,
  close_above_ma200 boolean,
  ma20_slope_20d numeric,
  ma50_slope_20d numeric,
  trend_regime text,

  range_position_20d numeric,
  range_bucket text,

  ivol_rvol_level text,
  signal text not null,
  action text not null,
  opportunity_score numeric,
  ivol_rvol_rank integer,
  ivol_rvol_percentile numeric,

  row_values jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  primary key (date, asset_key)
);
```

## Fields to store

At minimum:

```text
date
asset_key
asset_name
asset_type
source_symbol
source_status
close
implied_volatility
realised_volatility_30d
ivol_rvol_ratio
ivol_rvol_ratio_z_1y
ivol_rvol_ratio_z_1w_ago
ivol_rvol_ratio_z_1w_change
ivol_rvol_ratio_z_1y_min
ivol_rvol_ratio_z_1y_max
rvol_20d
rvol_bucket
trend_regime
range_position_20d
range_bucket
ivol_rvol_level
signal
action
opportunity_score
ivol_rvol_rank
ivol_rvol_percentile
row_values_json
```

## Signal outputs

Allowed signal values:

```text
SHORT_SQUEEZE_SETUP
SHORT_SQUEEZE_BUY
HIGH_IVOL_RVOL_RISK_OFF
COMPLACENCY_BREAKDOWN_RISK
NEUTRAL_VOLATILITY
```

Allowed action values:

```text
BUY
WATCH_OR_BUY
HOLD
NO_NEW_BUYS
REDUCE_RISK
```

## Row values JSON format

```json
{
  "asset_key": "spy_sp500",
  "asset_name": "SPDR S&P 500 SPY",
  "ivol_rvol_ratio_z_1y": 0.0,
  "ivol_rvol_ratio_z_1w_ago": -0.2,
  "ivol_rvol_ratio_z_1y_min": -1.7,
  "ivol_rvol_ratio_z_1y_max": 3.1,
  "rvol_bucket": "normal_rvol",
  "trend_regime": "neutral_trend",
  "range_bucket": "middle_range",
  "signal": "NEUTRAL_VOLATILITY",
  "action": "HOLD"
}
```

## Implementation architecture

Create the indicator as a separate module:

```text
lib/indicators/implied-volatility-ratio-rvol-short-squeeze.ts
```

Expected exported functions:

```ts
export function calculateRealisedVolatility30d(...): RealisedVolatilityResult[]
export function calculateIvolRvolRatio(...): IvolRvolRatioResult[]
export function calculateIvolRvolZScore(...): IvolRvolZScoreResult[]
export function classifyIvolRvolSignal(...): IvolRvolSignalResult
export function rankIvolRvolAssets(...): IvolRvolRankedResult[]
```

Add tests:

```text
tests/indicators/implied-volatility-ratio-rvol-short-squeeze.test.ts
```

Add migration:

```text
db/migrations/XXX_add_implied_volatility_ratio_signals_daily.sql
```

## Acceptance tests

Codex must add tests for:

1. Realised volatility 30d from log returns.
2. IVOL/RVOL ratio calculation.
3. 252-day z-score calculation.
4. One-week-ago z-score lookup.
5. 1-year high-low range calculation.
6. RVOL bucket classification.
7. Trend regime classification.
8. Range position classification.
9. Very high IVOL/RVOL classification.
10. SHORT_SQUEEZE_SETUP rule.
11. SHORT_SQUEEZE_BUY upgrade rule.
12. HIGH_IVOL_RVOL_RISK_OFF rule.
13. COMPLACENCY_BREAKDOWN_RISK rule.
14. Cross-asset ranking.
15. Opportunity score calculation.
16. Missing implied volatility excludes asset without failing job.

## Example expected behavior

### Short squeeze setup

```text
ivol_rvol_ratio_z_1y = 2.4
rvol_20d = 0.62
close_above_ma20 = true
range_position_20d = 0.65
signal = SHORT_SQUEEZE_SETUP
action = WATCH_OR_BUY
```

### Short squeeze buy

```text
ivol_rvol_ratio_z_1y = 2.4
rvol_20d = 0.62
close_above_ma20 = true
close_above_ma50 = true
ma20_slope_20d = positive
ivol_rvol_ratio_z_1w_change = -0.4
signal = SHORT_SQUEEZE_BUY
action = BUY
```

### Risk-off high IVOL/RVOL

```text
ivol_rvol_ratio_z_1y = 2.8
close_above_ma20 = false
ma20_slope_20d = negative
range_position_20d = 0.25
signal = HIGH_IVOL_RVOL_RISK_OFF
action = NO_NEW_BUYS
```

### Complacency breakdown

```text
ivol_rvol_ratio_z_1y = -1.3
close_above_ma20 = false
ma20_slope_20d = negative
signal = COMPLACENCY_BREAKDOWN_RISK
action = REDUCE_RISK
```

## Do not do in Phase 1

- Do not fabricate implied volatility if source is unavailable.
- Do not classify high IVOL/RVOL as buy without trend/range confirmation.
- Do not ignore realised volatility.
- Do not add Telegram behavior yet.
- Do not alter the existing stock price data-fetching pipeline.
- Do not hard-code chart values from the image.

## Codex task prompt

```text
Implement the Implied Volatility Ratio / RVOL Short Squeeze indicator described in docs/indicators/implied-volatility-ratio-rvol-short-squeeze.md.

Create it as a separate module under lib/indicators/.

Build a daily cross-asset implied-volatility-vs-realised-volatility matrix. Calculate 30d realised volatility from log returns, IVOL/RVOL ratio, 252d z-score, one-week-ago z-score, 1-year high-low z-score range, RVOL bucket, trend regime, range position, signal, action, opportunity score, and cross-asset rank.

The most important rule: high IVOL/RVOL means the market is pricing future volatility above realised volatility. It can be a short-squeeze/relief-buy setup only when trend/range/RVOL confirmation exists. If trend is still deteriorating, high IVOL/RVOL is risk-off, not buy.

Missing implied-volatility data must exclude that asset without failing the whole job.

Add database migration, tests, and calculate/pipeline integration. Do not add Telegram behavior. Do not change the existing stock data-fetching pipeline.

When done, update this file status to implemented and include the implementation commit.
```

## Manual verification

After implementation, verify:

```text
Date:
Asset:
Implied volatility:
Realised volatility 30d:
IVOL/RVOL ratio:
IVOL/RVOL z-score 1y:
1 week ago z-score:
1y min/max range:
RVOL bucket:
Trend regime:
Range bucket:
Signal:
Action:
Result:
```

Also visually compare generated matrix layout to:

```text
docs/indicators/pictures/Skärmbild_20221031_121804.png
```
