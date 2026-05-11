# Indicator: Macro Matrix - Europe Growth Indicators

## Status

Status: planned
Implemented commit: TBD
TradingView verification: not_applicable
Manual macro verification: pending

## Purpose

This indicator recreates a macro heatmap/matrix similar to the reference image:

```text
docs/indicators/pictures/Skärmbild_20221031_115810.png
```

The reference image title is:

```text
Europa: Tillväxtindikatorer
```

This is a European growth momentum indicator. It tracks whether European macro growth data is improving or deteriorating across confidence, sentiment, leading indicators, PMI, trade, industrial production, retail sales, vehicle registrations, and services.

The key question it answers is:

```text
Is the European growth backdrop improving, neutral, or deteriorating?
```

It should be used as a medium/long-term macro regime filter in Stock Signals, not as a direct single-stock buy/sell indicator.

## Recommended image rename

Current image:

```text
docs/indicators/pictures/Skärmbild_20221031_115810.png
```

Recommended future filename:

```text
docs/indicators/pictures/macro-matrix-europe-growth-indicators.png
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
europe
growth_indicators
regime_filter
```

## What the matrix shows

The matrix is a heatmap of European growth indicators over time.

It highlights how growth data can look unusually strong or weak depending on base effects:

```text
low comparison period -> easier YoY growth comparisons
high comparison period -> harder YoY growth comparisons
```

The reference image explicitly marks two important base-effect zones:

```text
Låga jämförelsetal
Höga jämförelsetal
```

This indicator should therefore track not only current growth momentum, but also whether the YoY numbers are being helped or hurt by comparison effects.

## Visual layout to recreate

The matrix should be renderable as:

- one row per European macro series
- one column per monthly period
- optional quarter summary columns on the right
- final delta/change column on the far right
- bottom row: `% Positive Change M/M`
- blue/teal cells for positive/improving data
- red cells for negative/deteriorating data
- grey/white for neutral/missing data
- optional visual markers/annotations for low/high base-effect comparison periods

Do not hard-code the image values. Use source data.

## Macro rows to implement

The reference image includes these rows.

| Row key | Display name | Region | Category | Direction rule |
|---|---|---|---|---|
| industrial_confidence_indicator_eurozone | Industrial Confidence Indicator: EuroZone | eurozone | confidence | higher is better |
| consumer_confidence_indicator_eurozone | Consumer Confidence Indicator: EuroZone | eurozone | confidence | higher is better |
| economic_sentiment_indicator_eurozone | Economic Sentiment Indicator: EuroZone | eurozone | sentiment | higher is better |
| sentix_economic_sentiment_current | Sentix Economic Sentiment Current | europe | sentiment | higher is better |
| ifo_business_climate_germany | IFO Business Climate Exp: Germany | germany | business_climate | higher is better |
| zew_index_eurozone | ZEW Index: Euro Zone | eurozone | expectations | higher is better |
| zew_index_germany | ZEW Index: Germany | germany | expectations | higher is better |
| manufacturing_pmi_eurozone | Manufacturing PMI: Eurozone | eurozone | pmi | higher is better; above 50 expansion |
| non_manufacturing_pmi_eurozone | Non-Manufacturing PMI: EuroZone | eurozone | pmi | higher is better; above 50 expansion |
| retail_sales_yoy_eurozone | Retail Sales %Y/Y: EuroZone | eurozone | consumption | higher is better |
| new_passenger_car_registrations_eurozone | New Passenger Cars Registrations: Eurozone | eurozone | consumption_cyclical | higher is better |

If additional rows are visible in the source image after manual inspection, add them to the source map without changing the calculation model.

## Data source strategy

Use free/API sources where possible.

Priority order:

1. Eurostat API for Eurozone retail sales, industrial/consumer sentiment, and related data.
2. OECD API for composite leading indicators and confidence indicators.
3. FRED where it mirrors Eurozone/Germany data.
4. Official sources such as ZEW, ifo, Sentix, S&P Global PMI if free/public access exists.
5. Manual placeholder source map with `source_status = missing` if a row is not fetchable in Phase 1.

Do not block the whole indicator because one row is unavailable. Missing rows should be null and excluded from score denominators.

## Suggested source map

Codex must verify exact source IDs before implementation.

