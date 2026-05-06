# Signal And Backtest Foundation Design

## Goal

Build a daily signal and backtest foundation that can:

- ingest a tradable `SPY` benchmark series with daily OHLCV,
- compute market-level divergence inputs from breadth + index data,
- backtest `long/cash` strategies against `SPY` buy-and-hold,
- support both combined regime rules and single-indicator rules,
- stay compatible with a later intraday pipeline without mixing timeframes.

## Locked Decisions

- Benchmark: `SPY adjusted close`
- Execution model: `signal on day T -> position from next trading day open`
- Out-of-market behavior: `cash = 0%`
- Trading friction: `0.05%` per entry and `0.05%` per exit
- Backtest scope v1: `long/cash`
- Rule coverage v1: both combined market rules and single-indicator rules
- Universe architecture: design for point-in-time constituents, but allow v1 runs against current constituents with an explicit bias flag
- Timeframe separation: daily and future intraday data live in separate tables and separate calculation pipelines

## Scope

### In Scope

- `SPY` benchmark ingestion and storage
- `market_signal_daily` as a one-row-per-date market state table
- divergence metrics and divergence statuses
- reproducible backtest runs and daily equity curves
- source verification against official/public reference surfaces

### Out Of Scope For This Phase

- Telegram delivery
- intraday candles
- short-selling
- portfolio construction across multiple stocks
- full point-in-time constituent history ingestion
- final `market_regime_score` formula if it is not yet defined

## Architecture

The system stays layered:

1. `fetch:daily`
   - fetches S&P 500 constituents
   - fetches S&P 500 stock prices
   - fetches `SPY` benchmark prices
   - fetches FRED macro/index series

2. `calculate:daily`
   - calculates per-ticker indicators in `stock_daily_indicators`
   - calculates `market_breadth_daily`

3. `calculate:signals`
   - joins breadth + FRED market series
   - computes daily market-state rows in `market_signal_daily`

4. `backtest:daily`
   - evaluates strategy definitions
   - turns signals into dated positions
   - calculates strategy and benchmark equity curves

Each layer produces durable tables. Later systems, including Telegram alerts, should read these durable layers instead of recalculating logic on the fly.

## Data Model

### 1. `benchmark_daily_prices`

Purpose: store a tradable daily `SPY` series separate from stock constituents.

Columns:

- `ticker`
- `date`
- `open`
- `high`
- `low`
- `close`
- `adj_close`
- `volume`
- `source`
- `created_at`
- `updated_at`

Key:

- unique `(ticker, date)`

Notes:

- v1 only needs `SPY`
- `adj_open` is derived at read time, not stored:
  - `adj_open = open * (adj_close / close)`
- storing raw `open` and `adj_close` is enough to support next-open execution on the same adjusted scale as the benchmark close series

### 2. `market_signal_daily`

Purpose: store one market-state row per trading date.

Columns:

- `date`
- `spx_close`
- `spx_3d_change`
- `spx_14d_change`
- `pct_above_50`
- `pct_above_50_3d_change`
- `pct_above_50_14d_change`
- `pct_above_200`
- `pct_above_200_14d_change`
- `ad_line`
- `ad_line_14d_change`
- `new_highs`
- `new_lows`
- `vix`
- `market_regime_score`
- `signal`
- `divergence_status`
- `short_divergence_status`
- `created_at`
- `updated_at`

Key:

- unique `date`

Notes:

- `spx_*` fields intentionally come from the `SP500` market series, not from `SPY`
- backtests can execute on `SPY` while signals are measured against the index
- `market_regime_score` and `signal` may remain `NULL` in v1 if the full scoring model is not yet locked

### 3. `strategy_definitions`

Purpose: define what a strategy means without hardcoding every backtest into one script branch.

Columns:

- `id`
- `code`
- `name`
- `description`
- `benchmark_symbol`
- `execution_model`
- `out_of_market_mode`
- `transaction_cost_bps`
- `universe_mode`
- `point_in_time_supported`
- `rule_source`
- `params_json`
- `is_active`
- `created_at`
- `updated_at`

Examples:

- `buy_and_hold_spy`
- `bearish_divergence_cash_v1`
- `pct_above_50_threshold_v1`
- `combined_regime_placeholder_v1`

### 4. `backtest_runs`

Purpose: version and audit each backtest execution.

Columns:

- `id`
- `strategy_id`
- `status`
- `started_at`
- `finished_at`
- `code_version`
- `signal_data_end_date`
- `benchmark_symbol`
- `execution_model`
- `out_of_market_mode`
- `transaction_cost_bps`
- `universe_mode`
- `point_in_time_supported`
- `rule_source`
- `params_json`
- `notes`
- `cagr`
- `max_drawdown`
- `sharpe`
- `sortino`
- `calmar`
- `turnover`
- `time_in_market_pct`
- `created_at`
- `updated_at`

### 5. `strategy_positions_daily`

Purpose: show exactly when a signal was seen and when a position actually became effective.

Columns:

- `run_id`
- `date`
- `signal_date`
- `effective_trade_date`
- `target_state`
- `applied_state`
- `trade_action`
- `reason_code`
- `created_at`

Key:

- unique `(run_id, date)`

### 6. `strategy_equity_daily`

