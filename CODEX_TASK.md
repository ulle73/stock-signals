# CODEX_TASK.md

## Current task direction

This repo is no longer only a phase-1 data-foundation project.

The current goal is to evolve Stock Signals into a modular TradingView-like signal engine.

The main product flow is:

```text
market data → core indicators → custom indicator modules → raw signals → signal_events → Telegram alerts
```

Backtesting exists, but it is not the main product focus right now.

## Read these files first

Before coding, read these files in this order:

1. `AGENTS.md`
2. `PROJECT_DIRECTION.md`
3. `PRD_SIGNAL_ENGINE.md`
4. `IMPLEMENTATION_PLAN_SIGNAL_ENGINE.md`
5. `INDICATOR_WARMUP_POLICY.md`
6. `DATA_FETCH_FREQUENCY.md`
7. `README.md`

Older files such as `PRD.md`, `GOALS.md`, and `IMPLEMENTATION_PLAN.md` describe the original data-foundation phase. They are useful context, but they should not override the current signal-engine direction.

## Data pipeline protection

The existing data-fetching pipeline is working infrastructure.

Do not change it during normal indicator work.

For indicator tasks, do not modify:

- `scripts/fetch-daily.js`
- `lib/sources/`
- Yahoo/FRED fetch logic
- S&P 500 constituent fetching
- existing raw price/market-series schemas
- existing GitHub Actions fetch schedule

New indicators should use already stored data whenever possible.

If an indicator requires data that is not currently stored, report the missing data and propose the smallest possible fetch/schema addition before touching the data pipeline.

## Core rule

When adding a new TradingView-like indicator:

1. Add it as a separate module under `lib/indicators/`.
2. Do not put every new indicator into `lib/utils/rolling-indicators.js`.
3. Store raw indicator values and raw signal fields first.
4. Do not add Telegram behavior unless explicitly requested.
5. Do not add a new backtest strategy unless explicitly requested.
6. Do not make large rewrites unless necessary.
7. Do not alter the data-fetching pipeline unless explicitly requested.

## Indicator source price

Unless the user explicitly instructs otherwise, use:

```js
adj_close ?? close
```

If the user provides TradingView/Pine Script using `close`, preserve the same rules and formulas, but default the source price to `adj_close ?? close` in this repo unless the user asks for exact TradingView close matching.

## Preferred new indicator shape

Each new custom indicator should have:

```text
lib/indicators/{indicator-name}.js
tests/{indicator-name}.test.js
db/migrations/XXX_add_{indicator_name}_fields.sql
```

The indicator should return fields that can be merged into `stock_daily_indicators`.

Example raw fields:

```text
ryd_obv
ryd_obv_zscore_80
ryd_obv_buy_signal
ryd_obv_sell_signal
ryd_obv_signal
```

## Desired development order

Build in this order:

1. Keep existing data pipeline stable.
2. Add custom indicators one by one.
3. Store raw values and raw signals.
4. Add generic `signal_events` layer.
5. Add Telegram routing.
6. Improve dashboard/backtests later only when useful.

## Guardrail

If a requested change would make it harder to add indicators one by one, suggest a smaller modular alternative.

Default recommendation should be:

```text
Add the indicator as a module, store raw values/signals, decide routing later.
```

## Do not prioritize unless explicitly requested

- Data-fetch rewrites.
- Full dashboard redesign.
- Complex backtest expansion.
- Intraday polling.
- AI-generated commentary.
- Auto-trading or broker integrations.
- Telegram sending directly from indicator modules.

## When a task is complete

Report:

- which files changed
- which migration was added
- which indicator fields were added
- how to run the calculation
- how tests were added or updated
- any assumptions about source price, warmup, or signal rules
- whether the data pipeline was left untouched
