# Indicator: Macro Matrix - Sector & Factor Regime Performance

## Status

Status: planned
Implemented commit: TBD
TradingView verification: not_applicable
Manual macro verification: pending

## Purpose

This indicator recreates a macro/regime heatmap similar to the reference image:

```text
docs/indicators/pictures/Skärmbild_20221031_120305.png
```

The reference image title is:

```text
Vilka sektorer och faktorstilar fungerar?
```

The purpose is to measure which markets, sectors, commodities, bonds, currencies, volatility assets, and factor styles historically perform best under different macro/market regimes.

This indicator is not a direct single-stock buy/sell indicator. It is a medium/long-term allocation and filter module for Stock Signals.

The key question it answers is:

```text
Which sectors, asset classes, and factor styles tend to work best in the current regime?
```

It should help the signal engine:

- prefer assets that historically work in the current regime
- avoid assets that historically underperform in the current regime
- identify defensive/risk-off leadership
- identify cyclical/risk-on leadership
- reduce exposure to historically weak groups during contraction/slowdown

## Recommended image rename

Current image:

```text
docs/indicators/pictures/Skärmbild_20221031_120305.png
```

Recommended future filename:

```text
docs/indicators/pictures/macro-matrix-sector-factor-regime-performance.png
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
regime_filter
sector_rotation
factor_rotation
cross_asset
```

The indicator can run daily, but regime classification and performance matrix should be calculated on monthly data.

## What the matrix shows

The matrix compares many assets/markets across four macro regimes:

```text
Recovery
Expansion
Slowdown
Contraction
```

For each asset and each regime, the matrix shows performance statistics:

- Average Returns
- Median Returns
- Volatility
- Sharpe
- Win Ratio
- Beta with OMX30
- Number of Observations

The matrix is designed to answer:

```text
When the market is in a certain regime, what usually works and what usually fails?
```

## Regimes

The four regimes are:

| Regime | Meaning |
|---|---|
| recovery | growth/momentum is improving from weak levels |
| expansion | growth/momentum is positive and broad |
| slowdown | growth/momentum is deteriorating from strong/neutral levels |
| contraction | growth/momentum is weak and broad deterioration dominates |

The regime input can come from one of the macro indicators already specified in this repo, for example:

```text
macro_matrix_us_growth_monthly.macro_growth_regime
macro_matrix_pmi_growth_monthly.pmi_growth_regime
```

This indicator should be able to accept an external monthly regime series.

## Markets / rows to implement

The reference image includes a broad cross-asset universe. Implement these row groups.

### Equity indexes

| Row key | Display name | Asset type |
|---|---|---|
| sp500 | S&P 500 | equity_index |
| nasdaq_100 | Nasdaq 100 | equity_index |
| russell_2000 | Russell 2000 | equity_index |
| dow_jones_transport | Dow Jones Transport | equity_index |
| shanghai_composite | Shanghai Composite | equity_index |

### Commodities / materials / precious metals

| Row key | Display name | Asset type |
|---|---|---|
| renewable_energy_global | Renewable Energy Global | thematic_equity |
| semiconductors_global | Semiconductors Global | thematic_equity |
| gsci_commodities | GSCI Commodities | commodity_index |
| gsci_industrial_metals | GSCI Industrial Metals | commodity_index |
| gsci_precious_metals | GSCI Precious Metals | commodity_index |
| gsci_softs | GSCI Softs | commodity_index |
| gold | Gold | commodity |
| silver | Silver | commodity |
| palladium | Palladium | commodity |
| platinum | Platinum | commodity |
| copper | Copper | commodity |
| brent | Brent | commodity |
| natural_gas | Natural Gas | commodity |
| lumber | Lumber | commodity |
| cocoa | Cocoa | commodity |
| coffee | Coffee | commodity |
| wheat | Wheat | commodity |
| bitcoin | Bitcoin | crypto |

### Volatility

| Row key | Display name | Asset type |
|---|---|---|
| cboe_vix_volatility | CBOE VIX Volatility | volatility |
| cboe_gold_volatility | CBOE Gold Volatility | volatility |
| cboe_oil_volatility | CBOE Oil Volatility | volatility |

