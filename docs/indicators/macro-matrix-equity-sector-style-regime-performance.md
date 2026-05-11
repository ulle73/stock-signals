# Indicator: Macro Matrix - Equity Sector & Style Regime Performance

## Status

Status: planned
Implemented commit: TBD
TradingView verification: not_applicable
Manual macro verification: pending

## Purpose

This indicator recreates a macro/regime heatmap similar to the reference image:

```text
docs/indicators/pictures/Skärmbild_20221031_120225.png
```

The reference image title is:

```text
Vilka sektorer och faktorstilar fungerar?
```

This indicator is a sector/style/factor regime performance matrix. It focuses on equities and compares which sectors, factor styles, size groups, countries/regions, and thematic equity groups historically perform best in different market regimes.

It is similar to `macro-matrix-sector-factor-regime-performance.md`, but this spec is narrower and more equity-focused. The previous spec is cross-asset. This one is for equity sector/style rotation.

The key question it answers is:

```text
Which equity sectors and factor styles tend to work best in the current macro regime?
```

It should help Stock Signals avoid weak equity groups and prefer sectors/styles with historically better regime fit.

## Recommended image rename

Current image:

```text
docs/indicators/pictures/Skärmbild_20221031_120225.png
```

Recommended future filename:

```text
docs/indicators/pictures/macro-matrix-equity-sector-style-regime-performance.png
```

## Timeframe

Primary timeframe:

```text
monthly
```

Category:

```text
macro
medium_long_term
sector_rotation
style_rotation
factor_rotation
equity_regime_filter
```

The indicator may run daily, but all regime statistics should be calculated from monthly returns.

## What the matrix shows

The matrix compares equity sectors and styles across four market regimes:

```text
Recovery
Expansion
Slowdown
Contraction
```

For each sector/style and each regime, the matrix shows:

- Average Returns
- Median Returns
- Volatility
- Sharpe
- Win Ratio
- Beta with OMX30
- Number of Observations

It is designed to answer:

```text
In this current market regime, which equity sectors/styles have historically had the best reward/risk profile?
```

## Regimes

The four regimes are:

| Regime | Meaning |
|---|---|
| recovery | growth/momentum improves from weak levels |
| expansion | growth/momentum is positive and broad |
| slowdown | growth/momentum deteriorates from positive/neutral levels |
| contraction | growth/momentum is weak and deterioration is broad |

This indicator should accept an external monthly regime series, for example from:

```text
macro_matrix_us_growth_monthly
macro_matrix_pmi_growth_monthly
macro_regime_monthly
```

## Sector and style rows to implement

The reference image includes European, OMX, and S&P 500 sector/style groups. Implement the rows below as the initial universe where fetchable proxies exist.

### Euro Stoxx sectors and styles

| Row key | Display name | Group |
|---|---|---|
| euro_stoxx | Euro Stoxx | region_index |
| euro_stoxx_auto_parts | Euro Stoxx Auto & Parts | sector |
| euro_stoxx_basic_resources | Euro Stoxx Basic Resources | sector |
| euro_stoxx_banks | Euro Stoxx Banks | sector |
| euro_stoxx_basic_materials | Euro Stoxx Basic Materials | sector |
| euro_stoxx_construction_materials | Euro Stoxx Constr & Mat | sector |
| euro_stoxx_cyclicals | Euro Stoxx Cyclicals | style_group |
| euro_stoxx_defensives | Euro Stoxx Defensives | style_group |
| euro_stoxx_energy | Euro Stoxx Energy | sector |
| euro_stoxx_financials | Euro Stoxx Financials | sector |
| euro_stoxx_growth | Euro Stoxx Growth | factor_style |
| euro_stoxx_health_care | Euro Stoxx Health Care | sector |
| euro_stoxx_industrials | Euro Stoxx Industrials | sector |
| euro_stoxx_insurance | Euro Stoxx Insurance | sector |
| euro_stoxx_large_cap | Euro Stoxx Large Cap | size_style |
| euro_stoxx_minimum_volatility | Euro Stoxx Minimum Volatility | factor_style |
| euro_stoxx_momentum | Euro Stoxx Momentum | factor_style |
| euro_stoxx_oil_gas | Euro Stoxx Oil & Gas | sector |
| euro_stoxx_real_estate | Euro Stoxx Real Estate | sector |
| euro_stoxx_retail | Euro Stoxx Retail | sector |
| euro_stoxx_small_cap | Euro Stoxx Small Cap | size_style |
| euro_stoxx_sustainability | Euro Stoxx Sustainability | factor_style |
| euro_stoxx_tech | Euro Stoxx Tech | sector |
| euro_stoxx_telecom | Euro Stoxx Telecom | sector |
| euro_stoxx_travel_leisure | Euro Stoxx Travel & Leisure | sector |
| euro_stoxx_utilities | Euro Stoxx Utilities | sector |
| euro_stoxx_value | Euro Stoxx Value | factor_style |