| Row key | Candidate source | Notes |
|---|---|---|
| industrial_confidence_indicator_eurozone | Eurostat / OECD / FRED | industrial confidence, euro area |
| consumer_confidence_indicator_eurozone | Eurostat / OECD / FRED | consumer confidence, euro area |
| economic_sentiment_indicator_eurozone | Eurostat / European Commission | ESI euro area |
| sentix_economic_sentiment_current | Sentix public releases | may require manual/missing source in Phase 1 |
| ifo_business_climate_germany | ifo / FRED / OECD | Germany business climate |
| zew_index_eurozone | ZEW | eurozone economic sentiment |
| zew_index_germany | ZEW | Germany economic sentiment |
| manufacturing_pmi_eurozone | S&P Global / FRED / Investing/public proxy | PMI manufacturing eurozone |
| non_manufacturing_pmi_eurozone | S&P Global / FRED / Investing/public proxy | PMI services/non-manufacturing eurozone |
| retail_sales_yoy_eurozone | Eurostat | retail trade YoY euro area |
| new_passenger_car_registrations_eurozone | ACEA / Eurostat | car registrations YoY |

## Raw data model

Reuse `macro_observations` if it already exists. If not, create it.

```sql
create table if not exists macro_observations (
  id bigserial primary key,
  series_key text not null,
  region text not null default 'eurozone',
  source text not null,
  source_series_id text,
  source_status text not null default 'active',
  period_date date not null,
  frequency text not null,
  value numeric,
  vintage_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(series_key, region, period_date, vintage_date)
);
```

Allowed `source_status`:

```text
active
missing
manual
unsupported
```

## Indicator output table

```sql
create table if not exists macro_matrix_europe_growth_monthly (
  period_date date primary key,

  row_count integer not null,
  valid_row_count integer not null,
  positive_count integer not null,
  neutral_count integer not null,
  negative_count integer not null,

  percent_positive numeric,
  percent_negative numeric,
  europe_growth_score numeric,

  confidence_score numeric,
  sentiment_score numeric,
  business_climate_score numeric,
  expectations_score numeric,
  pmi_score numeric,
  consumption_score numeric,

  base_effect_score numeric,
  base_effect_regime text,

  europe_growth_regime text not null,
  europe_growth_risk_action text not null,

  row_values jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

## Transform rules

### Monthly alignment

All series must be aligned to month.

Rules:

- Monthly series: use reported month.
- Weekly series: aggregate to monthly average.
- Quarterly series: forward-fill to each month inside the quarter and mark as quarterly.
- Missing values: null; exclude from score denominator.

### YoY transform

For rows labeled `Y/Y`, compute:

```text
yoy_pct = ((value / value_12_months_ago) - 1) * 100
```

If the source already provides YoY, store raw source value and use it as transformed value.

### MoM change

For all rows:

```text
mom_change = current_transformed_value - previous_month_transformed_value
```

For confidence/PMI/sentiment indexes, this is point change.

### Rolling z-score

For heatmap intensity:

```text
z_36m = (current_transformed_value - rolling_mean_36m) / rolling_std_36m
```

Minimum valid history:

```text
24 months
```

If fewer than 24 observations exist, z-score is null and heatmap intensity falls back to direction score.

## Direction scoring rules

### Higher-is-better rows

For most rows:

```text
if mom_change > 0: direction_score = +1
if mom_change = 0: direction_score = 0
if mom_change < 0: direction_score = -1
```

### PMI rows

For PMI rows where 50 is the expansion/contraction line:

```text
if current >= 50 and mom_change > 0: direction_score = +1
if current >= 50 and mom_change <= 0: direction_score = 0
if current < 50 and mom_change > 0: direction_score = 0
if current < 50 and mom_change <= 0: direction_score = -1
```

### Confidence/sentiment indicators

Some indicators use 0 as neutral, others use 100. The source map must define `neutral_level` per series.

For neutral level 0:

```text
if current >= 0 and mom_change > 0: direction_score = +1
if current >= 0 and mom_change <= 0: direction_score = 0
if current < 0 and mom_change > 0: direction_score = 0
if current < 0 and mom_change <= 0: direction_score = -1
```

For neutral level 100:

```text
if current >= 100 and mom_change > 0: direction_score = +1
if current >= 100 and mom_change <= 0: direction_score = 0
if current < 100 and mom_change > 0: direction_score = 0
if current < 100 and mom_change <= 0: direction_score = -1
```

## Base-effect logic

This indicator must calculate whether YoY growth data is being affected by easy or hard comparison periods.

For each YoY row:

```text
base_value_12m_ago = value_12_months_ago
base_mom_12m_ago = value_12_months_ago - value_13_months_ago
base_effect_z_36m = (base_value_12m_ago - rolling_mean_36m_of_base_values) / rolling_std_36m_of_base_values
```

Classify base effect:

```text
base_effect_z_36m <= -0.75 => easy_base
base_effect_z_36m >=  0.75 => hard_base
otherwise => normal_base
```

Aggregate:

```text
base_effect_score = average(base_effect_z_36m across YoY rows)
```

Overall base-effect regime:

```text
if base_effect_score <= -0.75: base_effect_regime = "easy_comparisons"
if base_effect_score >= 0.75: base_effect_regime = "hard_comparisons"
else: base_effect_regime = "normal_comparisons"
```

Interpretation:

- `easy_comparisons`: YoY growth can look artificially strong.
- `hard_comparisons`: YoY growth can look artificially weak.
- `normal_comparisons`: less base-effect distortion.

## Heatmap score

Each row should receive a continuous heatmap score from -1 to +1.

Preferred:

```text
heatmap_score = clamp(z_36m / 2.0, -1, 1)
```

If z-score is null:

```text
heatmap_score = direction_score
```

## Color bucket rules

Store color bucket only; do not hard-code UI colors in calculation logic.

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

Compute category-level averages:

```text
confidence_score = average(confidence rows)
sentiment_score = average(sentiment rows)
business_climate_score = average(business_climate rows)
expectations_score = average(expectations rows)
pmi_score = average(pmi rows)
consumption_score = average(consumption + consumption_cyclical rows)
```

## Overall score

```text
europe_growth_score = average(direction_score of all valid rows)
percent_positive = positive_count / valid_row_count * 100
percent_negative = negative_count / valid_row_count * 100
```

Missing rows are excluded from denominator.

## Regime rules

### Europe expansion improving

```text
if europe_growth_score >= 0.35 and percent_positive >= 60:
  europe_growth_regime = "europe_expansion_improving"
  europe_growth_risk_action = "RISK_ON"