Purpose: store the day-by-day performance path for the strategy and the benchmark.

Columns:

- `run_id`
- `date`
- `start_equity`
- `end_equity`
- `strategy_return_pct`
- `benchmark_return_pct`
- `cash_weight`
- `equity_weight`
- `transaction_cost_pct`
- `transaction_cost_amount`
- `drawdown_pct`
- `is_in_market`
- `created_at`

Key:

- unique `(run_id, date)`

## Signal Inputs And Definitions

### Time Windows

- `3d` means 3 trading sessions back
- `14d` means 14 trading sessions back
- `252d` means 252 trading sessions for 52-week highs/lows

### Breadth Inputs

- `pct_above_50` comes from `market_breadth_daily.pct_above_sma50`
- `pct_above_200` comes from `market_breadth_daily.pct_above_sma200`
- `new_highs` comes from `market_breadth_daily.new_highs_52w`
- `new_lows` comes from `market_breadth_daily.new_lows_52w`

### AD Line

The A/D line is cumulative:

- `ad_line[t] = ad_line[t-1] + (advancers[t] - decliners[t])`
- `ad_line_14d_change = ad_line[t] - ad_line[t-14]`

### Percent Change Conventions

- `spx_3d_change` and `spx_14d_change` are percentage returns
- `pct_above_50_3d_change`, `pct_above_50_14d_change`, and `pct_above_200_14d_change` are percentage-point changes, not percentage returns

## Divergence Rules

### Bearish Divergence Warning

Trigger when:

- `spx_14d_change > 1`
- `pct_above_50_14d_change < -5`

Status:

- `divergence_status = bearish_warning`

Strong confirmation when any of these also hold:

- `ad_line_14d_change < 0`
- `new_highs[t] < new_highs[t-14]`
- `vix[t] > vix[t-14]`

Status:

- `divergence_status = bearish_warning_strong`

### Bullish Divergence

Trigger when:

- `spx_14d_change < -1`
- `pct_above_50_14d_change > 5`

Status:

- `divergence_status = bullish_divergence`

### Short-Term Divergence Label

Negative short divergence:

- `spx_3d_change > 0`
- `pct_above_50_3d_change < 0`

Status:

- `short_divergence_status = short_negative`

Positive short divergence:

- `spx_3d_change < 0`
- `pct_above_50_3d_change > 0`

Status:

- `short_divergence_status = short_positive`

Otherwise:

- `divergence_status = none`
- `short_divergence_status = none`

## Backtest Execution Model

The signal series and benchmark series are intentionally separate.

- signals are computed from `SP500` + breadth + `VIXCLS`
- trading is executed on `SPY`

This is deliberate:

- `SPX` is the cleaner signal reference
- `SPY` is the tradable benchmark and execution vehicle

### Price Handling

To keep execution and benchmark returns on the same split-adjusted scale:

- `adj_open[t] = open[t] * (adj_close[t] / close[t])`

Daily return handling:

- `long -> long`
  - `adj_close[t] / adj_close[t-1] - 1`
- `cash -> long`
  - `adj_close[t] / adj_open[t] - 1 - entry_cost`
- `long -> cash`
  - `adj_open[t] / adj_close[t-1] - 1 - exit_cost`
- `cash -> cash`
  - `0`

This matches the approved execution model:

- signal observed after day `T` close
- action starts on day `T+1` open

## Verification Strategy

### Benchmark Source Verification

The `SPY` ingestion path should be checked against two external surfaces:

- Yahoo Finance historical data view or export guidance:
  - [Yahoo Finance historical data help](https://help.yahoo.com/kb/finance-app-for-ios/download-historical-data-yahoo-finance-sln2311.html)
- State Street official `SPY` page for recent market-price fields:
  - [State Street SPDR S&P 500 ETF Trust](https://www.ssga.com/us/en/intermediary/etfs/state-street-spdr-sp-500-etf-trust-spy)

Verification expectations:

- recent `close`, `high`, `low`, and `volume` should match the State Street page for the latest published day
- several sampled historical dates should match Yahoo Finance historical data rows
- splits and dividend adjustments should be reflected in `adj_close`

### Internal Verification

- unit tests for benchmark upserts
- unit tests for divergence logic
- unit tests for backtest math on entry/exit days
- integration tests for `calculate:signals`
- integration tests for `backtest:daily`
- one real production-like fetch verification for `SPY`

## Failure Handling

- stale `running` rows in signal/backtest run tables should be auto-failed on the next run, just like current fetch/calculation guards
- signal rows should only be written for dates where required breadth and market series exist
- missing `SPY` open/close rows should fail the backtest run rather than silently skipping execution

## Intraday Compatibility

Future intraday support should not reuse daily tables.

Planned future separation:

- `stock_intraday_prices`
- `benchmark_intraday_prices`
- `market_signal_intraday_30m`
- separate intraday backtest execution model

Daily and intraday data should share concepts, not tables.

## Recommended v1 Delivery Order

1. `SPY` benchmark storage and fetch
2. signal table and divergence calculation
3. strategy/backtest tables
4. backtest math and run script
5. workflow wiring and documentation

This order keeps the system auditable at every step and makes it possible to validate source correctness before strategy logic depends on it.