### Bonds / rates

| Row key | Display name | Asset type |
|---|---|---|
| high_yield_hyg | High Yield HYG | credit |
| tips_5y | TIPS 5Y | inflation_linked_bond |
| us_30y_gov_bond | US30Y Gov. Bond | government_bond |
| us_10y_gov_bond | US10Y Gov. Bond | government_bond |
| us_2y_gov_bond | US2Y Gov. Bond | government_bond |

### OMX / Swedish factors and bond groups

| Row key | Display name | Asset type |
|---|---|---|
| omrx_bench_treasury_bonds | OMRX Bench. Treasury Bonds | bond_index |
| omrx_bench_real_interest | OMRX Bench. Real Interest | bond_index |
| omrx_bench_trsy_bills | OMRX Bench. Trsy Bills | bond_index |
| omrx_mortgage_5y_index | OMRX Mortgage 5Y Index | bond_index |
| dollar_index | Dollar Index | currency_index |

### FX

| Row key | Display name | Asset type |
|---|---|---|
| emerging_markets_fx | Emerging Markets FX | fx_basket |
| aud_usd | AUD/USD | fx |
| usd_cad | USD/CAD | fx |
| usd_gbp | USD/GBP | fx |
| usd_jpy | USD/JPY | fx |
| usd_sek | USD/SEK | fx |

## Required input data

For each market row:

```text
monthly close price or total return index
```

Prefer total return series where available. If only price data is available, use adjusted close.

Required fields:

```text
symbol
asset_key
asset_name
asset_type
period_date
close_or_total_return
monthly_return_pct
```

## Data source strategy

Use free/API sources where possible.

Priority order:

1. Yahoo Finance adjusted monthly close for ETFs, futures proxies, and indexes where available.
2. Stooq monthly data where Yahoo Finance is not suitable.
3. FRED for macro/bond/currency series where appropriate.
4. Existing repo benchmark/price infrastructure where available.
5. Manual source map placeholders where a row cannot be fetched in Phase 1.

Do not block the indicator if one row is unavailable. Missing rows should be excluded from calculations.

## Proxy mapping

Codex must create a source/proxy mapping file so each row has a fetchable ticker or source.

Suggested examples, to verify before implementation:

```text
sp500 -> ^GSPC or SPY
nasdaq_100 -> ^NDX or QQQ
russell_2000 -> ^RUT or IWM
gold -> GC=F or GLD
silver -> SI=F or SLV
copper -> HG=F or CPER
brent -> BZ=F
natural_gas -> NG=F
bitcoin -> BTC-USD
cboe_vix_volatility -> ^VIX
high_yield_hyg -> HYG
tips_5y -> STIP or TIP
us_30y_gov_bond -> ^TYX or FRED 30Y proxy
us_10y_gov_bond -> ^TNX or FRED 10Y proxy
us_2y_gov_bond -> ^IRX/^FVX alternative or FRED 2Y proxy
dollar_index -> DX-Y.NYB or FRED DTWEXBGS
usd_sek -> SEK=X or FREDDEXSZUS candidate
```

If exact Swedish OMRX indexes are unavailable in Phase 1, use placeholders with `source_status = missing`.

## Raw data model

Reuse existing price/benchmark tables if suitable. If not, create a cross-asset monthly returns table.

Suggested table:

```sql
create table if not exists macro_asset_monthly_returns (
  asset_key text not null,
  asset_name text not null,
  asset_type text not null,
  source text not null,
  source_symbol text,
  period_date date not null,
  close_value numeric,
  monthly_return_pct numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (asset_key, period_date)
);
```

## Regime input table

This indicator needs a monthly regime label.

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

If the source macro indicator uses different labels, map them:

```text
expansion_improving -> expansion
growth_stable_positive -> expansion
mixed_neutral -> slowdown or recovery depending on score momentum
growth_deteriorating -> slowdown
broad_macro_contraction -> contraction
macro_stress -> contraction
services_led_expansion_manufacturing_slowdown -> slowdown
broad_expansion -> expansion
manufacturing_recovery -> recovery
broad_pmi_contraction -> contraction
```

## Indicator output table

Create a monthly/current summary table.