```

### Europe stable positive

```text
if europe_growth_score >= 0.10 and percent_positive >= 50:
  europe_growth_regime = "europe_growth_stable_positive"
  europe_growth_risk_action = "NEUTRAL_TO_RISK_ON"
```

### Europe mixed neutral

```text
if europe_growth_score > -0.10 and europe_growth_score < 0.10:
  europe_growth_regime = "europe_mixed_neutral"
  europe_growth_risk_action = "NEUTRAL"
```

### Europe deteriorating

```text
if europe_growth_score <= -0.10 and europe_growth_score > -0.35:
  europe_growth_regime = "europe_growth_deteriorating"
  europe_growth_risk_action = "NO_NEW_BUYS"
```

### Europe contraction

```text
if europe_growth_score <= -0.35 or percent_negative >= 60:
  europe_growth_regime = "europe_broad_contraction"
  europe_growth_risk_action = "REDUCE_RISK"
```

### Europe macro stress

```text
if europe_growth_score <= -0.50 and percent_negative >= 70:
  europe_growth_regime = "europe_macro_stress"
  europe_growth_risk_action = "GO_TO_CASH"
```

## Base-effect adjustment note

Do not let base effects override the raw regime completely in Phase 1. Instead store base-effect fields and expose them to the signal engine.

Example interpretation:

```text
europe_growth_score positive + easy_comparisons = positive but lower confidence
europe_growth_score negative + hard_comparisons = negative but possible base-effect distortion
europe_growth_score negative + normal_comparisons = cleaner deterioration signal
```

Add confidence adjustment:

```text
if base_effect_regime != "normal_comparisons": confidence = "medium"
else confidence = "normal"
```

## Stock Signals integration

This indicator is a European macro filter.

| Europe risk action | Effect on stock signals |
|---|---|
| RISK_ON | Allow normal buy/swing/position signals for Europe-sensitive assets |
| NEUTRAL_TO_RISK_ON | Allow signals, but require normal technical confirmation |
| NEUTRAL | Technical signals decide |
| NO_NEW_BUYS | Block weak Europe-sensitive buy signals |
| REDUCE_RISK | Prefer reduce-risk/take-profit outputs in Europe-sensitive exposure |
| GO_TO_CASH | Override most new long signals in Europe-sensitive exposure |

It can also be used as input for regime mapping:

```text
europe_expansion_improving -> expansion
europe_growth_stable_positive -> expansion
europe_mixed_neutral with positive momentum -> recovery
europe_mixed_neutral with negative momentum -> slowdown
europe_growth_deteriorating -> slowdown
europe_broad_contraction -> contraction
europe_macro_stress -> contraction
```

## Fields to store

At minimum:

```text
period_date
europe_growth_score
europe_growth_percent_positive
europe_growth_percent_negative
europe_growth_regime
europe_growth_risk_action
valid_row_count
positive_count
neutral_count
negative_count
confidence_score
sentiment_score
business_climate_score
expectations_score
pmi_score
consumption_score
base_effect_score
base_effect_regime
row_values_json
```

## Row values JSON format

```json
{
  "manufacturing_pmi_eurozone": {
    "display_name": "Manufacturing PMI: Eurozone",
    "region": "eurozone",
    "category": "pmi",
    "value": 55.3,
    "mom_change": -1.0,
    "yoy_change": null,
    "z_36m": 0.45,
    "base_effect_z_36m": null,
    "direction_score": 0,
    "heatmap_score": 0.22,
    "color_bucket": "positive",
    "source": "TBD",
    "source_series_id": "TBD",
    "source_status": "active"
  }
}
```

## Implementation architecture

Create the indicator as a separate module:

```text
lib/indicators/macro-matrix-europe-growth.ts
```

Expected exported functions:

```ts
export function transformEuropeGrowthSeriesToMonthlyObservations(...): MacroObservation[]
export function calculateEuropeGrowthMatrix(...): EuropeGrowthMatrixResult[]
export function classifyEuropeGrowthRegime(...): EuropeGrowthClassification
export function calculateBaseEffectRegime(...): BaseEffectClassification
```

Add tests:

```text
tests/indicators/macro-matrix-europe-growth.test.ts
```

Add migration(s):

```text
db/migrations/XXX_add_macro_matrix_europe_growth_monthly.sql
```

If `macro_observations` already exists, reuse it and only add missing columns/indexes.

## Acceptance tests

Codex must add tests for:

1. Monthly alignment.
2. YoY calculation.
3. MoM change calculation.
4. Higher-is-better scoring.
5. PMI 50-line scoring.
6. Confidence/sentiment neutral-level scoring.
7. Rolling 36-month z-score.
8. Base-effect z-score.
9. Easy/base/hard comparison classification.
10. Category score calculation.
11. Percent positive calculation.
12. Regime classification.
13. Risk action mapping.
14. Missing rows excluded from denominator.
15. Color bucket mapping.

## Example expected behavior

If European indicators are broadly improving:

```text
positive_count = 8
negative_count = 2
valid_row_count = 11
percent_positive = 72.7
europe_growth_score = 0.55
europe_growth_regime = europe_expansion_improving
europe_growth_risk_action = RISK_ON
```

If European indicators are broadly deteriorating:

```text
positive_count = 2
negative_count = 8
valid_row_count = 11
percent_negative = 72.7
europe_growth_score = -0.55
europe_growth_regime = europe_broad_contraction
europe_growth_risk_action = REDUCE_RISK
```

If YoY growth looks weak but comparison periods are unusually hard:

```text
base_effect_regime = hard_comparisons
confidence = medium
```

## Do not do in Phase 1

- Do not add Telegram alerts yet.
- Do not create direct ticker-level buy/sell signals from this indicator alone.
- Do not hard-code image values.
- Do not require every macro row to be available.
- Do not scrape paid/blocked sources.
- Do not alter the existing stock data-fetching pipeline.

## Codex task prompt

```text
Implement the Macro Matrix - Europe Growth Indicators indicator described in docs/indicators/macro-matrix-europe-growth-indicators.md.

Create it as a separate module under lib/indicators/.

Build a monthly European growth matrix from the listed confidence, sentiment, business climate, expectations, PMI, retail sales, and vehicle registration rows. Use free/API sources where possible and create an explicit source map.

Implement deterministic transforms: monthly alignment, YoY percent, MoM change, rolling 36-month z-score, base-effect z-score, direction_score, heatmap_score, color_bucket, category scores, percent_positive, percent_negative, europe_growth_score, europe_growth_regime, europe_growth_risk_action, and base_effect_regime.

Missing rows must be allowed and excluded from score denominators.

Add database migrations, tests, and pipeline integration. Do not add Telegram behavior. Do not create ticker-level buy/sell behavior from this indicator alone. Do not change the existing stock data-fetching pipeline.

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
Europe growth score:
Base effect score:
Base effect regime:
Europe growth regime:
Risk action:
Result:
```

Also visually compare generated matrix layout to:

```text
docs/indicators/pictures/Skärmbild_20221031_115810.png
```