### OMX / Swedish sectors

| Row key | Display name | Group |
|---|---|---|
| omxs30 | OMXS30 | region_index |
| omx_banks | OMX Banks | sector |
| omx_basic_materials | OMX Basic Materials | sector |
| omx_consumer_staples | OMX Consumer Staples | sector |
| omx_financials | OMX Financials | sector |
| omx_health_care | OMX Health Care | sector |
| omx_industrials | OMX Industrials | sector |
| omx_real_estate | OMX Real Estate | sector |
| omx_tech_equal | OMX Tech Equal | sector |
| omx_technology | OMX Technology | sector |
| omx_telecom | OMX Telecom | sector |

### S&P 500 sectors and styles

| Row key | Display name | Group |
|---|---|---|
| sp500 | S&P 500 | region_index |
| sp500_banks | S&P 500 Banks | sector |
| sp500_buybacks | S&P 500 Buybacks | factor_style |
| sp500_consumer_discretionary | S&P 500 Consumer Discretionary | sector |
| sp500_consumer_staples | S&P 500 Consumer Staples | sector |
| sp500_cyclicals | S&P 500 Cyclicals | style_group |
| sp500_energy | S&P 500 Energy | sector |
| sp500_growth | S&P 500 Growth | factor_style |
| sp500_health_care | S&P 500 Health Care | sector |
| sp500_high_beta | S&P 500 High Beta | factor_style |
| sp500_high_dividend | S&P 500 High Dividend | factor_style |
| sp500_industrials | S&P 500 Industrials | sector |
| sp500_low_volatility | S&P 500 Low Volatility | factor_style |
| sp500_materials | S&P 500 Materials | sector |
| sp500_momentum | S&P 500 Momentum | factor_style |
| sp500_quality | S&P 500 Quality | factor_style |
| sp500_real_estate | S&P 500 Real Estate | sector |
| sp500_semiconductors | S&P 500 Semiconductors | industry |
| sp500_tech | S&P 500 Tech | sector |
| sp500_value | S&P 500 Value | factor_style |

## Required input data

For each row:

```text
monthly adjusted close, price index, or total return index
```

Prefer total return series if available. If unavailable, use adjusted close ETF proxies.

Required fields:

```text
asset_key
asset_name
asset_group
region
source
source_symbol
period_date
close_value
monthly_return_pct
```

## Data source strategy

Use free/API sources where possible.

Priority order:

1. Yahoo Finance ETF proxies.
2. Stooq monthly data.
3. FRED or official index downloadable data where useful.
4. Existing repo price/benchmark infrastructure.
5. Explicit placeholder mapping for missing/unavailable rows.

Do not block the whole indicator because some rows are missing. Store missing rows as unavailable and exclude them from calculations.

## Suggested proxy mapping

Codex must create and verify a source/proxy mapping. Examples below are starting points only.

### S&P 500 ETF proxy examples

```text
sp500 -> SPY or ^GSPC
sp500_banks -> KBE or KBWB
sp500_buybacks -> PKW
sp500_consumer_discretionary -> XLY
sp500_consumer_staples -> XLP
sp500_energy -> XLE
sp500_growth -> IVW or SPYG
sp500_health_care -> XLV
sp500_high_beta -> SPHB
sp500_high_dividend -> SPYD
sp500_industrials -> XLI
sp500_low_volatility -> SPLV
sp500_materials -> XLB
sp500_momentum -> MTUM or SPMO
sp500_quality -> QUAL or SPHQ
sp500_real_estate -> XLRE
sp500_semiconductors -> SMH or SOXX
sp500_tech -> XLK
sp500_value -> IVE or SPYV
```

### European proxy examples

Use available Euro Stoxx sector ETFs or Stoxx index symbols if available through Yahoo/Stooq. If a row cannot be fetched, set `source_status = missing`.

### Swedish/OMX proxy examples

