# Indicator: Macro Matrix - PMI Growth Momentum

## Status

Status: planned
Implemented commit: TBD
TradingView verification: not_applicable
Manual macro verification: pending

## Purpose

This indicator recreates a macro heatmap/matrix similar to the reference image in:

```text
docs/indicators/pictures/Skärmbild_20221031_122103.png
```

The reference image title is:

```text
Industri-PMI ner och tjänste-PMI upp
```

The purpose is to track whether the business cycle is improving or deteriorating through PMI, leading indicators, confidence indexes, trade, retail sales, production, and related macro growth data.

This is a macro regime indicator. It should not create single-stock buy/sell signals directly. It should be used as a medium/long-term market filter inside Stock Signals.

The key question it answers is:

```text
Are manufacturing and services momentum improving, diverging, or deteriorating?
```

## Recommended image rename

Current image:

```text
docs/indicators/pictures/Skärmbild_20221031_122103.png
```

Recommended future filename:

```text
docs/indicators/pictures/macro-matrix-pmi-growth-momentum.png
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
business_cycle
pmi
regime_filter
```

The indicator can run daily in the pipeline, but values are monthly or weekly/monthly source data.

## What the matrix shows

The matrix is a heatmap with one row per macro series and one column per month.

It mixes:

- manufacturing PMI
- services PMI
- new orders
- business activity
- leading indicators
- economic tendency indicators
- export/import growth
- industrial production
- vehicle registrations/sales
- retail sales
- consumer confidence

The main interpretation is the relationship between manufacturing and services:

```text
manufacturing weak + services strong = mixed/late-cycle or services-led expansion
manufacturing weak + services weak = broad slowdown/risk-off
manufacturing strong + services strong = broad expansion/risk-on
manufacturing improving + services stable = early cyclical recovery
```

## Visual layout to recreate

The indicator should be renderable as a matrix/heatmap with:

- one row per series
- one column per monthly period
- optional latest value column on the far right
- blue/teal for positive/improving readings
- red for weak/deteriorating readings
- grey/white for neutral readings
- optional circle/marker on latest important service PMI rows

Do not hard-code the reference image values. Use source data.

## Macro rows to implement

The reference image includes these rows. Implement these as the first version unless a source is unavailable.

| Row key | Display name | Category | Direction rule |
|---|---|---|---|
| economic_tendency_total | Economic Tendency Indicator Total | broad_cycle | higher is better |
| economic_tendency_construction | Economic Tendency Indicator Construction | construction | higher is better |
| composite_leading_indicators_yoy | Composite Leading Indicators Y/Y | leading_indicators | higher is better |
| cli_manufacturing_order_books | CLI Manufacturing - Order Books | manufacturing_leading | higher is better |
| cli_services_demand_expectations | CLI Services - Demand Expectations | services_leading | higher is better |
| exports_yoy | Export Y/Y | trade | higher is better |
| imports_yoy | Import Y/Y | trade | higher is better, but falling imports may also signal weaker demand |
| industrial_production_mining_mfg_yoy | Industrial Production %Y/Y Mining & MFG Y/Y | manufacturing_activity | higher is better |
| new_motor_vehicle_registrations_yoy | New Motor Vehicle Registrations %Y/Y | consumption_cyclical | higher is better |
| retail_sales_ex_vehicles_yoy | Retail Sales excl. Vehicles %Y/Y | consumption | higher is better |
| consumer_confidence_ytd | Consumer Confidence Survey KI SA | consumer_sentiment | higher is better |
| manufacturing_pmi_total | Manufacturing PMI Total SA | manufacturing_pmi | higher is better; above 50 expansion |
| manufacturing_pmi_new_orders | Manufacturing PMI New Orders SA | manufacturing_pmi | higher is better; above 50 expansion |
| manufacturing_pmi_production | Manufacturing PMI Production SA | manufacturing_pmi | higher is better; above 50 expansion |
| service_pmi_new_orders | Service PMI New Orders SA | services_pmi | higher is better; above 50 expansion |
| service_pmi_business_activity | Service PMI Business Activity SA | services_pmi | higher is better; above 50 expansion |
| service_pmi_total | Service PMI Total SA | services_pmi | higher is better; above 50 expansion |

If multiple duplicate service PMI rows exist in the reference image, keep only unique rows in data storage, but the renderer may support duplicate display labels if needed for visual parity.

## Data source strategy

Use free/API sources where possible. Prefer official sources and stable API/CSV endpoints.

Priority order:

1. FRED, OECD, Eurostat, national statistics APIs, or official PMI/NIER/National Institute endpoints.
2. Public CSV/download endpoints.
3. Manual placeholder source map with `source_status = missing` where source is unavailable.