```sql
create table if not exists macro_matrix_sector_factor_regime_performance (
  as_of_date date not null,
  current_regime text not null,

  asset_key text not null,
  asset_name text not null,
  asset_type text not null,

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

For each asset:

```text
monthly_return_pct = ((close_t / close_t_minus_1) - 1) * 100
```

Use adjusted close or total return where available.

### Regime split

Join every asset monthly return to the monthly regime label:

```text
asset_return_month.period_date = macro_regime_monthly.period_date
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

Monthly volatility:

```text
volatility = standard_deviation(monthly_return_pct within regime)
```

Do not annualize in Phase 1 unless explicitly configured. The reference image appears to compare monthly regime stats.

### Sharpe

For Phase 1, use simple return/volatility:

```text
sharpe = avg_return / volatility
```

If volatility is zero or null, sharpe is null.

Optional future annualized version:

```text
annualized_sharpe = (avg_monthly_return * 12) / (monthly_volatility * sqrt(12))
```

### Win ratio

```text
win_ratio = count(monthly_return_pct > 0) / count(valid monthly_return_pct) * 100
```

### Beta with OMX30

For each regime:

```text
beta_with_omx30 = covariance(asset_monthly_return, omx30_monthly_return) / variance(omx30_monthly_return)
```

If OMX30 is unavailable, use a configured benchmark such as:

```text
OMXS30
^OMX
^GSPC
```

But store which benchmark was used.

### Number of observations

```text
observations = count(valid monthly_return_pct within regime)
```

Require at least this many observations before ranking a stat:

```text
minimum_observations = 6
```

For low sample regimes, still store values but mark confidence low.

## Current regime score

For the current regime, calculate a score per asset.

Example for current regime = `expansion`:

```text
current_regime_score =
  0.35 * normalized(expansion_avg_return) +
  0.20 * normalized(expansion_median_return) +
  0.20 * normalized(expansion_sharpe) +
  0.15 * normalized(expansion_win_ratio) -
  0.10 * normalized(expansion_volatility)
```

Normalize each stat cross-sectionally across assets for the same regime using rank percentile or z-score.

Preferred Phase 1 normalization:

```text
rank_percentile from 0 to 1
```

For volatility, lower is better.

## Current regime bucket

After scoring all assets for the current regime:

```text
rank percentile >= 0.80 => top_regime_leader
rank percentile >= 0.60 => positive_regime_fit
rank percentile > 0.40  => neutral_regime_fit
rank percentile > 0.20  => weak_regime_fit
rank percentile <= 0.20 => avoid_regime_laggard
```

## Allocation bias

Map bucket to allocation bias:

```text
top_regime_leader     -> OVERWEIGHT
positive_regime_fit   -> SLIGHT_OVERWEIGHT
neutral_regime_fit    -> NEUTRAL
weak_regime_fit       -> UNDERWEIGHT
avoid_regime_laggard  -> AVOID
```

## Stock Signals integration

This indicator should be consumed as a filter/booster by the signal engine.

Suggested behavior:

| Allocation bias | Effect on ticker/asset signals |
|---|---|
| OVERWEIGHT | Strong boost to long signals in this asset/sector/style |
| SLIGHT_OVERWEIGHT | Mild boost to long signals |
| NEUTRAL | No adjustment |
| UNDERWEIGHT | Require stronger technical confirmation |
| AVOID | Block weak buy signals and prefer no new exposure |

This is especially useful when a stock belongs to a sector/factor/asset class that can be mapped to one of the matrix rows.

## Color bucket rules for matrix UI

For each metric cell, calculate color bucket by ranking within metric/regime group or using absolute scale.

Preferred for returns, Sharpe, win ratio, beta where higher is better:

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

Store color bucket only; do not hard-code UI colors in calculation logic.

Suggested UI colors:

```text
strong_positive = teal/blue
positive        = light teal
neutral         = white/light grey
negative        = light red
strong_negative = red
```

## Fields to store

At minimum:

```text
as_of_date
current_regime
asset_key
asset_name
asset_type
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
lib/indicators/macro-matrix-sector-factor-regime-performance.ts
```

Expected exported functions:

