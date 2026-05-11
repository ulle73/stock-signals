# Indicator: Macro Matrix - Global Manufacturing PMI

## Status

Status: planned
Implemented commit: TBD
TradingView verification: not_applicable
Manual macro verification: pending

## Purpose

This indicator recreates a macro heatmap/matrix similar to the reference image:

```text
docs/indicators/pictures/Skärmbild_20221031_115121.png
```

The reference image title is:

```text
Industri-PMI faller från höga nivåer
```

The purpose is to track global manufacturing PMI momentum across major regions and countries. It should identify when forward-looking manufacturing survey data is improving, cooling from elevated levels, or moving into contraction.

The key question it answers is:

```text
Is global manufacturing momentum improving, neutral, or deteriorating?
```

This is a macro regime filter for Stock Signals. It should not create direct single-stock buy/sell signals alone.

## Recommended image rename

Current image:

```text
docs/indicators/pictures/Skärmbild_20221031_115121.png
```

Recommended future filename:

```text
docs/indicators/pictures/macro-matrix-global-manufacturing-pmi.png
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
global
manufacturing_pmi
regime_filter
```

## What the matrix shows

The matrix shows monthly manufacturing PMI readings for:

- major global regions
- Eurozone countries
- Asian countries

Each block has a bottom row showing:

```text
% Positive Change M/M
```

That row measures how broad the monthly improvement is inside each region group.

The matrix is designed to identify:

```text
global manufacturing expansion
global manufacturing slowdown
regional divergence
broad manufacturing contraction
recovery from contraction
```

## Visual layout to recreate

The indicator should be renderable as a heatmap with:

- grouped sections: Major Regions, EuroZone, Asia
- one row per region/country
- one column per month
- final delta column on the far right
- bottom `% Positive Change M/M` row for each group
- blue/teal for stronger/improving PMI readings
- red for weaker/deteriorating PMI readings
- grey/white for neutral or missing values

Do not hard-code values from the image. Use source data.

## PMI rows to implement

### Major Regions

| Row key | Display name | Group | Direction rule |
|---|---|---|---|
| pmi_world | World | major_regions | PMI 50-line rule |
| pmi_us | US | major_regions | PMI 50-line rule |
| pmi_china | China | major_regions | PMI 50-line rule |
| pmi_eurozone | EuroZone | major_regions | PMI 50-line rule |

### Eurozone / Europe

| Row key | Display name | Group | Direction rule |
|---|---|---|---|
| pmi_denmark | Denmark | eurozone_europe | PMI 50-line rule |
| pmi_france | France | eurozone_europe | PMI 50-line rule |
| pmi_germany | Germany | eurozone_europe | PMI 50-line rule |
| pmi_greece | Greece | eurozone_europe | PMI 50-line rule |
| pmi_italy | Italy | eurozone_europe | PMI 50-line rule |
| pmi_netherlands | Netherlands | eurozone_europe | PMI 50-line rule |
| pmi_spain | Spain | eurozone_europe | PMI 50-line rule |
| pmi_sweden | Sweden | eurozone_europe | PMI 50-line rule |
| pmi_switzerland | Switzerland | eurozone_europe | PMI 50-line rule |

### Asia

| Row key | Display name | Group | Direction rule |
|---|---|---|---|
| pmi_india | India | asia | PMI 50-line rule |
| pmi_indonesia | Indonesia | asia | PMI 50-line rule |
| pmi_japan | Japan | asia | PMI 50-line rule |
| pmi_malaysia | Malaysia | asia | PMI 50-line rule |
| pmi_philippines | Philippines | asia | PMI 50-line rule |
| pmi_taiwan | Taiwan | asia | PMI 50-line rule |
| pmi_thailand | Thailand | asia | PMI 50-line rule |
| pmi_vietnam | Vietnam | asia | PMI 50-line rule |

## Data source strategy

Use free/API sources where possible.

Priority order:

1. FRED where PMI data exists.
2. OECD or World Bank style APIs if PMI/proxy series exist.
3. Official national PMI or statistics pages where stable public CSV/API exists.
4. S&P Global PMI public releases only if legally and technically accessible.
5. Manual placeholder source map with `source_status = missing` if a row is not available in Phase 1.