Do not block the whole indicator if one row is missing. Missing rows should be null and excluded from score denominators.

## Important note about geography

The reference image contains labels such as NIER, KI, and OECD. These are not purely US-specific labels. This indicator should therefore support a `region` field.

Default region for this image/spec:

```text
region = global_or_european_pmi_matrix
```

If implementation has access to exact Swedish/European sources, use them. If not, implement the same model generically so it can run for:

```text
US
EU
Sweden
Global
```

But the first implementation should still preserve the exact row keys above.

## Raw data model

Reuse `macro_observations` if it exists from another macro indicator. If not, create it.

Suggested table:

```sql
create table if not exists macro_observations (
  id bigserial primary key,
  series_key text not null,
  region text not null default 'global',
  source text not null,
  source_series_id text,
  period_date date not null,
  frequency text not null,
  value numeric,
  vintage_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(series_key, region, period_date, vintage_date)
);
```

If the table already exists without `region`, add `region` or encode region into `series_key`.

## Indicator output table

Create a monthly output table.

```sql
create table if not exists macro_matrix_pmi_growth_monthly (
  period_date date not null,
  region text not null default 'global',

  row_count integer not null,
  valid_row_count integer not null,
  positive_count integer not null,
  neutral_count integer not null,
  negative_count integer not null,

  percent_positive numeric,
  percent_negative numeric,
  pmi_growth_score numeric,

  manufacturing_pmi_score numeric,
  services_pmi_score numeric,
  manufacturing_services_spread numeric,
  leading_indicators_score numeric,
  broad_cycle_score numeric,
  trade_score numeric,
  consumption_score numeric,
  sentiment_score numeric,

  pmi_growth_regime text not null,
  pmi_growth_risk_action text not null,

  row_values jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  primary key (period_date, region)
);
```

## Row values JSON format

Each row stored in `row_values` should include:

```json
{
  "manufacturing_pmi_total": {
    "display_name": "Manufacturing PMI Total SA",
    "category": "manufacturing_pmi",
    "value": 55.0,
    "mom_change": -1.8,
    "yoy_change": null,
    "z_36m": 0.4,
    "direction_score": 0,
    "heatmap_score": 0.2,
    "color_bucket": "positive",
    "source": "TBD",
    "source_series_id": "TBD"
  }
}
```

## Transform rules

### 1. Monthly alignment

All series must be aligned to calendar month.

Rules:

- Monthly series: use the reported month.
- Weekly series: aggregate to monthly average.
- Quarterly series: forward-fill to each month inside the quarter, but mark frequency as quarterly.
- Missing values: null; do not forward-fill except for quarterly/slow survey data where explicitly allowed.

### 2. YoY calculation

For rows labeled `Y/Y`, compute:

```text
yoy_pct = ((value / value_12_months_ago) - 1) * 100
```

If the source already provides YoY, store source value as raw and use it as transformed value.

### 3. MoM change

For all rows:

```text
mom_change = current_transformed_value - previous_month_transformed_value
```

For PMI/index levels, this is point change.

### 4. Rolling z-score

For heatmap intensity:

```text
z_36m = (current_transformed_value - rolling_mean_36m) / rolling_std_36m
```

Minimum valid history:

```text
24 months
```

If fewer than 24 valid observations exist, z-score is null and heatmap intensity falls back to direction score.

## Direction scoring rules

### Higher-is-better rows

For most rows:

```text
if mom_change > 0: direction_score = +1
if mom_change = 0: direction_score = 0
if mom_change < 0: direction_score = -1
```

### PMI / diffusion index rows

For PMI rows and other 50-line diffusion indexes:

```text
if current >= 50 and mom_change > 0: direction_score = +1
if current >= 50 and mom_change <= 0: direction_score = 0
if current < 50 and mom_change > 0: direction_score = 0
if current < 50 and mom_change <= 0: direction_score = -1
```

Rationale:

- above 50 means expansion
- below 50 means contraction
- improving below 50 is less bad but not fully positive
- deteriorating while below 50 is strongly negative

### Consumer confidence / tendency indicators

For confidence and tendency indexes where 100 is neutral:

```text
if current >= 100 and mom_change > 0: direction_score = +1
if current >= 100 and mom_change <= 0: direction_score = 0
if current < 100 and mom_change > 0: direction_score = 0
if current < 100 and mom_change <= 0: direction_score = -1
```

If an index uses 0 as neutral instead of 100, use the source metadata to define neutral level.

### Trade rows

Exports:

```text
higher is better
```

Imports:

```text
if imports_yoy rises while retail_sales/external demand are stable: direction_score = +1
if imports_yoy falls and retail_sales/external demand fall: direction_score = -1
else: direction_score = 0
```

If no context rows are available, treat imports as higher-is-better in Phase 1.

## Heatmap score

Each row should receive a continuous score from -1 to +1.

Preferred:

```text
heatmap_score = clamp(z_36m / 2.0, -1, 1)
```

If z-score is null:

```text
heatmap_score = direction_score
```

## Color bucket rules

The calculation module should store the color bucket, not UI colors.

```text
heatmap_score >=  0.60 => strong_positive
heatmap_score >=  0.20 => positive
heatmap_score >  -0.20 => neutral
heatmap_score >  -0.60 => negative
heatmap_score <= -0.60 => strong_negative
```

Suggested UI colors:

```text
strong_positive = teal/blue
positive        = light teal
neutral         = white/light grey
negative        = light red
strong_negative = red
```

## Category scores

Compute category-level averages from direction scores.

```text
manufacturing_pmi_score = average(manufacturing_pmi rows)
services_pmi_score = average(services_pmi rows)
leading_indicators_score = average(leading_indicators + manufacturing_leading + services_leading rows)
broad_cycle_score = average(broad_cycle + construction rows)
trade_score = average(trade rows)
consumption_score = average(consumption + consumption_cyclical rows)
sentiment_score = average(consumer_sentiment rows)
```

## Manufacturing vs services spread

This is central to the reference image.

```text
manufacturing_services_spread = services_pmi_score - manufacturing_pmi_score
```

Interpretation:

```text
spread > 0.35  => services much stronger than manufacturing
spread > 0.10  => services stronger than manufacturing
spread between -0.10 and 0.10 => balanced
spread < -0.10 => manufacturing stronger than services
spread < -0.35 => manufacturing much stronger than services
```

## Overall score

For each month:

```text
pmi_growth_score = average(direction_score of all valid rows)
```

Missing rows are excluded from denominator.

```text
percent_positive = positive_count / valid_row_count * 100
percent_negative = negative_count / valid_row_count * 100
```

## Regime rules

Use deterministic buckets.

### Broad expansion

```text
if pmi_growth_score >= 0.35 and manufacturing_pmi_score >= 0 and services_pmi_score >= 0:
  pmi_growth_regime = "broad_expansion"
  pmi_growth_risk_action = "RISK_ON"
```

### Services-led expansion / manufacturing slowdown

This matches the image title: manufacturing PMI down, services PMI up.

```text
if manufacturing_pmi_score < 0 and services_pmi_score > 0:
  pmi_growth_regime = "services_led_expansion_manufacturing_slowdown"
  pmi_growth_risk_action = "NEUTRAL_TO_RISK_ON"
```

This regime is mixed: it is not a broad risk-off signal if services remain strong, but it warns that cyclical/manufacturing-sensitive assets may be weakening.

### Manufacturing-led recovery

```text
if manufacturing_pmi_score > 0 and services_pmi_score >= 0 and leading_indicators_score > 0:
  pmi_growth_regime = "manufacturing_recovery"
  pmi_growth_risk_action = "RISK_ON"
```

### Mixed neutral

```text
if pmi_growth_score > -0.10 and pmi_growth_score < 0.35:
  pmi_growth_regime = "mixed_neutral"
  pmi_growth_risk_action = "NEUTRAL"
```

### Broad slowdown

```text
if pmi_growth_score <= -0.10 and pmi_growth_score > -0.35:
  pmi_growth_regime = "growth_slowdown"
  pmi_growth_risk_action = "NO_NEW_BUYS"
```

### Broad contraction

```text
if pmi_growth_score <= -0.35 or (manufacturing_pmi_score < 0 and services_pmi_score < 0):
  pmi_growth_regime = "broad_pmi_contraction"
  pmi_growth_risk_action = "REDUCE_RISK"
```

### Severe PMI stress

```text
if pmi_growth_score <= -0.50 and percent_negative >= 70:
  pmi_growth_regime = "pmi_macro_stress"
  pmi_growth_risk_action = "GO_TO_CASH"
```

## Stock Signals integration

This indicator should act as a macro filter.

| PMI risk action | Effect on stock signals |
|---|---|
| RISK_ON | Allow normal buy/swing/position signals |
| NEUTRAL_TO_RISK_ON | Allow signals, but prefer services/defensive quality over cyclicals |
| NEUTRAL | Technical signals decide |
| NO_NEW_BUYS | Block weak buy signals; allow only strongest confirmations |
| REDUCE_RISK | Prefer reduce-risk/take-profit outputs; block new weak buys |
| GO_TO_CASH | Override most long signals; cash/risk-off posture |

