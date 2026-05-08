# AGENTS.md

## Project direction

This repo should be treated as a TradingView-like signal engine.

The main pipeline is:

```text
Data → Core indicators → Custom indicator modules → Raw signals → Signal events → Telegram alerts
```

Backtesting exists, but it is not the main product focus right now.

## Data pipeline protection

The existing data foundation is considered working infrastructure.

Do not modify the data-fetching pipeline unless the user explicitly asks for a data-source, fetch, schema, or scheduling change.

For normal indicator work, do not change these areas:

- `scripts/fetch-daily.js`
- `lib/sources/`
- ticker fetching / S&P 500 constituent fetching
- Yahoo/FRED fetch logic
- existing data-fetch schedules
- existing raw price/market-series tables

When adding a new indicator, read from the existing stored data and extend the calculation layer instead of changing how raw data is fetched.

If a new indicator needs new raw data that is not currently available, state that clearly and propose the smallest possible data-fetch addition before changing the fetch pipeline.

## Indicator architecture

Do not put every new indicator directly into `lib/utils/rolling-indicators.js`.

`lib/utils/rolling-indicators.js` is the core/base indicator layer and should keep shared base calculations such as:

- SMA values
- daily returns
- average volume
- relative volume
- 52-week high/low distance

New custom TradingView-like indicators should be added as separate modules under:

```text
lib/indicators/
```

Example:

```text
lib/indicators/ryd-obv-zscore.js
lib/indicators/momentum-shift.js
lib/indicators/longterm-trend.js
```

Each custom indicator module should:

- take sorted price rows for one ticker
- calculate its own values
- return fields that can be merged into `stock_daily_indicators`
- keep its own signal logic isolated
- include tests for its calculation and signal rules

## Source price rule

Unless explicitly instructed otherwise, indicator source price should be:

```js
adj_close ?? close
```

This is the default price source for indicator calculations.

## Signal design

For now, new indicators should only create raw indicator values and raw signal fields.

Do not add Telegram behavior unless explicitly requested.

Do not add new backtest strategies unless explicitly requested.

Do not change existing backtest logic unless required by the task.

## Raw signal fields

When adding a new indicator, prefer fields like:

```text
indicator_value
indicator_signal
indicator_buy_signal
indicator_sell_signal
```

For example:

```text
ryd_obv
ryd_obv_zscore_80
ryd_obv_buy_signal
ryd_obv_sell_signal
ryd_obv_signal
```

## Future alert architecture

Later, Telegram should be built through a generic `signal_events` layer.

Indicators should not send Telegram messages directly.

The future flow should be:

```text
indicator raw signal → signal_events row → Telegram sender
```

## Development rules

- Keep the existing data-fetching pipeline stable.
- Keep new indicators modular.
- Avoid large rewrites.
- Do not mix many unrelated indicators into one file.
- Add migrations for new database fields.
- Add tests for each indicator.
- Update README only when commands, setup, or user-facing behavior changes.
