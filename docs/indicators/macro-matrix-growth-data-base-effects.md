# Indicator: Macro Matrix - Growth Data Base Effects

## Status

Status: planned
Implemented commit: TBD
TradingView verification: not_applicable
Manual macro verification: pending

## Purpose

This indicator recreates a macro heatmap/matrix similar to the reference image:

```text
docs/indicators/pictures/Skärmbild_20221031_114934.png
```

The reference image title is:

```text
Tillväxtdata faller tillbaka
```

This is a growth-data momentum and base-effect matrix. It tracks whether growth data is accelerating or decelerating while explicitly separating true deterioration from YoY base-effect distortion.

The key question it answers is:

```text
Is growth data genuinely deteriorating, or is it falling back because comparisons are becoming harder?
```

It should be used as a medium/long-term macro regime filter in Stock Signals. It should not create direct ticker-level buy/sell signals alone.

## Recommended image rename

Current image:

```text
docs/indicators/pictures/Skärmbild_20221031_114934.png
```

Recommended future filename:

```text
docs/indicators/pictures/macro-matrix-growth-data-base-effects.png
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
growth_momentum
base_effects
regime_filter
```

## What the matrix shows

The matrix shows a broad macro growth heatmap across monthly data. It highlights two base-effect zones:

```text
Låg jämförelsetal
Höga jämförelsetal
```

The first zone means YoY data is compared against weak prior-year months, making growth easier to look strong.

The second zone means YoY data is compared against strong prior-year months, making growth harder to accelerate.

This indicator must therefore calculate both:

```text
growth momentum
base-effect regime
```

## Visual layout to recreate

The indicator should be renderable as a heatmap with:

- one row per macro growth series
- one column per monthly period
- optional quarter summary columns on the right
- final delta/change column on the far right
- bottom `% Positive Change MoM` row
- blue/teal for stronger/improving readings
- red for weaker/deteriorating readings
- grey/white for neutral/missing values
- optional visual annotations for easy and hard comparison periods

Do not hard-code image values. Use source data.

## Macro rows to implement

The reference image includes the following rows.

| Row key | Display name | Category | Direction rule |
|---|---|---|---|
| economic_tendency_indicator_total | Economic Tendency Indicator Total (NIER) | broad_cycle | higher is better |
| economic_tendency_indicator_construction | Economic Tendency Indicator Construction (NIER) | construction | higher is better |
| composite_leading_indicators_yoy | Composite Leading Indicators %Y/Y (OECD) | leading_indicators | higher is better |
| cli_manufacturing_order_books | CLI Manufacturing - Order Books (OECD) | manufacturing_leading | higher is better |
| cli_services_demand_expectations | CLI Services - Demand Expectations (OECD) | services_leading | higher is better |
| export_yoy | Export %Y/Y | trade | higher is better |
| import_yoy | Import %Y/Y | trade | higher is generally better, but context-dependent |
| industrial_production_mining_mfg_yoy | Industrial Production %Y/Y Mining & MFG %Y/Y | production | higher is better |
| new_motor_vehicle_registrations_yoy | New Motor Vehicle Registrations %Y/Y | cyclical_consumption | higher is better |
| retail_sales_ex_vehicles_yoy | Retail Sales excl. Vehicles %Y/Y | consumption | higher is better |
| consumer_confidence_survey_ki | Consumer Confidence Survey KI SA | sentiment | higher is better |
| manufacturing_pmi_total | Manufacturing PMI Total SA | manufacturing_pmi | PMI 50-line rule |
| manufacturing_pmi_new_orders | Manufacturing PMI New Orders SA | manufacturing_pmi | PMI 50-line rule |
| manufacturing_pmi_production | Manufacturing PMI Production SA | manufacturing_pmi | PMI 50-line rule |
| service_pmi_new_orders | Service PMI New Orders SA | services_pmi | PMI 50-line rule |
| service_pmi_business_activity | Service PMI Business Activity SA | services_pmi | PMI 50-line rule |
| service_pmi_total | Service PMI Total SA | services_pmi | PMI 50-line rule |

If duplicate service PMI rows appear in the image, store only unique series in the data model. The renderer may duplicate rows visually only if needed.

## Important geography note

The row labels include NIER and KI, which point to Swedish/Nordic macro sources, while OECD and PMI rows may have broader regional availability. This indicator should therefore support:

```text
region
country
source
```

Default implementation target for this reference image:

```text
region = sweden_or_nordic_growth_matrix
```

But the calculation model should be generic enough to support other regions later.

## Data source strategy

Use free/API sources where possible.

Priority order:

1. NIER/Konjunkturinstitutet/SCB/Riksbank/public Swedish sources for NIER/KI rows.
2. OECD API for composite leading indicators and CLI rows.
3. Eurostat or national statistics APIs for export/import/industrial production/retail sales/car registrations.
4. PMI public/free sources where available.
5. Manual placeholder source map with `source_status = missing` if a row is not fetchable in Phase 1.

Missing rows must not block the indicator. Missing rows are null and excluded from denominators.

## Raw data model

Reuse `macro_observations` if it already exists. If not, create it.

```sql
create table if not exists macro_observations (
  id bigserial primary key,
  series_key text not null,
  region text not null,
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
create table if not exists macro_matrix_growth_data_base_effects_monthly (
  period_date date not null,
  region text not null default 'sweden_or_nordic',

  row_count integer not null,
  valid_row_count integer not null,
  positive_count integer not null,
  neutral_count integer not null,
  negative_count integer not null,

  percent_positive numeric,
  percent_negative numeric,
  growth_momentum_score numeric,

  broad_cycle_score numeric,
  leading_indicators_score numeric,
  manufacturing_score numeric,
  services_score numeric,
  trade_score numeric,
  production_score numeric,
  consumption_score numeric,
  sentiment_score numeric,

  base_effect_score numeric,
  base_effect_regime text,
  confidence text,

  growth_base_effect_regime text not null,
  growth_base_effect_risk_action text not null,

  row_values jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  primary key (period_date, region)
);
```

## Transform rules

### Monthly alignment

All series must be aligned to month.

Rules:

- Monthly series: use reported month.
- Weekly series: aggregate to monthly average.
- Quarterly series: forward-fill to each month inside the quarter and mark as quarterly.
- Missing values: null and excluded from denominators.

### YoY transform

For rows labeled `Y/Y`, compute:

```text
yoy_pct = ((value / value_12_months_ago) - 1) * 100
```

If the source already provides YoY, store source raw value and use it as transformed value.

### MoM change

For all rows:

```text
mom_change = current_transformed_value - previous_month_transformed_value
```

For PMI and index levels, this is point change.

### Delta column

The visual delta column should show:

```text
delta = current_transformed_value - previous_month_transformed_value
```

### Rolling z-score

For heatmap intensity:

```text
z_36m = (current_transformed_value - rolling_mean_36m) / rolling_std_36m
```

Minimum valid history:

```text
24 months
```

If fewer than 24 observations exist, z-score is null and heatmap score falls back to direction score.

## Direction scoring rules

### Higher-is-better rows

```text
if mom_change > 0: direction_score = +1
if mom_change = 0: direction_score = 0
if mom_change < 0: direction_score = -1
```

### PMI rows

For PMI rows where 50 is expansion/contraction line:

```text
if current >= 50 and mom_change > 0: direction_score = +1
if current >= 50 and mom_change <= 0: direction_score = 0
if current < 50 and mom_change > 0: direction_score = 0
if current < 50 and mom_change <= 0: direction_score = -1
```

### Sentiment / tendency indicators

Each source row must define a neutral level.

For neutral level 100:

```text
if current >= 100 and mom_change > 0: direction_score = +1
if current >= 100 and mom_change <= 0: direction_score = 0
if current < 100 and mom_change > 0: direction_score = 0
if current < 100 and mom_change <= 0: direction_score = -1
```

For neutral level 0:

```text
if current >= 0 and mom_change > 0: direction_score = +1
if current >= 0 and mom_change <= 0: direction_score = 0
if current < 0 and mom_change > 0: direction_score = 0
if current < 0 and mom_change <= 0: direction_score = -1
```

### Import row special rule

Imports can be ambiguous. Phase 1 rule:

```text
if import_yoy rises and retail_sales/external demand are not falling: direction_score = +1
if import_yoy falls and retail_sales or industrial production also fall: direction_score = -1
else: direction_score = 0
```

If context rows are unavailable, treat imports as higher-is-better.

## Base-effect logic

This is central to the indicator.

For each YoY row:

```text
base_value_12m_ago = raw_value_12_months_ago
base_mom_12m_ago = raw_value_12_months_ago - raw_value_13_months_ago
base_effect_z_36m = (base_value_12m_ago - rolling_mean_36m_of_base_values) / rolling_std_36m_of_base_values
```

Classify base effect per row:

```text
base_effect_z_36m <= -0.75 => easy_base
base_effect_z_36m >=  0.75 => hard_base
otherwise => normal_base
```

Aggregate:

```text
base_effect_score = average(base_effect_z_36m across valid YoY rows)
```

Overall base-effect regime:

```text
if base_effect_score <= -0.75: base_effect_regime = "easy_comparisons"
if base_effect_score >= 0.75: base_effect_regime = "hard_comparisons"
else: base_effect_regime = "normal_comparisons"
```

Interpretation:

| Base-effect regime | Meaning |
|---|---|
| easy_comparisons | YoY growth can look artificially strong because prior-year base was weak |
| normal_comparisons | less base-effect distortion |
| hard_comparisons | YoY growth can look artificially weak because prior-year base was strong |

## Heatmap score

Preferred:

```text
heatmap_score = clamp(z_36m / 2.0, -1, 1)
```

If z-score is null:

```text
heatmap_score = direction_score
```

## Color bucket rules

Store bucket only, not UI colors.

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

```text
broad_cycle_score = average(broad_cycle + construction rows)
leading_indicators_score = average(leading_indicators + manufacturing_leading + services_leading rows)
manufacturing_score = average(manufacturing_pmi rows)
services_score = average(services_pmi rows)
trade_score = average(trade rows)
production_score = average(production rows)
consumption_score = average(consumption + cyclical_consumption rows)
sentiment_score = average(sentiment rows)
```

## Overall score

```text
growth_momentum_score = average(direction_score of all valid rows)
percent_positive = positive_count / valid_row_count * 100
percent_negative = negative_count / valid_row_count * 100
```

Missing rows are excluded from denominator.

## Regime rules

### Growth expansion improving

```text
if growth_momentum_score >= 0.35 and percent_positive >= 60:
  growth_base_effect_regime = "growth_expansion_improving"
  growth_base_effect_risk_action = "RISK_ON"
```

### Growth positive but base-effect risk

```text
if growth_momentum_score >= 0.10 and base_effect_regime = "easy_comparisons":
  growth_base_effect_regime = "growth_positive_easy_base"
  growth_base_effect_risk_action = "NEUTRAL_TO_RISK_ON"
```

### Growth falling due to hard comparisons

This matches the image title and description: growth data falls back because acceleration becomes hard due to high comparison figures.

```text
if growth_momentum_score <= -0.10 and base_effect_regime = "hard_comparisons":
  growth_base_effect_regime = "growth_falling_hard_base"
  growth_base_effect_risk_action = "NEUTRAL"
```

### Clean growth deterioration

```text
if growth_momentum_score <= -0.10 and base_effect_regime != "hard_comparisons":
  growth_base_effect_regime = "growth_deteriorating"
  growth_base_effect_risk_action = "NO_NEW_BUYS"
```

### Broad contraction

```text
if growth_momentum_score <= -0.35 or percent_negative >= 60:
  growth_base_effect_regime = "broad_growth_contraction"
  growth_base_effect_risk_action = "REDUCE_RISK"
```

### Macro stress

```text
if growth_momentum_score <= -0.50 and percent_negative >= 70:
  growth_base_effect_regime = "growth_macro_stress"
  growth_base_effect_risk_action = "GO_TO_CASH"
```

## Confidence logic

Base effects should change confidence, not fully override the signal.

```text
if base_effect_regime = "normal_comparisons": confidence = "normal"
if base_effect_regime = "easy_comparisons": confidence = "medium_positive_may_be_overstated"
if base_effect_regime = "hard_comparisons": confidence = "medium_negative_may_be_overstated"
```

## Stock Signals integration

This indicator is a growth/macro filter.

| Risk action | Effect on Stock Signals |
|---|---|
| RISK_ON | Allow normal buy/swing/position signals |
| NEUTRAL_TO_RISK_ON | Allow signals, but avoid over-weighting if easy-base confidence warning exists |
| NEUTRAL | Technical signals decide |
| NO_NEW_BUYS | Block weak buy signals |
| REDUCE_RISK | Prefer reduce-risk/take-profit outputs |
| GO_TO_CASH | Override most new long signals |

This indicator should especially affect:

```text
cyclicals
industrials
materials
small caps
banks
export-sensitive assets
Sweden/Nordic-sensitive equities
```

## Regime mapping to generic four-regime model

```text
growth_expansion_improving -> expansion
growth_positive_easy_base -> expansion with lower confidence
growth_falling_hard_base -> slowdown with lower confidence
growth_deteriorating -> slowdown
broad_growth_contraction -> contraction
growth_macro_stress -> contraction
```

If score momentum turns positive after contraction:

```text
broad_growth_contraction + improving score -> recovery
```

## Fields to store

At minimum:

```text
period_date
region
growth_momentum_score
growth_momentum_percent_positive
growth_momentum_percent_negative
growth_base_effect_regime
growth_base_effect_risk_action
valid_row_count
positive_count
neutral_count
negative_count
broad_cycle_score
leading_indicators_score
manufacturing_score
services_score
trade_score
production_score
consumption_score
sentiment_score
base_effect_score
base_effect_regime
confidence
row_values_json
```

## Row values JSON format