Do not block the indicator if some PMI rows are missing. Missing rows should be null and excluded from score denominators.

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
create table if not exists macro_matrix_global_manufacturing_pmi_monthly (
  period_date date primary key,

  row_count integer not null,
  valid_row_count integer not null,
  positive_count integer not null,
  neutral_count integer not null,
  negative_count integer not null,

  percent_positive numeric,
  percent_negative numeric,
  global_pmi_score numeric,

  major_regions_score numeric,
  eurozone_europe_score numeric,
  asia_score numeric,

  major_regions_percent_positive numeric,
  eurozone_europe_percent_positive numeric,
  asia_percent_positive numeric,

  global_pmi_regime text not null,
  global_pmi_risk_action text not null,

  row_values jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

## Transform rules

### Monthly alignment

All PMI series are monthly. Align every reading to calendar month.

Rules:

- Use reported month as `period_date`.
- If release date differs from period month, store release/vintage separately if available.
- Missing values: null and excluded from denominators.

### MoM change

```text
mom_change = current_pmi - previous_month_pmi
```

### Delta column

The far-right delta column in the visual should show:

```text
delta = current_pmi - previous_month_pmi
```

### Rolling z-score

For heatmap intensity:

```text
z_36m = (current_pmi - rolling_mean_36m) / rolling_std_36m
```

Minimum history:

```text
24 months
```

If fewer than 24 valid months exist, z-score is null and heatmap falls back to direction score.

## PMI 50-line direction rule

All rows use the PMI diffusion-index rule:

```text
if current_pmi >= 50 and mom_change > 0: direction_score = +1
if current_pmi >= 50 and mom_change <= 0: direction_score = 0
if current_pmi < 50 and mom_change > 0: direction_score = 0
if current_pmi < 50 and mom_change <= 0: direction_score = -1
```

Rationale:

- above 50 = expansion
- below 50 = contraction
- improving below 50 is less bad but not fully positive
- falling from high levels is cooling, not necessarily contraction
- falling below 50 is negative

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

## Group scores

For each group:

```text
group_score = average(direction_score of valid rows in group)
group_percent_positive = positive_count_in_group / valid_count_in_group * 100
```

Groups:

```text
major_regions
eurozone_europe
asia
```

## Overall score

```text
global_pmi_score = average(direction_score of all valid rows)
percent_positive = positive_count / valid_row_count * 100
percent_negative = negative_count / valid_row_count * 100
```

Missing rows are excluded from denominator.

## Regime rules

### Global manufacturing expansion

```text
if global_pmi_score >= 0.35 and percent_positive >= 60:
  global_pmi_regime = "global_manufacturing_expansion"
  global_pmi_risk_action = "RISK_ON"
```

### Cooling from high levels

This matches the image title: PMI falling from high levels.

```text
if global_pmi_score > -0.10 and percent_positive < 50:
  global_pmi_regime = "manufacturing_cooling_from_high_levels"
  global_pmi_risk_action = "NEUTRAL"
```

### Regional divergence

```text
if abs(major_regions_score - asia_score) >= 0.50 or abs(eurozone_europe_score - asia_score) >= 0.50:
  global_pmi_regime = "regional_pmi_divergence"
  global_pmi_risk_action = "NEUTRAL"
```

### Global manufacturing slowdown

```text
if global_pmi_score <= -0.10 and global_pmi_score > -0.35:
  global_pmi_regime = "global_manufacturing_slowdown"
  global_pmi_risk_action = "NO_NEW_BUYS"
```

### Broad manufacturing contraction

```text
if global_pmi_score <= -0.35 or percent_negative >= 60:
  global_pmi_regime = "broad_manufacturing_contraction"
  global_pmi_risk_action = "REDUCE_RISK"
```

### Global PMI stress

```text
if global_pmi_score <= -0.50 and percent_negative >= 70:
  global_pmi_regime = "global_pmi_stress"
  global_pmi_risk_action = "GO_TO_CASH"
```

## Stock Signals integration

This indicator is a global manufacturing macro filter.

| PMI risk action | Effect on stock signals |
|---|---|
| RISK_ON | Allow normal buy/swing/position signals |
| NEUTRAL | Technical signals decide; no macro boost |
| NO_NEW_BUYS | Block weak cyclical/manufacturing-sensitive buy signals |
| REDUCE_RISK | Prefer reduce-risk/take-profit outputs |
| GO_TO_CASH | Override most new long signals |

It should especially affect:

```text
industrials
materials
semiconductors
cyclicals
small caps
commodity-linked equities
export-sensitive markets
```

## Regime mapping to generic four-regime model

```text
global_manufacturing_expansion -> expansion
manufacturing_cooling_from_high_levels -> slowdown
regional_pmi_divergence -> slowdown
global_manufacturing_slowdown -> slowdown
broad_manufacturing_contraction -> contraction
global_pmi_stress -> contraction
```

If score momentum turns positive after contraction:

```text
broad_manufacturing_contraction + improving score -> recovery
```

## Fields to store

At minimum:

```text
period_date
global_pmi_score
global_pmi_percent_positive
global_pmi_percent_negative
global_pmi_regime
global_pmi_risk_action
valid_row_count
positive_count
neutral_count
negative_count
major_regions_score
eurozone_europe_score
asia_score
major_regions_percent_positive
eurozone_europe_percent_positive
asia_percent_positive
row_values_json
```

## Row values JSON format

```json
{
  "pmi_world": {
    "display_name": "World",
    "group": "major_regions",
    "value": 53.0,
    "mom_change": -0.7,
    "z_36m": 0.35,
    "direction_score": 0,
    "heatmap_score": 0.18,
    "color_bucket": "neutral",
    "source": "TBD",
    "source_series_id": "TBD",
    "source_status": "active"
  }
}
```

## Implementation architecture

Create the indicator as a separate module:

```text
lib/indicators/macro-matrix-global-manufacturing-pmi.ts
```

Expected exported functions:

```ts
export function transformGlobalPmiSeriesToMonthlyObservations(...): MacroObservation[]
export function calculateGlobalManufacturingPmiMatrix(...): GlobalManufacturingPmiMatrixResult[]
export function classifyGlobalManufacturingPmiRegime(...): GlobalManufacturingPmiClassification
```

Add tests:

```text
tests/indicators/macro-matrix-global-manufacturing-pmi.test.ts
```

Add migration(s):

```text
db/migrations/XXX_add_macro_matrix_global_manufacturing_pmi_monthly.sql
```

If `macro_observations` already exists, reuse it and only add missing columns/indexes.

## Acceptance tests

Codex must add tests for:

1. Monthly alignment.
2. MoM delta calculation.
3. PMI 50-line scoring.
4. Rolling 36-month z-score.
5. Heatmap score calculation.
6. Color bucket mapping.
7. Group percent positive calculation.
8. Overall percent positive calculation.
9. Regional divergence classification.
10. Cooling from high levels classification.
11. Broad contraction classification.
12. Missing rows excluded from denominator.
13. Risk action mapping.

## Example expected behavior

If most PMIs are still above 50 but falling:

```text
percent_positive = 29
global_pmi_score = -0.05
global_pmi_regime = manufacturing_cooling_from_high_levels
global_pmi_risk_action = NEUTRAL
```

If most PMIs are falling and below 50:

```text
percent_negative = 70
global_pmi_score = -0.55
global_pmi_regime = global_pmi_stress
global_pmi_risk_action = GO_TO_CASH
```

If most PMIs are improving above 50:

```text
percent_positive = 75
global_pmi_score = 0.50
global_pmi_regime = global_manufacturing_expansion
global_pmi_risk_action = RISK_ON
```

## Do not do in Phase 1

- Do not add Telegram alerts yet.
- Do not create direct ticker-level buy/sell signals from this indicator alone.
- Do not hard-code values from the image.
- Do not require every PMI row to be available.
- Do not scrape paid/blocked PMI sources.
- Do not alter the existing stock data-fetching pipeline.

## Codex task prompt

```text
Implement the Macro Matrix - Global Manufacturing PMI indicator described in docs/indicators/macro-matrix-global-manufacturing-pmi.md.

Create it as a separate module under lib/indicators/.

Build a monthly global manufacturing PMI matrix from the listed Major Regions, EuroZone/Europe, and Asia rows. Use free/API sources where possible and create an explicit source map.

Implement deterministic transforms: monthly alignment, MoM delta, rolling 36-month z-score, PMI 50-line direction_score, heatmap_score, color_bucket, group scores, group percent_positive, global_pmi_score, global_pmi_regime, and global_pmi_risk_action.

Missing rows must be allowed and excluded from score denominators.

Add database migrations, tests, and pipeline integration. Do not add Telegram behavior. Do not create ticker-level buy/sell behavior from this indicator alone. Do not change the existing stock data-fetching pipeline.

When done, update this file status to implemented and include the implementation commit.
```

## Manual verification

After implementation, verify:

```text
Month:
Rows available:
Major regions score:
Eurozone/Europe score:
Asia score:
Global percent positive:
Global PMI score:
Global PMI regime:
Risk action:
Result:
```

Also visually compare generated matrix layout to:

```text
docs/indicators/pictures/Skärmbild_20221031_115121.png
```