Use available OMX sector indexes or Swedish ETFs if available. If unavailable, keep placeholders with explicit missing status.

## Raw monthly returns table

Reuse an existing monthly price/return table if available. If not, create:

```sql
create table if not exists equity_sector_style_monthly_returns (
  asset_key text not null,
  asset_name text not null,
  asset_group text not null,
  region text not null,
  source text not null,
  source_symbol text,
  source_status text not null default 'active',
  period_date date not null,
  close_value numeric,
  monthly_return_pct numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (asset_key, period_date)
);
```

Allowed `source_status`:

```text
active
missing
manual
unsupported
```

## Regime input table

This indicator requires a monthly regime label.

Suggested table/view:

```sql
create table if not exists macro_regime_monthly (
  period_date date primary key,
  regime text not null,
  source_indicator text not null,
  source_score numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

Allowed regimes:

```text
recovery
expansion
slowdown
contraction
```

## Regime mapping

If source indicators use more detailed labels, map them:

```text
expansion_improving -> expansion
growth_stable_positive -> expansion
mixed_neutral with positive score momentum -> recovery
mixed_neutral with negative score momentum -> slowdown
growth_deteriorating -> slowdown
broad_macro_contraction -> contraction
macro_stress -> contraction
services_led_expansion_manufacturing_slowdown -> slowdown
broad_expansion -> expansion
manufacturing_recovery -> recovery
broad_pmi_contraction -> contraction
pmi_macro_stress -> contraction
```

## Indicator output table

```sql
create table if not exists macro_matrix_equity_sector_style_regime_performance (
  as_of_date date not null,
  current_regime text not null,

  asset_key text not null,
  asset_name text not null,
  asset_group text not null,
  region text not null,

  recovery_avg_return numeric,
  expansion_avg_return numeric,
  slowdown_avg_return numeric,
  contraction_avg_return numeric,

  recovery_median_return numeric,
  expansion_median_return numeric,
  slowdown_median_return numeric,
  contraction_median_return numeric,

  recovery_volatility numeric,
  expansion_volatility numeric,
  slowdown_volatility numeric,
  contraction_volatility numeric,

  recovery_sharpe numeric,
  expansion_sharpe numeric,
  slowdown_sharpe numeric,
  contraction_sharpe numeric,

  recovery_win_ratio numeric,
  expansion_win_ratio numeric,
  slowdown_win_ratio numeric,
  contraction_win_ratio numeric,

  recovery_beta_omx30 numeric,
  expansion_beta_omx30 numeric,
  slowdown_beta_omx30 numeric,
  contraction_beta_omx30 numeric,

  recovery_observations integer,
  expansion_observations integer,
  slowdown_observations integer,
  contraction_observations integer,

  current_regime_score numeric,
  current_regime_rank integer,
  current_regime_bucket text,
  allocation_bias text,

  row_values jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  primary key (as_of_date, asset_key)
);
```

## Calculations

### Monthly return

```text
monthly_return_pct = ((close_t / close_t_minus_1) - 1) * 100
```

Use adjusted close or total return index where available.

### Join returns to regime

```text
equity_sector_style_monthly_returns.period_date = macro_regime_monthly.period_date
```

Then group by:

```text
asset_key
regime
```

### Average return

```text
avg_return = average(monthly_return_pct within regime)
```

### Median return

```text
median_return = median(monthly_return_pct within regime)
```

### Volatility

```text
volatility = standard_deviation(monthly_return_pct within regime)
```

Phase 1 should use monthly volatility, not annualized volatility, unless explicitly configured later.

### Sharpe

```text
sharpe = avg_return / volatility
```

If volatility is zero or null, Sharpe is null.

### Win ratio

```text
win_ratio = count(monthly_return_pct > 0) / count(valid monthly_return_pct) * 100
```

### Beta with OMX30

For each regime:

```text
beta_with_omx30 = covariance(asset_monthly_return, omx30_monthly_return) / variance(omx30_monthly_return)
```

If OMX30 is unavailable, use a configured benchmark and store which benchmark was used:

```text
OMXS30
^OMX
^OMX30
^GSPC
SPY
```

### Number of observations

```text
observations = count(valid monthly_return_pct within regime)
```

Minimum observations before confident ranking:

```text
minimum_observations = 6
```

Rows with fewer observations should still be stored, but marked low confidence in `row_values`.

## Current regime score

For the current regime, score every row using the stats for that regime.

Example if current regime is `slowdown`:

```text
current_regime_score =
  0.35 * rank_percentile(slowdown_avg_return) +
  0.20 * rank_percentile(slowdown_median_return) +
  0.20 * rank_percentile(slowdown_sharpe) +
  0.15 * rank_percentile(slowdown_win_ratio) -
  0.10 * rank_percentile(slowdown_volatility)
