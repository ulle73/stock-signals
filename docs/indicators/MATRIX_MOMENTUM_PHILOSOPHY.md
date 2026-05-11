# Matrix Momentum Philosophy

## Why this file exists

The macro/volatility/breadth reference images in `docs/indicators/pictures/` are not meant to be read as simple static heatmaps where:

```text
blue = buy
red = sell
```

That interpretation is too shallow.

The core philosophy behind these models is:

```text
Markets care more about change than level.
Markets buy improvement before the data looks good.
Markets sell deterioration before the data looks bad.
```

In other words, the system must not only ask:

```text
Is macro strong or weak?
```

It must also ask:

```text
Is macro getting better or worse?
Is strength fading?
Is weakness improving?
Is the color transition changing direction?
```

This principle must be applied to every matrix-style indicator in this folder.

## Core rule

Every matrix indicator must store and use both:

```text
1. Level
2. Momentum / change / transition
```

Level answers:

```text
How strong or weak is this data point right now?
```

Momentum answers:

```text
Is it improving or deteriorating compared with prior periods?
```

The signal should come from the combination, not level alone.

## Color transition logic

The most important signal is often the change in color intensity.

### Strong data that starts fading

```text
dark_blue -> blue -> light_blue -> neutral
```

Interpretation:

```text
Data is still good, but momentum is deteriorating.
This can be an early warning before the headline level looks weak.
```

Possible signal language:

```text
strength_fading
top_warning
reduce_risk_watch
no_new_buys_if_confirmed
```

### Weak data that stops getting worse

```text
dark_red -> red -> light_red -> neutral
```

Interpretation:

```text
Data is still weak, but deterioration is slowing.
This can be an early bottoming process before the headline level looks good.
```

Possible signal language:

```text
deterioration_slowing
bottoming_process
early_recovery_watch
capitulation_recovery
```

### Positive acceleration

```text
neutral -> light_blue -> blue -> dark_blue
```

Interpretation:

```text
Data is improving and becoming broad/strong.
This is usually risk-on confirmation.
```

Possible signal language:

```text
improving
confirmed_recovery
risk_on
```

### Negative acceleration

```text
neutral -> light_red -> red -> dark_red
```

Interpretation:

```text
Data is deteriorating and weakness is spreading.
This is usually risk-off confirmation.
```

Possible signal language:

```text
deteriorating
confirmed_slowdown
reduce_risk
go_to_cash_if_broad
```

## Required fields for every matrix indicator

Every matrix-style indicator should include these fields, even if names are adapted to the specific indicator:

```text
level_score
momentum_score
score_change_1_period
score_change_3_periods
percent_positive
percent_positive_change_1_period
percent_positive_change_3_periods
percent_negative
percent_negative_change_1_period
color_bucket_current
color_bucket_previous
color_transition
momentum_state
regime
risk_action
```

Recommended color buckets:

```text
strong_positive
positive
neutral
negative
strong_negative
```

Recommended color transition values:

```text
strong_positive_to_positive
positive_to_neutral
neutral_to_positive
negative_to_neutral
strong_negative_to_negative
neutral_to_negative
positive_to_strong_positive
negative_to_strong_negative
unchanged_positive
unchanged_negative
unchanged_neutral
```

Recommended momentum states:

```text
accelerating_positive
positive_but_fading
neutral_improving
neutral_deteriorating
negative_but_improving
accelerating_negative
mixed
```

## Generic signal interpretation table

| Level | Momentum / transition | Interpretation | Preferred action |
|---|---|---|---|
| strong_positive | improving / still darkening blue | strong expansion | RISK_ON |
| strong_positive | fading / becoming lighter blue | late-cycle warning | HOLD / REDUCE_RISK_WATCH |
| positive | fading toward neutral | slowdown starting | NO_NEW_BUYS if confirmed |
| neutral | improving toward positive | early recovery | WATCH / RISK_ON if confirmed |
| neutral | deteriorating toward negative | early slowdown | NO_NEW_BUYS |
| negative | worsening / becoming darker red | confirmed deterioration | REDUCE_RISK |
| strong_negative | still worsening | stress / capitulation not complete | REDUCE_RISK / GO_TO_CASH |
| strong_negative | improving / becoming lighter red | possible bottoming process | EARLY_RECOVERY_WATCH |
| negative | improving toward neutral | recovery attempt | WATCH / selective BUY if confirmed |

## Important anti-rules

Do not implement these wrong simplifications:

```text
Do not assume blue always means buy.
Do not assume red always means sell.
Do not ignore whether the color is getting lighter or darker.
Do not classify weak data as bearish if the deterioration is clearly slowing.
Do not classify strong data as bullish if the strength is clearly fading.
```

## Correct mental model

Use this mental model across all matrix indicators:

```text
The market does not wait for macro to become good.
It often turns when bad data stops getting worse.

The market does not wait for macro to become bad.
It often weakens when good data stops getting better.
```

Therefore:

```text
from dark red to lighter red = potential early bottom
from dark blue to lighter blue = potential early top / protection signal
```

## Applies to these indicator docs

This philosophy applies directly to:

```text
docs/indicators/macro-matrix-us-high-frequency-growth-data.md
docs/indicators/macro-matrix-pmi-growth-momentum.md
docs/indicators/macro-matrix-europe-growth-indicators.md
docs/indicators/macro-matrix-global-manufacturing-pmi.md
docs/indicators/macro-matrix-growth-data-base-effects.md
docs/indicators/macro-matrix-sector-factor-regime-performance.md
docs/indicators/macro-matrix-equity-sector-style-regime-performance.md
docs/indicators/market-breadth-ma200-forward-return-signal-model.md
docs/indicators/implied-volatility-ratio-rvol-short-squeeze.md
```

## Specific notes by indicator type

### Macro growth matrices

For macro growth matrices, the model must distinguish:

```text
strong_and_accelerating
strong_but_fading
weak_and_deteriorating
weak_but_improving
```

This is more important than the raw value alone.

### PMI matrices

PMI above 50 but falling is not the same as PMI below 50 and falling.

```text
above_50_and_rising = expansion accelerating
above_50_but_falling = expansion cooling
below_50_but_rising = contraction easing / early recovery
below_50_and_falling = contraction worsening
```

### Base-effect matrices

When YoY data weakens during hard comparisons, confidence should be lower. The system must separate true deterioration from base-effect distortion.

### MA200 breadth model

Extremely weak breadth can be bullish if historical forward returns are strong. The 0-10% bucket must be treated as capitulation/bottoming potential, not automatic sell.

### IVOL/RVOL model

High implied volatility versus realised volatility means the market is nervous or hedged. It becomes bullish only when trend/range/RVOL confirms that the feared downside is not materialising.

## Codex implementation instruction

Any AI implementing matrix indicators must preserve this philosophy.

```text
For every matrix-style indicator, implement both level and momentum/transition logic. Do not generate signals from static color/level alone. Add tests proving that:

1. dark blue becoming lighter is treated as strength fading, not blindly bullish.
2. dark red becoming lighter is treated as deterioration slowing / possible bottoming, not blindly bearish.
3. neutral turning blue is treated as improvement.
4. neutral turning red is treated as deterioration.
5. signal labels and risk actions use both level and transition.
```