```ts
export function calculateMonthlyReturns(...): MonthlyAssetReturn[]
export function mapMacroRegimeLabels(...): MacroRegimeMonthly[]
export function calculateRegimePerformanceStats(...): RegimePerformanceStats[]
export function scoreAssetsForCurrentRegime(...): SectorFactorRegimeScore[]
export function classifyAllocationBias(...): AllocationBiasClassification
```

Add tests:

```text
tests/indicators/macro-matrix-sector-factor-regime-performance.test.ts
```

Add migration(s):

```text
db/migrations/XXX_add_macro_asset_monthly_returns.sql
db/migrations/XXX_add_macro_regime_monthly.sql
db/migrations/XXX_add_macro_matrix_sector_factor_regime_performance.sql
```

If existing tables already cover monthly prices/returns or regimes, reuse them instead of duplicating storage.

## Acceptance tests

Codex must add tests for:

1. Monthly return calculation.
2. Joining monthly asset returns to monthly regimes.
3. Average return by regime.
4. Median return by regime.
5. Volatility by regime.
6. Sharpe by regime.
7. Win ratio by regime.
8. Beta with OMX30 by regime.
9. Observation count by regime.
10. Current regime scoring.
11. Ranking and bucket classification.
12. Allocation bias mapping.
13. Missing asset data handling.
14. Low observation count handling.
15. Regime label mapping from existing macro matrix indicators.

## Example expected behavior

If current regime is `expansion` and an asset has strong expansion stats:

```text
asset_key = nasdaq_100
current_regime = expansion
expansion_avg_return = high
expansion_sharpe = high
expansion_win_ratio = high
current_regime_bucket = top_regime_leader
allocation_bias = OVERWEIGHT
```

If current regime is `contraction` and an asset historically has poor contraction stats:

```text
asset_key = bitcoin
current_regime = contraction
contraction_avg_return = low
contraction_sharpe = low
contraction_volatility = high
current_regime_bucket = avoid_regime_laggard
allocation_bias = AVOID
```

If current regime is `contraction` and an asset historically performs well in contraction:

```text
asset_key = cboe_vix_volatility
current_regime = contraction
contraction_avg_return = high
contraction_win_ratio = high
current_regime_bucket = top_regime_leader
allocation_bias = OVERWEIGHT
```

## Do not do in Phase 1

- Do not create ticker-level buy/sell signals from this indicator alone.
- Do not add Telegram alerts yet.
- Do not hard-code values from the reference image.
- Do not require every asset row to be available before producing output.
- Do not scrape paid/blocked data sources.
- Do not alter the existing stock data-fetching pipeline.
- Do not assume one market proxy is perfect; keep proxy/source mapping explicit.

## Codex task prompt

```text
Implement the Macro Matrix - Sector & Factor Regime Performance indicator described in docs/indicators/macro-matrix-sector-factor-regime-performance.md.

Create it as a separate module under lib/indicators/.

Build a monthly cross-asset regime performance matrix from the listed markets, sectors, commodities, bonds, currencies, volatility series, and factor/style proxies. Use free/API sources where possible and create an explicit source/proxy mapping.

Use a monthly macro regime input with four regimes: recovery, expansion, slowdown, contraction. Reuse existing macro matrix regime outputs if possible and map their labels to these four regimes.

Calculate monthly returns, average return, median return, volatility, Sharpe, win ratio, beta with OMX30/benchmark, observation count, current-regime score, current-regime rank, current-regime bucket, and allocation bias.

Missing rows must be allowed and excluded from calculations. Add migrations, tests, and pipeline integration. Do not add Telegram behavior. Do not create ticker-level buy/sell signals from this indicator alone. Do not change the existing stock data-fetching pipeline.

When done, update this file status to implemented and include the implementation commit.
```

## Manual verification

After implementation, verify:

```text
As-of date:
Current regime:
Benchmark used for beta:
Assets available:
Top 5 current-regime leaders:
Bottom 5 current-regime laggards:
One manually checked avg return by regime:
One manually checked win ratio by regime:
One manually checked beta by regime:
Result:
```

Also visually compare generated matrix layout to:

```text
docs/indicators/pictures/Skärmbild_20221031_120305.png
```