```

For volatility, lower is better, so invert ranking:

```text
volatility_rank = 1 - rank_percentile(volatility)
```

Preferred Phase 1 normalization:

```text
rank_percentile from 0 to 1 within current regime and metric
```

## Current regime bucket

```text
rank percentile >= 0.80 => top_regime_leader
rank percentile >= 0.60 => positive_regime_fit
rank percentile > 0.40  => neutral_regime_fit
rank percentile > 0.20  => weak_regime_fit
rank percentile <= 0.20 => avoid_regime_laggard
```

## Allocation bias

```text
top_regime_leader     -> OVERWEIGHT
positive_regime_fit   -> SLIGHT_OVERWEIGHT
neutral_regime_fit    -> NEUTRAL
weak_regime_fit       -> UNDERWEIGHT
avoid_regime_laggard  -> AVOID
```

## Stock Signals integration

This indicator is a sector/style filter and signal booster.

| Allocation bias | Effect on stock signals |
|---|---|
| OVERWEIGHT | Boost long signals for stocks/assets mapped to this sector/style |
| SLIGHT_OVERWEIGHT | Mild boost to long signals |
| NEUTRAL | No adjustment |
| UNDERWEIGHT | Require stronger technical confirmation |
| AVOID | Block weak buy signals and prefer no new exposure |

A stock can map to multiple rows, for example:

```text
large-cap tech stock -> sp500_tech + sp500_growth + sp500_large_cap proxy if available
Swedish bank -> omx_banks + omxs30
European energy stock -> euro_stoxx_energy + euro_stoxx_value/cyclicals if mapped
```

If multiple mappings exist, average allocation bias numerically:

```text
OVERWEIGHT = +2
SLIGHT_OVERWEIGHT = +1
NEUTRAL = 0
UNDERWEIGHT = -1
AVOID = -2
```

## Matrix color bucket rules

For each metric cell, use rank buckets within each metric/regime column.

For return, Sharpe, win ratio, and beta where higher is better:

```text
top 20% => strong_positive
60-80% => positive
40-60% => neutral
20-40% => negative
bottom 20% => strong_negative
```

For volatility, lower is better:

```text
bottom 20% volatility => strong_positive
20-40% => positive
40-60% => neutral
60-80% => negative
top 20% volatility => strong_negative
```

Store color bucket only. Do not hard-code UI colors in calculation logic.

Suggested UI colors:

```text
strong_positive = teal/blue
positive        = light teal
neutral         = white/light grey
negative        = light red
strong_negative = red
```

## Row values JSON format

Each row should store detailed values in `row_values`:

```json
{
  "sp500_tech": {
    "asset_name": "S&P 500 Tech",
    "asset_group": "sector",
    "region": "US",
    "source": "yahoo",
    "source_symbol": "XLK",
    "source_status": "active",
    "current_regime": "expansion",
    "current_regime_score": 0.86,
    "current_regime_rank": 3,
    "current_regime_bucket": "top_regime_leader",
    "allocation_bias": "OVERWEIGHT",
    "confidence": "normal"
  }
}
```

Confidence rule:

```text
observations >= 12 => high
observations >= 6  => normal
observations < 6   => low
```

## Fields to store

At minimum:

```text
as_of_date
current_regime
asset_key
asset_name
asset_group
region
recovery_avg_return
expansion_avg_return
slowdown_avg_return
contraction_avg_return
recovery_median_return
expansion_median_return
slowdown_median_return
contraction_median_return
recovery_volatility
expansion_volatility
slowdown_volatility
contraction_volatility
recovery_sharpe
expansion_sharpe
slowdown_sharpe
contraction_sharpe
recovery_win_ratio
expansion_win_ratio
slowdown_win_ratio
contraction_win_ratio
recovery_beta_omx30
expansion_beta_omx30
slowdown_beta_omx30
contraction_beta_omx30
recovery_observations
expansion_observations
slowdown_observations
contraction_observations
current_regime_score
current_regime_rank
current_regime_bucket
allocation_bias
row_values_json
```

## Implementation architecture

Create the indicator as a separate module:

```text
lib/indicators/macro-matrix-equity-sector-style-regime-performance.ts
```

Expected exported functions:

```ts
export function calculateEquitySectorStyleMonthlyReturns(...): EquitySectorStyleMonthlyReturn[]
export function mapEquityMacroRegimeLabels(...): MacroRegimeMonthly[]
export function calculateEquitySectorStyleRegimeStats(...): EquitySectorStyleRegimeStats[]
export function scoreEquitySectorStylesForCurrentRegime(...): EquitySectorStyleRegimeScore[]
export function classifyEquitySectorStyleAllocationBias(...): AllocationBiasClassification
```

Add tests:

```text
tests/indicators/macro-matrix-equity-sector-style-regime-performance.test.ts
```

Add migration(s):

```text
db/migrations/XXX_add_equity_sector_style_monthly_returns.sql
db/migrations/XXX_add_macro_matrix_equity_sector_style_regime_performance.sql
```

If `macro_regime_monthly` already exists, reuse it and do not duplicate it.

## Acceptance tests

Codex must add tests for:

1. Monthly return calculation.
2. Joining monthly returns to monthly regimes.
3. Average return by regime.
4. Median return by regime.
5. Volatility by regime.
6. Sharpe by regime.
7. Win ratio by regime.
8. Beta with OMX30/benchmark by regime.
9. Observation count by regime.
10. Current regime score calculation.
11. Rank percentile calculation.
12. Current regime bucket classification.
13. Allocation bias mapping.
14. Missing proxy/source handling.
15. Low observation confidence handling.
16. Multi-row stock mapping bias aggregation.
17. Color bucket mapping for higher-is-better metrics.
18. Color bucket mapping for lower-is-better volatility.

## Example expected behavior

If current regime is `expansion` and S&P 500 Tech historically performs well:

```text
asset_key = sp500_tech
current_regime = expansion
current_regime_bucket = top_regime_leader
allocation_bias = OVERWEIGHT
```

If current regime is `slowdown` and cyclicals historically perform poorly:

```text
asset_key = euro_stoxx_cyclicals
current_regime = slowdown
current_regime_bucket = avoid_regime_laggard
allocation_bias = AVOID
```

If current regime is `contraction` and defensives/low volatility perform relatively better:

```text
asset_key = euro_stoxx_defensives
current_regime = contraction
current_regime_bucket = positive_regime_fit
allocation_bias = SLIGHT_OVERWEIGHT
```

## Do not do in Phase 1

- Do not create direct ticker-level buy/sell signals from this indicator alone.
- Do not add Telegram alerts yet.
- Do not hard-code values from the image.
- Do not require all sector/style rows to be available.
- Do not scrape paid/blocked index pages.
- Do not alter the existing stock data-fetching pipeline.
- Do not silently substitute proxies; every proxy must be explicit in the mapping file.

## Codex task prompt

```text
Implement the Macro Matrix - Equity Sector & Style Regime Performance indicator described in docs/indicators/macro-matrix-equity-sector-style-regime-performance.md.

