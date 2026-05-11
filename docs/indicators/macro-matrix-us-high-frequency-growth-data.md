# Indicator: Macro Matrix - US High Frequency Growth Data

## Status

Status: planned
Implemented commit: TBD
TradingView verification: not_applicable
Manual macro verification: pending

## Purpose

This indicator recreates a macro heatmap/matrix similar to the reference image in `docs/indicators/pictures/Skärmbild_20221031_122310.png`.

It tracks a broad set of high-frequency US growth, activity, inflation, money, housing, sentiment, and labor-market data. The purpose is not to generate single-stock buy/sell signals directly. The purpose is to create a deterministic macro regime filter for the Stock Signals system.

The output should answer:

```text
Is the US macro growth backdrop improving, neutral, or deteriorating?
```

The matrix should be usable for medium/long-term market regime decisions such as:

```text
RISK_ON
NEUTRAL
RISK_OFF
NO_NEW_BUYS
REDUCE_RISK
GO_TO_CASH
```

## Reference image

```text
docs/indicators/pictures/Skärmbild_20221031_122310.png
```

Recommended future image filename:

```text
docs/indicators/pictures/macro-matrix-us-high-frequency-growth-data.png
```

## Visual layout to recreate

The indicator should be renderable as a matrix/heatmap with:

- one row per macro series
- one column per monthly period
- optional quarterly summary columns on the far right
- a final delta/change column
- blue/teal cells for positive/improving readings
- red cells for negative/deteriorating readings
- white/grey cells for neutral or missing data
- final bottom row showing `% Positive Change M/M`

