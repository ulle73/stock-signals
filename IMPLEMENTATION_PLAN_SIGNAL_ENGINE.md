# IMPLEMENTATION_PLAN_SIGNAL_ENGINE.md

## Purpose

This is the current implementation plan for evolving Stock Signals into a modular TradingView-like signal engine.

The previous phase-1 documents focused on data foundation. The current focus is adding custom indicators one by one and preparing them for Telegram alert routing.

## Guiding architecture

The target architecture is:

```text
fetch:daily
  → calculate:daily
  → custom indicator modules
  → raw signal fields
  → signal_events
  → send:telegram
```

## Phase A — Modular indicator foundation

Goal: make it safe and easy to add one custom indicator at a time.

Tasks:

1. Keep `lib/utils/rolling-indicators.js` as the base indicator layer.
2. Create `lib/indicators/` for custom TradingView-like indicators.
3. Add a clear adapter/merge pattern so custom indicator fields can be merged into rows saved in `stock_daily_indicators`.
4. Keep each custom indicator isolated in its own file.
5. Add tests per indicator.

Do not move every existing base indicator into separate files unless there is a strong reason.

## Phase B — Add indicators one by one

For each user-provided indicator:

1. Translate the indicator formula exactly.
2. Confirm the source series.
3. Use `adj_close ?? close` unless explicitly told otherwise.
4. Define warmup period.
5. Add database fields via migration.
6. Store raw values and raw signal booleans/text.
7. Add tests for calculation and signal behavior.
8. Update README only if scripts or user-facing commands change.

Example indicator implementation checklist:

```text
- lib/indicators/example-indicator.js
- db/migrations/XXX_add_example_indicator_fields.sql
- tests/example-indicator.test.js
- calculate:daily integration
- repository upsert update if new fields must be persisted
```

## Phase C — Generic signal_events layer

Goal: decouple raw indicator calculation from Telegram delivery.

Tasks:

1. Add a `signal_events` table.
2. Add repository functions:
   - `upsertSignalEvents(events)`
   - `getUnsentSignalEvents()`
   - `markSignalEventSent(id)`
3. Add a script to build signal events from raw indicator fields.
4. Ensure unique constraints prevent duplicate alerts.
5. Keep signal event creation separate from Telegram sending.

Recommended unique key:

```text
unique(date, ticker, signal_key)
```

## Phase D — Telegram sender

Goal: send unsent signal events to the correct Telegram channel.

Tasks:

1. Add environment variables:
   - `TELEGRAM_BOT_TOKEN`
   - `TELEGRAM_CHANNEL_MOMENTUM`
   - `TELEGRAM_CHANNEL_LONGTERM`
   - `TELEGRAM_CHANNEL_MACRO`
   - `TELEGRAM_CHANNEL_BREADTH`
   - `TELEGRAM_CHANNEL_RISK`
   - `TELEGRAM_CHANNEL_SWING`
2. Add `npm run send:telegram`.
3. Read unsent `signal_events`.
4. Route by `telegram_channel_key`.
5. Mark events as sent only after successful delivery.
6. Log errors without duplicating successful sends.

## Phase E — Scheduling

Final daily flow should be:

```bash
npm run fetch:daily
npm run calculate:daily
npm run calculate:signals
npm run build:signal-events
npm run send:telegram
```

Exact script names may differ, but the separation should remain:

```text
calculate indicators ≠ create event queue ≠ send Telegram
```

## What not to prioritize right now

Do not prioritize:

- large dashboard work
- backtest expansion
- intraday polling
- AI commentary
- auto-trading
- broker integrations

These can come later.

## Guardrail for Codex

If the user asks for something that would make the app harder to extend indicator-by-indicator, Codex should suggest a smaller modular implementation instead.

Default answer should be:

```text
Add the indicator as a module, store raw values/signals, decide routing later.
```
