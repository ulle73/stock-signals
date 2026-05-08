# Indicator intake docs

This folder is the intake area for TradingView/Pine Script indicators that should be recreated in Stock Signals.

Each indicator should get its own `.md` file in this folder before code is implemented.

The purpose is to preserve:

- the original TradingView/Pine Script code
- the intended source price
- the exact formula rules
- the exact signal rules
- the expected database fields
- the Codex implementation task
- the manual verification step against TradingView

## Workflow

1. Add a new indicator intake `.md` file in `docs/indicators/`.
2. Paste the original TradingView/Pine Script code into that file.
3. Define the source price rule for this repo.
4. Define what raw values and raw signal fields should be stored.
5. Ask Codex to implement the indicator as a module under `lib/indicators/`.
6. Codex should add migration(s), tests, and pipeline integration.
7. Codex should mark the intake doc as implemented after tests pass.
8. The user should manually verify at least one signal date/value against TradingView.
9. After user verification, mark the doc as verified.

## Standard implementation instruction

Use this for each indicator unless the individual file says otherwise:

```text
Implement this indicator as a separate module under lib/indicators/.
Preserve the indicator formula and signal rules from the original TradingView/Pine Script code.
Use adj_close ?? close as the source price unless this indicator doc explicitly says otherwise.
Store raw indicator values and raw signal fields first.
Do not add Telegram behavior yet.
Do not add a new backtest strategy unless explicitly requested.
Do not change the data-fetching pipeline.
Add database migration(s), tests, and calculate:daily integration.
After implementation, mark this doc as implemented and ask the user to verify at least one signal against TradingView.
```

## Status values

Use this status block in each indicator file:

```text
Status: planned | implemented | user_verified
Implemented commit: TBD
TradingView verification: pending | passed
```

## Template

```md
# Indicator: NAME

## Status

Status: planned
Implemented commit: TBD
TradingView verification: pending

## Purpose

Short description of what this indicator does and which category/timeframe it probably belongs to.

## Source price rule for this repo

Default:

```js
adj_close ?? close
```

## Original TradingView/Pine Script code

```pinescript
PASTE ORIGINAL CODE HERE
```

## Exact rules to implement

- Rule 1
- Rule 2
- Rule 3

## Fields to store

```text
example_value
example_buy_signal
example_sell_signal
example_signal
```

## Codex task prompt

```text
Implement this indicator as a separate module under lib/indicators/.
Preserve the formula and signal rules exactly as described in this file.
Use adj_close ?? close as source unless explicitly stated otherwise.
Store raw values and raw signal fields.
Do not add Telegram behavior.
Do not add backtest logic unless explicitly requested.
Do not change the data-fetching pipeline.
Add migration, tests, and calculate:daily integration.
When done, update this file status to implemented and ask the user to verify one signal against TradingView.
```

## Manual TradingView verification

After implementation, verify at least one ticker/date against TradingView:

```text
Ticker:
Date:
TradingView value:
Repo value:
TradingView signal:
Repo signal:
Result:
```
```
