# GOALS.md

## Current goal

Stock Signals should become a personal TradingView-like signal engine.

The goal is to recreate the user's own multi-indicator TradingView setup inside this repo, calculate the indicators from stored market data, detect raw signals, and eventually send alerts to the correct Telegram group based on indicator category and timeframe.

The main product flow is:

```text
Fetch market data → calculate indicators → detect raw signals → create signal events → send Telegram alerts
```

Backtesting can exist, but it is not the main product focus right now.

## Product north star

The system should make it easy to add custom indicators one by one.

The user may provide TradingView/Pine Script indicators over time. Each one should be translated into a modular JavaScript indicator module and added to the daily calculation pipeline.

The final product should support roughly this model:

```text
Many indicators → categorized signals → Telegram alerts by channel
```

Example categories:

- momentum signals
- long-term signals
- swing signals
- macro signals
- breadth signals
- risk signals
- sector-rotation signals

## Development priorities

Current priorities are:

1. Keep the existing data pipeline stable.
2. Add custom indicators as isolated modules under `lib/indicators/`.
3. Store raw indicator values and raw signal fields.
4. Add a generic `signal_events` layer.
5. Add Telegram routing after signal events exist.
6. Improve dashboards/backtests later, only when they help the signal workflow.

## Important architecture principle

Do not turn every new indicator into a hardcoded strategy immediately.

A new indicator can be complete before Telegram routing is decided.

The correct first step for a new indicator is usually:

```text
calculate values → store raw signal fields → decide routing later
```

## Indicator source price rule

Unless explicitly instructed otherwise, indicator source price should be:

```js
adj_close ?? close
```

If the user provides TradingView code using `close`, preserve the same formula and signal rules, but use `adj_close ?? close` in this repo unless the user explicitly requests exact TradingView close matching.

## What not to prioritize right now

Do not prioritize these unless explicitly requested:

- full dashboard redesign
- complex backtest expansion
- intraday polling
- AI-generated market commentary
- auto-trading
- broker integrations
- Telegram sending directly from indicator modules

## Relationship to the original phase 1 goal

The original project goal was to build a stable data foundation for S&P 500 market data.

That foundation is still important, but it is no longer the only product goal.

Current work should follow:

1. `AGENTS.md`
2. `PROJECT_DIRECTION.md`
3. `PRD_SIGNAL_ENGINE.md`
4. `IMPLEMENTATION_PLAN_SIGNAL_ENGINE.md`
5. `CODEX_TASK.md`

Older data-foundation details remain useful context, but they should not block the current signal-engine direction.

## Guardrail for future work

If a requested change makes the system harder to extend indicator-by-indicator, suggest a smaller modular alternative.

The app should stay focused on becoming a clean, extensible market signal engine.