The visual is a macro heatmap, not a price chart.

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
```

The indicator should update whenever new macro data is available. Daily pipeline can run it daily, but the underlying values are mostly monthly/weekly.

## Core concept

Each macro series is transformed into a comparable directional signal:

```text
improving = +1
neutral   =  0
deteriorating = -1
```

Then all series are aggregated into category scores and one overall macro growth score.

The final output should include:

```text
macro_growth_score
macro_growth_percent_positive
macro_growth_percent_negative
macro_growth_regime
macro_growth_risk_action
```

## Macro rows to implement

The reference image contains these rows. Implement these as the first version unless a source is unavailable.

| Row key | Display name | Category | Direction rule |
|---|---|---|---|
| exports_yoy | Exports Y/Y % | trade | higher is better |
| imports_yoy | Imports Y/Y % | trade | higher is better, but deterioration can signal weaker demand |
| industrial_production_yoy | Industrial Production Y/Y % | production | higher is better |
| retail_sales_food_services_yoy | Retail Sales & Food Services Y/Y % | consumption | higher is better |
| retail_sales_ex_motor_parts_yoy | Retail Sales Excl Motor Vehicles & Parts Y/Y % | consumption | higher is better |
| new_passenger_car_sales_yoy | Sales New Passenger Cars Y/Y % | consumption | higher is better |
| mortgage_purchase_index_yoy | Mortgage Purchase Index Y/Y % | housing | higher is better |
| nonfarm_payrolls_yoy | Non-Farm Payrolls Y/Y % | labor | higher is better |
| initial_jobless_claims_yoy | Initial Jobless Claims Y/Y % | labor | lower is better |
| business_inventories_yoy | Business Inventories Y/Y % | inventory | context-dependent; rising too fast can be negative |
| new_orders_durable_goods_yoy | New Orders Durable Goods Y/Y % | production | higher is better |
| capacity_utilization_rate | Capacity Utilization Rate | production | higher is better until overheating |
| pce_yoy | PCE Y/Y % | inflation | lower is better when inflation is elevated |
| core_pce_yoy | Core PCE Y/Y % | inflation | lower is better when inflation is elevated |
| personal_income_annualized_yoy | Personal Income (AR) Y/Y % | income | higher is better |
| personal_savings_pct_income | Personal Saving As % Of Disposable Income | consumer_balance_sheet | higher is better if not caused by recession fear |
| m2_money_supply_yoy | M2 Money Supply Y/Y % | liquidity | higher is more liquidity/risk supportive |
| m1_money_supply_yoy | M1 Money Supply Y/Y % | liquidity | higher is more liquidity/risk supportive |
| cli_leading_indicators_yoy | CLI / Conference Board Leading Indicators Y/Y % | leading_indicators | higher is better |
| ism_manufacturing_index | ISM Manufacturing Index | survey | higher is better; above 50 expansion |
| ism_manufacturing_new_orders | ISM Manufacturing New Orders | survey | higher is better; above 50 expansion |
| ism_non_manufacturing_index | ISM Non-Manufacturing / Services Index | survey | higher is better; above 50 expansion |
| manufacturers_inventories_yoy | Manufacturers Inventories Y/Y % | inventory | context-dependent |
| nahb_home_builders_index | NAHB Home Builders Index | housing | higher is better |
| nfib_small_business_optimism | NFIB Small Business Optimism Index | business_sentiment | higher is better |
| consumer_confidence_index | Consumer Confidence Index | consumer_sentiment | higher is better |
| economic_optimism_index | Economic Optimism Index | consumer_sentiment | higher is better |
| chicago_pmi | Chicago Purchasing Manager Index | regional_survey | higher is better; above 50 expansion |
| philadelphia_fed_business_activity | Philadelphia Fed Mfg: General Business Activity | regional_survey | higher is better |
| empire_state_mfg_survey | Empire State Mfg Survey | regional_survey | higher is better |

## Data source strategy

Use free sources where possible. Prefer API sources over scraping.

Priority order:

1. FRED API / downloadable CSV where a matching series exists.
2. Stooq, Nasdaq Data Link free datasets, government CSVs, or public agency pages where FRED does not cover a row.
3. Manual placeholder source map with `source_status = missing` for rows that cannot be fetched in Phase 1.

Do not block the whole indicator because one row is missing. Store missing series as null and exclude from score denominator.

## Suggested source map

These are implementation targets. Codex must verify exact series IDs before final implementation.

| Row key | Candidate source | Candidate series / note |
|---|---|---|
| exports_yoy | FRED | US exports of goods/services, monthly if available |
| imports_yoy | FRED | US imports of goods/services, monthly if available |
| industrial_production_yoy | FRED | INDPRO |
| retail_sales_food_services_yoy | FRED | RSAFS |
| retail_sales_ex_motor_parts_yoy | FRED | retail sales excluding motor vehicles/parts candidate |
| new_passenger_car_sales_yoy | FRED | vehicle sales candidate series |
| mortgage_purchase_index_yoy | FRED / MBA | MBA purchase applications index if available |
| nonfarm_payrolls_yoy | FRED | PAYEMS |
| initial_jobless_claims_yoy | FRED | ICSA, convert weekly to monthly average before YoY |
| business_inventories_yoy | FRED | BUSINV or equivalent |
| new_orders_durable_goods_yoy | FRED | DGORDER or equivalent |
| capacity_utilization_rate | FRED | TCU |
| pce_yoy | FRED | PCEPI or PCE price index equivalent |
| core_pce_yoy | FRED | PCEPILFE or equivalent |
| personal_income_annualized_yoy | FRED | PI or personal income equivalent |
| personal_savings_pct_income | FRED | PSAVERT |
| m2_money_supply_yoy | FRED | M2SL or WM2NS converted to monthly |
| m1_money_supply_yoy | FRED | M1SL or WM1NS converted to monthly |
| cli_leading_indicators_yoy | FRED / Conference Board / OECD | leading index candidate |
| ism_manufacturing_index | FRED / ISM | ISM manufacturing PMI candidate |
| ism_manufacturing_new_orders | FRED / ISM | ISM manufacturing new orders candidate |
| ism_non_manufacturing_index | FRED / ISM | ISM services/non-manufacturing candidate |
| manufacturers_inventories_yoy | FRED | manufacturers inventories candidate |
| nahb_home_builders_index | FRED / NAHB | NAHB housing market index candidate |
| nfib_small_business_optimism | FRED / NFIB | NFIB optimism index candidate |
| consumer_confidence_index | FRED / Conference Board | consumer confidence candidate |
| economic_optimism_index | FRED / IBD/TIPP | economic optimism candidate |
| chicago_pmi | FRED / ISM Chicago | Chicago PMI candidate |
| philadelphia_fed_business_activity | FRED | Philadelphia Fed general business activity candidate |
| empire_state_mfg_survey | FRED | Empire State manufacturing survey candidate |

## Raw data model

Create or reuse a generic macro observations table.

Suggested table:

```sql
create table if not exists macro_observations (
  id bigserial primary key,
  series_key text not null,
  source text not null,
  source_series_id text,
  period_date date not null,
  frequency text not null,
  value numeric,
  vintage_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(series_key, period_date, vintage_date)
);
```

If vintage tracking is not implemented in Phase 1, use `vintage_date = period_date` or null, but keep the field for later.

## Indicator output table

Create a monthly macro matrix output table.

```sql
create table if not exists macro_matrix_us_growth_monthly (
  period_date date primary key,

  row_count integer not null,
  valid_row_count integer not null,
  positive_count integer not null,
  neutral_count integer not null,
  negative_count integer not null,

  percent_positive numeric,
  percent_negative numeric,
  macro_growth_score numeric,

  trade_score numeric,
  consumption_score numeric,
  production_score numeric,
  housing_score numeric,
  labor_score numeric,
  inflation_score numeric,
  liquidity_score numeric,
  survey_score numeric,
  sentiment_score numeric,
  regional_survey_score numeric,
  leading_indicators_score numeric,

  macro_growth_regime text not null,
  macro_growth_risk_action text not null,

  row_values jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

`row_values` should contain each row with all computed values:

```json
{
  "industrial_production_yoy": {
    "value": 3.2,
    "mom_change": 0.4,
    "yoy_change": -1.1,
    "z_36m": 0.8,
    "direction_score": 1,
    "heatmap_score": 0.65,
    "category": "production"
  }
}
```

## Transform rules

### 1. Monthly alignment

All series must be aligned to calendar month.

Rules:

- Monthly series: use reported month.
- Weekly series: aggregate to monthly average unless otherwise specified.
- Quarterly series: forward-fill to each month inside the quarter, but mark `frequency = quarterly`.
- Missing values: use null, do not forward-fill unless explicitly marked as quarterly or slow-moving survey data.

### 2. Year-over-year transform

For rows labeled `Y/Y %`, compute:

```text
yoy_pct = ((value / value_12_months_ago) - 1) * 100
```

If the raw source already provides YoY percent, store both raw and transformed value where possible.

### 3. Month-over-month direction

For each row, compute:

```text
mom_change = current_transformed_value - previous_month_transformed_value
```

For weekly data aggregated monthly, compare current monthly average to previous monthly average.

### 4. Z-score normalization

For heatmap intensity, compute a rolling 36-month z-score:

```text
z_36m = (current_transformed_value - rolling_mean_36m) / rolling_std_36m
```

Use at least 24 valid months before producing z-score. If fewer than 24 observations exist, z-score is null and heatmap intensity should use simple direction only.

### 5. Direction score

Each row gets a deterministic direction score.

For `higher_is_better` rows:

```text
if mom_change > positive_threshold: direction_score = +1
if abs(mom_change) <= neutral_threshold: direction_score = 0
if mom_change < negative_threshold: direction_score = -1
```

For `lower_is_better` rows:

```text
if mom_change < negative_threshold: direction_score = +1
if abs(mom_change) <= neutral_threshold: direction_score = 0
if mom_change > positive_threshold: direction_score = -1
```

Default thresholds:

```text
neutral_threshold = 0.0
positive_threshold = 0.0
negative_threshold = 0.0
```

This means any improvement is positive and any deterioration is negative. Later versions may add per-series thresholds.

### 6. Inflation rows special rule

Inflation rows are special because higher inflation can be bad in an already elevated inflation regime.

For `pce_yoy` and `core_pce_yoy`:

```text
if current_yoy >= 3.0 and mom_change < 0: direction_score = +1
if current_yoy >= 3.0 and mom_change > 0: direction_score = -1
if current_yoy < 3.0 and current_yoy >= 1.0: direction_score = 0
if current_yoy < 1.0: direction_score = -1
```

Rationale:

- falling high inflation is macro/risk supportive
- rising high inflation is macro/risk negative
- very low inflation can indicate weak demand/deflation risk

### 7. Initial jobless claims special rule

Initial jobless claims are `lower_is_better`:

```text
if claims_yoy_change < 0: direction_score = +1
if claims_yoy_change > 0: direction_score = -1
else: direction_score = 0
```

### 8. ISM / PMI level rule

For ISM/PMI-style diffusion indexes:

```text
if current >= 50 and mom_change > 0: direction_score = +1
if current >= 50 and mom_change <= 0: direction_score = 0
if current < 50 and mom_change > 0: direction_score = 0
if current < 50 and mom_change <= 0: direction_score = -1
```

Rationale:

- above 50 = expansion
- below 50 = contraction
- improving below 50 is less bad but not fully positive

### 9. Inventory rows special rule

Inventory rows are context-dependent. In Phase 1 use simple neutral unless a clear deterioration is detected.

For business inventories and manufacturers inventories:

```text
if inventory_yoy is rising and retail_sales_yoy is falling: direction_score = -1
if inventory_yoy is falling and retail_sales_yoy is stable_or_rising: direction_score = +1
else: direction_score = 0
```

## Heatmap score

Each row should also get a continuous heatmap score from -1 to +1.

Preferred:

```text
heatmap_score = clamp(z_36m / 2.0, -1, 1)
```

Then adjust sign for lower-is-better rows:

```text
if lower_is_better: heatmap_score = heatmap_score * -1
```

If z-score is null:

```text
heatmap_score = direction_score
```

## Matrix color rules

Use these color buckets for UI rendering:

```text
heatmap_score >=  0.60 => strong_positive
heatmap_score >=  0.20 => positive
heatmap_score >  -0.20 => neutral
heatmap_score >  -0.60 => negative
heatmap_score <= -0.60 => strong_negative
```

Suggested colors:

```text
strong_positive = teal/blue
positive        = light teal
neutral         = white/light grey
negative        = light red
strong_negative = red
```

Do not hard-code UI colors inside calculation logic. Store color bucket only.

## Aggregation rules

### Overall score

For each month:

```text
macro_growth_score = average(direction_score of all valid rows)
```

Valid rows exclude null/missing rows.

### Percent positive

```text
percent_positive = positive_count / valid_row_count * 100
```

### Percent negative

```text
percent_negative = negative_count / valid_row_count * 100
```

### Category scores

For each category:

```text
category_score = average(direction_score of rows in that category)
```

Store each category score separately.

## Regime rules

Use deterministic buckets.

```text
if macro_growth_score >= 0.35 and percent_positive >= 60:
  macro_growth_regime = "expansion_improving"
  macro_growth_risk_action = "RISK_ON"

else if macro_growth_score >= 0.10 and percent_positive >= 50:
  macro_growth_regime = "growth_stable_positive"
  macro_growth_risk_action = "NEUTRAL_TO_RISK_ON"

else if macro_growth_score > -0.10:
  macro_growth_regime = "mixed_neutral"
  macro_growth_risk_action = "NEUTRAL"

else if macro_growth_score <= -0.10 and macro_growth_score > -0.35:
  macro_growth_regime = "growth_deteriorating"
  macro_growth_risk_action = "NO_NEW_BUYS"

else if macro_growth_score <= -0.35 or percent_negative >= 60:
  macro_growth_regime = "broad_macro_contraction"
  macro_growth_risk_action = "REDUCE_RISK"
```

Optional severe regime:

```text
if macro_growth_score <= -0.50 and percent_negative >= 70:
  macro_growth_regime = "macro_stress"
  macro_growth_risk_action = "GO_TO_CASH"
```

## Final signal mapping for Stock Signals

This indicator should not directly create ticker-level buy signals.

It should be consumed by the signal engine as a market/macro filter.

Suggested mapping:

| Macro risk action | Effect on stock signals |
|---|---|
| RISK_ON | Allow normal buy/swing/position signals |
| NEUTRAL_TO_RISK_ON | Allow signals but require normal technical confirmation |
| NEUTRAL | No macro boost; technical signals decide |
| NO_NEW_BUYS | Block weak/medium buy signals; allow only strongest setups |
| REDUCE_RISK | Prefer take-profit/reduce-risk outputs; block new buys |
| GO_TO_CASH | Override most long signals; cash/risk-off posture |

## Fields to store

At minimum:

```text
period_date
macro_growth_score
macro_growth_percent_positive
macro_growth_percent_negative
macro_growth_regime
macro_growth_risk_action
macro_growth_valid_row_count
macro_growth_positive_count
macro_growth_negative_count
macro_growth_neutral_count
macro_growth_row_values_json
trade_score
consumption_score
production_score
housing_score
labor_score
inflation_score
liquidity_score
survey_score
sentiment_score
regional_survey_score
leading_indicators_score
```

## Implementation architecture

Create the indicator as a separate module:

```text
lib/indicators/macro-matrix-us-growth.ts
```

Expected exported functions:

```ts
export function transformMacroSeriesToMonthlyObservations(...): MacroObservation[]
export function calculateMacroMatrixUsGrowth(...): MacroMatrixUsGrowthResult[]
export function classifyMacroGrowthRegime(...): MacroGrowthClassification
```

Add tests:

```text
tests/indicators/macro-matrix-us-growth.test.ts
```

Add migration(s):

```text
db/migrations/XXX_add_macro_observations.sql
db/migrations/XXX_add_macro_matrix_us_growth_monthly.sql
```

Add pipeline integration without changing existing stock data fetch behavior.

## Acceptance tests

Codex must add tests for:

1. YoY calculation.
2. Monthly alignment of weekly series.
3. Higher-is-better direction scoring.
4. Lower-is-better direction scoring.
5. Inflation special rule.
6. ISM/PMI special rule.
7. Inventory special rule.
8. Percent positive calculation.
9. Overall regime classification.
10. Missing rows excluded from denominator.

## Example expected behavior

If 20 of 30 rows are positive, 5 neutral, 5 negative:

```text
positive_count = 20
neutral_count = 5
negative_count = 5
valid_row_count = 30
percent_positive = 66.67
macro_growth_score = (20 - 5) / 30 = 0.50
macro_growth_regime = expansion_improving
macro_growth_risk_action = RISK_ON
```

If 8 of 30 rows are positive, 4 neutral, 18 negative:

```text
positive_count = 8
neutral_count = 4
negative_count = 18
valid_row_count = 30
percent_negative = 60.00
macro_growth_score = (8 - 18) / 30 = -0.33
macro_growth_regime = broad_macro_contraction
macro_growth_risk_action = REDUCE_RISK
```

## Do not do in Phase 1

- Do not add Telegram alerts yet.
- Do not create ticker-level buy/sell signals from this indicator alone.
- Do not scrape paid/blocked sources.
- Do not hard-code image values manually.
- Do not require all rows to be available before producing output.
- Do not alter the existing stock price fetch pipeline.

## Codex task prompt

```text
Implement the Macro Matrix - US High Frequency Growth Data indicator described in docs/indicators/macro-matrix-us-high-frequency-growth-data.md.

Create it as a separate module under lib/indicators/.

Build a monthly macro matrix from the listed US macro rows. Use free/API sources where possible, prioritizing FRED or downloadable public CSVs. Store raw macro observations in a generic macro_observations table and computed monthly output in macro_matrix_us_growth_monthly.

Implement deterministic transforms: monthly alignment, YoY percent, MoM change, rolling 36-month z-score, direction_score, heatmap_score, color_bucket, category scores, percent_positive, percent_negative, macro_growth_score, macro_growth_regime, and macro_growth_risk_action.

Missing rows must be allowed and excluded from score denominators.

Add database migrations, tests, and pipeline integration. Do not add Telegram behavior. Do not add ticker-level buy/sell behavior from this indicator alone. Do not change the existing stock data-fetching pipeline.

When done, update this file status to implemented and include the implementation commit.
```

## Manual verification

After implementation, verify:

```text
Month:
Rows available:
Positive count:
Negative count:
Percent positive:
Macro growth score:
Regime:
Risk action:
Result:
```

Also visually compare the generated matrix to the reference image layout:

```text
docs/indicators/pictures/Skärmbild_20221031_122310.png
```