Create it as a separate module under lib/indicators/.

Build a monthly equity sector/style regime performance matrix from the listed Euro Stoxx, OMX, and S&P 500 sector/style/factor rows. Use free/API sources where possible and create an explicit proxy/source mapping.

Use a monthly macro regime input with four regimes: recovery, expansion, slowdown, contraction. Reuse existing macro regime outputs if possible and map detailed labels to these four regimes.

Calculate monthly returns, average return, median return, volatility, Sharpe, win ratio, beta with OMX30/benchmark, observation count, current-regime score, current-regime rank, current-regime bucket, allocation bias, and color buckets.

Missing rows must be allowed and excluded from calculations. Add migrations, tests, and pipeline integration. Do not add Telegram behavior. Do not create direct ticker-level buy/sell behavior from this indicator alone. Do not change the existing stock data-fetching pipeline.

When done, update this file status to implemented and include the implementation commit.
```

## Manual verification

After implementation, verify:

```text
As-of date:
Current regime:
Benchmark used for beta:
Rows available:
Top 10 current-regime leaders:
Bottom 10 current-regime laggards:
One checked average return by regime:
One checked median return by regime:
One checked volatility by regime:
One checked win ratio by regime:
One checked beta by regime:
Result:
```

Also visually compare generated matrix layout to:

```text
docs/indicators/pictures/Skärmbild_20221031_120225.png
```
