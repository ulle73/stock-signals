# PRD_SIGNAL_ENGINE.md

## 1. Product overview

Stock Signals should evolve from a market data foundation into a TradingView-like signal engine.

The system should let the user add many custom indicators, including indicators originally built in TradingView/Pine Script, and calculate those indicators daily from stored market data.

The primary product goal is automatic signal detection and Telegram alerting.

Backtesting can remain available, but it is not the main product focus right now.

## 2. Core user problem

The user has a multi-indicator TradingView setup with many signals across timeframes and categories.

Manual monitoring is inefficient because:

- signals can trigger on different assets and dates
- different indicators belong in different timeframes
- different signal types should go to different Telegram groups
- TradingView-style logic needs to be reproducible in the app
- future indicators should be easy to add one by one

## 3. Product goal

Create a modular engine where each indicator can be added independently and eventually routed to Telegram.

Target flow:

```text
Data fetch → indicator calculation → raw signal detection → signal_events → Telegram sender
```

## 4. Indicator model

Each custom indicator should be implemented as a separate module under:

```text
lib/indicators/
```

Each module should define:

- indicator name/key
- source series
- lookback requirements
- calculation rules
- raw output fields
- raw signal rules
- tests for core behavior

Example output fields:

```text
ryd_obv
ryd_obv_zscore_80
ryd_obv_buy_signal
ryd_obv_sell_signal
ryd_obv_signal
```

## 5. Core/base indicators

The existing base indicator layer may stay in:

```text
lib/utils/rolling-indicators.js
```

It should continue to handle shared baseline calculations such as:

- SMA values
- daily returns
- average volume
- relative volume
- 52-week high/low distance

Do not put every new custom indicator into this file.

## 6. Source price rule

Unless explicitly instructed otherwise, source price for indicators should be:

```js
adj_close ?? close
```

If the user provides TradingView code using `close`, preserve the same indicator rules but use `adj_close ?? close` in this repo unless the user explicitly requests exact TradingView close matching.

## 7. Raw signals first

When adding a new indicator, start by storing raw values and raw signal fields.

Do not require the user to decide final Telegram routing immediately.

A valid early implementation for an indicator is:

```text
indicator values saved
raw buy/sell/alert booleans saved
no Telegram behavior yet
no new backtest strategy yet
```

## 8. Future signal event layer

The next architectural layer should be a generic `signal_events` table.

Purpose:

- normalize all raw indicator signals into one alert queue
- prevent duplicate Telegram messages
- store routing metadata
- track sent/unsent state

Recommended fields:

```text
id
date
ticker
signal_key
signal_name
signal_type
timeframe
direction
severity
category
telegram_channel_key
message
source_payload
sent_to_telegram
sent_at
created_at
unique(date, ticker, signal_key)
```

## 9. Telegram routing

Telegram should not be hardcoded inside indicator modules.

The future routing should work like this:

```text
indicator raw signal → signal_events row → Telegram sender → correct channel
```

Example routing:

```text
momentum → momentum-signals
longterm → longterm-signals
macro → macro-signals
breadth → breadth-signals
risk → risk-signals
swing → swing-signals
```

## 10. Non-goals right now

Do not prioritize these unless explicitly requested:

- full dashboard redesign
- complex backtesting expansion
- AI-generated market commentary
- intraday polling
- portfolio management
- brokerage execution
- auto-trading

## 11. Definition of done for a new indicator

A new indicator is complete when:

1. It has its own module under `lib/indicators/`, unless it is a tiny extension of core indicators.
2. It uses `adj_close ?? close` unless instructed otherwise.
3. It stores all needed output fields in the database.
4. It has a migration for new fields.
5. It has tests for formula and signal behavior.
6. It is called by the daily calculation pipeline.
7. It does not send Telegram messages directly.
8. It does not change backtest logic unless explicitly requested.

## 12. Product guardrail

If a future task risks making indicators harder to add one by one, Codex should point that out and suggest a modular alternative.

The system should stay easy to extend with more TradingView-like indicators over time.