```json
{
  "manufacturing_pmi_total": {
    "display_name": "Manufacturing PMI Total SA",
    "category": "manufacturing_pmi",
    "region": "sweden_or_nordic",
    "value": 57.3,
    "mom_change": -3.5,
    "yoy_change": null,
    "z_36m": 0.42,
    "base_effect_z_36m": null,
    "direction_score": 0,
    "heatmap_score": 0.21,
    "color_bucket": "positive",
    "source": "TBD",
    "source_series_id": "TBD",
    "source_status": "active"
  }
}
```

For YoY rows include base effect:

```json
{
  "retail_sales_ex_vehicles_yoy": {
    "value": 4.8,
    "base_effect_z_36m": 1.1,
    "base_effect_bucket": "hard_base"
  }
}
```

## Implementation architecture

Create the indicator as a separate module:

```text
lib/indicators/macro-matrix-growth-data-base-effects.ts
```

Expected exported functions:

```ts
export function transformGrowthDataBaseEffectSeriesToMonthlyObservations(...): MacroObservation[]
export function calculateGrowthDataBaseEffectsMatrix(...): GrowthDataBaseEffectsMatrixResult[]
export function calculateBaseEffectRegime(...): BaseEffectClassification
export function classifyGrowthDataBaseEffectRegime(...): GrowthBaseEffectClassification
```

Add tests:

```text
tests/indicators/macro-matrix-growth-data-base-effects.test.ts
```

Add migration(s):

```text
db/migrations/XXX_add_macro_matrix_growth_data_base_effects_monthly.sql
```

If `macro_observations` already exists, reuse it and only add missing columns/indexes.

## Acceptance tests

Codex must add tests for:

1. Monthly alignment.
2. YoY calculation.
3. MoM change calculation.
4. PMI 50-line scoring.
5. Higher-is-better scoring.
6. Confidence/tendency neutral-level scoring.
7. Import context rule.
8. Rolling 36-month z-score.
9. Base-effect z-score.
10. Easy/normal/hard comparison classification.
11. Category score calculation.
12. Percent positive calculation.
13. Regime classification.
14. Confidence classification.
15. Missing rows excluded from denominator.
16. Color bucket mapping.

## Example expected behavior

If growth is falling but base effects are hard:

```text
growth_momentum_score = -0.20
base_effect_regime = hard_comparisons
growth_base_effect_regime = growth_falling_hard_base
growth_base_effect_risk_action = NEUTRAL
confidence = medium_negative_may_be_overstated
```

If growth is falling without hard-base distortion:

```text
growth_momentum_score = -0.25
base_effect_regime = normal_comparisons
growth_base_effect_regime = growth_deteriorating
growth_base_effect_risk_action = NO_NEW_BUYS
confidence = normal
```

If growth is strongly positive during easy comparisons:

```text
growth_momentum_score = 0.45
base_effect_regime = easy_comparisons
growth_base_effect_regime = growth_positive_easy_base
growth_base_effect_risk_action = NEUTRAL_TO_RISK_ON
confidence = medium_positive_may_be_overstated
```

## Do not do in Phase 1

- Do not add Telegram alerts yet.
- Do not create direct ticker-level buy/sell signals from this indicator alone.
- Do not hard-code values from the reference image.
- Do not require every row to be available.
- Do not scrape paid/blocked sources.
- Do not alter the existing stock data-fetching pipeline.

## Codex task prompt

```text
Implement the Macro Matrix - Growth Data Base Effects indicator described in docs/indicators/macro-matrix-growth-data-base-effects.md.

Create it as a separate module under lib/indicators/.

Build a monthly growth-data/base-effects matrix from the listed tendency, CLI, trade, production, consumption, confidence, manufacturing PMI, and services PMI rows. Use free/API sources where possible and create an explicit source map.

Implement deterministic transforms: monthly alignment, YoY percent, MoM change, rolling 36-month z-score, base-effect z-score, direction_score, heatmap_score, color_bucket, category scores, percent_positive, percent_negative, growth_momentum_score, base_effect_score, base_effect_regime, confidence, growth_base_effect_regime, and growth_base_effect_risk_action.

Missing rows must be allowed and excluded from score denominators.

Add database migrations, tests, and pipeline integration. Do not add Telegram behavior. Do not create ticker-level buy/sell behavior from this indicator alone. Do not change the existing stock data-fetching pipeline.

When done, update this file status to implemented and include the implementation commit.
```

## Manual verification

After implementation, verify:

```text
Month:
Region:
Rows available:
Positive count:
Negative count:
Percent positive:
Growth momentum score:
Base effect score:
Base effect regime:
Confidence:
Growth/base-effect regime:
Risk action:
Result:
```

Also visually compare generated matrix layout to:

```text
docs/indicators/pictures/Skärmbild_20221031_114934.png
```
