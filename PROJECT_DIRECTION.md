# PROJECT_DIRECTION.md

## Current north star

Stock Signals should be developed as a TradingView-like signal engine for the user's own market indicators.

The product goal is not primarily to be a backtesting platform.

The product goal is:

```text
Fetch market data → calculate many custom indicators → detect raw signals → route signal events → send alerts to the correct Telegram channel
```

The user has a multi-indicator TradingView setup with roughly 15 indicators/signals across different categories:

- short-term momentum
- medium-term swing
- long-term trend/regime
- market breadth
- macro/risk
- sector rotation
- other custom TradingView-style signals

This repo should gradually recreate those indicators in code so the system can alert automatically.

## Main product behavior

When an indicator signal triggers, the system should eventually create a signal event and route it to the correct Telegram group.

Examples:

```text
Momentum indicator triggered → momentum-signals Telegram group
Long-term regime indicator triggered → longterm-signals Telegram group
Macro/risk signal triggered → macro-signals or risk-signals Telegram group
Breadth signal triggered → breadth-signals Telegram group
Swing/sector signal triggered → swing-signals Telegram group
```

## Development priority

Build in this order:

1. Keep the data pipeline stable.
2. Add custom indicators one by one.
3. Store indicator values and raw signal fields.
4. Add a generic `signal_events` layer.
5. Add Telegram routing and delivery.
6. Only then improve dashboards, backtests, or advanced orchestration.

## What matters most

The system should make it easy to add one indicator at a time.

For each new TradingView-like indicator, capture:

- exact source series
- exact lookback periods
- exact formulas
- exact crossover/crossunder rules
- raw signal fields
- warmup requirements
- intended timeframe/category, if known

It is acceptable to add an indicator before deciding exactly how it will be used in Telegram.

In that case, calculate and store the raw indicator values and raw signal fields first.

## What to avoid

Avoid turning every indicator into a separate hardcoded strategy too early.

Avoid sending Telegram messages directly from indicator modules.

Avoid mixing many unrelated custom indicators into `lib/utils/rolling-indicators.js`.

Avoid large rewrites unless the user explicitly asks for them.

Avoid letting old phase-1 documentation override the current direction.

## Relationship to older docs

The original phase-1 documents focused on data foundation. That phase is mostly historical context now.

Current and future work should prioritize these files:

1. `AGENTS.md`
2. `PROJECT_DIRECTION.md`
3. `PRD_SIGNAL_ENGINE.md`
4. `IMPLEMENTATION_PLAN_SIGNAL_ENGINE.md`
5. `CODEX_TASK.md`
6. `INDICATOR_WARMUP_POLICY.md`
7. `DATA_FETCH_FREQUENCY.md`

Older files such as `PRD.md` and `IMPLEMENTATION_PLAN.md` may still be useful for data-foundation context, but they should not block new indicator/signal-engine work.

## Default source price rule

Unless the user explicitly says otherwise, custom indicator source price should be:

```js
adj_close ?? close
```

The user may still provide TradingView code that uses `close`; in this repo, preserve the same rules but default the price source to `adj_close ?? close` unless specifically told to match TradingView close exactly.

## Final product direction

The desired end state is a personal automated market signal system:

```text
Many indicators → categorized signal events → Telegram alerts by timeframe/category
```

Codex should keep the user on this path if a requested change risks making the system harder to extend indicator-by-indicator.