## Fields to store

At minimum:

```text
period_date
region
pmi_growth_score
pmi_growth_percent_positive
pmi_growth_percent_negative
pmi_growth_regime
pmi_growth_risk_action
valid_row_count
positive_count
neutral_count
negative_count
manufacturing_pmi_score
services_pmi_score
manufacturing_services_spread
leading_indicators_score
broad_cycle_score
trade_score
consumption_score
sentiment_score
row_values_json
```

## Implementation architecture

Create the indicator as a separate module:

```text
lib/indicators/macro-matrix-pmi-growth.ts
```

Expected exported functions:

```ts
export function transformPmiMacroSeriesToMonthlyObservations(...): MacroObservation[]
export function calculateMacroMatrixPmiGrowth(...): MacroMatrixPmiGrowthResult[]
export function classifyPmiGrowthRegime(...): PmiGrowthClassification
```

Add tests:

```text
tests/indicators/macro-matrix-pmi-growth.test.ts
```

Add migration(s):

```text
db/migrations/XXX_add_macro_observations.sql
db/migrations/XXX_add_macro_matrix_pmi_growth_monthly.sql
```

If `macro_observations` already exists, do not duplicate it. Add only missing columns/indexes.

## Acceptance tests

Codex must add tests for:

1. Monthly alignment.
2. YoY calculation.
3. Higher-is-better scoring.
4. PMI 50-line scoring.
5. 100-neutral confidence/tendency scoring.
6. Manufacturing vs services spread.
7. Services-led expansion / manufacturing slowdown classification.
8. Broad expansion classification.
9. Broad contraction classification.
10. Missing rows excluded from denominator.
11. Heatmap bucket mapping.
12. Category score calculation.

## Example expected behavior

If manufacturing PMI rows are deteriorating while services PMI rows are improving:

```text
manufacturing_pmi_score = -0.67
services_pmi_score = 0.67
manufacturing_services_spread = 1.34
pmi_growth_regime = services_led_expansion_manufacturing_slowdown
pmi_growth_risk_action = NEUTRAL_TO_RISK_ON
```

If both manufacturing and services deteriorate:

```text
manufacturing_pmi_score = -0.67
services_pmi_score = -0.67
pmi_growth_regime = broad_pmi_contraction
pmi_growth_risk_action = REDUCE_RISK
```

If both manufacturing and services improve and broad score is strong:

```text
manufacturing_pmi_score = 0.67
services_pmi_score = 0.67
pmi_growth_score = 0.45
pmi_growth_regime = broad_expansion
pmi_growth_risk_action = RISK_ON
```

## Do not do in Phase 1

- Do not add Telegram alerts yet.
- Do not create ticker-level buy/sell signals from this indicator alone.
- Do not scrape paid/blocked PMI sources.
- Do not hard-code image values manually.
- Do not require all rows to be available before producing output.
- Do not alter the existing stock data-fetching pipeline.

## Codex task prompt

```text
Implement the Macro Matrix - PMI Growth Momentum indicator described in docs/indicators/macro-matrix-pmi-growth-momentum.md.

Create it as a separate module under lib/indicators/.

Build a monthly macro matrix from the listed PMI, leading indicator, tendency, trade, consumption, production, and confidence rows. Use free/API sources where possible. Store raw macro observations in macro_observations and computed monthly output in macro_matrix_pmi_growth_monthly.

Implement deterministic transforms: monthly alignment, YoY percent, MoM change, rolling 36-month z-score, direction_score, heatmap_score, color_bucket, category scores, manufacturing_pmi_score, services_pmi_score, manufacturing_services_spread, percent_positive, percent_negative, pmi_growth_score, pmi_growth_regime, and pmi_growth_risk_action.

Missing rows must be allowed and excluded from score denominators.

Add database migrations, tests, and pipeline integration. Do not add Telegram behavior. Do not add ticker-level buy/sell behavior from this indicator alone. Do not change the existing stock data-fetching pipeline.

When done, update this file status to implemented and include the implementation commit.
```

## Manual verification

After implementation, verify:

```text
Month:
Region:
Rows available:
Manufacturing PMI score:
Services PMI score:
Manufacturing-services spread:
Positive count:
Negative count:
Percent positive:
PMI growth score:
Regime:
Risk action:
Result:
```

Also visually compare generated matrix layout to:

```text
docs/indicators/pictures/Skärmbild_20221031_122103.png
```
