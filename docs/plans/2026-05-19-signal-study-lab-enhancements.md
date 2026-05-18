# Signal Study Lab enhancements — 2026-05-19

## Goal

Improve `/signal-study-lab` so it better matches the intended dynamic signal-study workflow:

- choose return instrument and signal instrument separately
- test forward horizon studies with realistic entry delay
- test state-period studies with entry/exit delays and optional max hold
- reduce lookahead bias
- make overlapping events configurable
- make missing registry fields easier to see in the UI
- keep the existing `backtest-daily` strategy engine untouched

## What was changed

### Forward horizon studies

Updated `lib/utils/forward-return-study.js`.

Added:

- `entryDelayBars` support, defaulting to `1`
- entry-date and entry-price tracking per event
- returns are now calculated from `entry_date`, not directly from `signal_date`
- `minBarsBetweenEvents`
- `allowOverlappingEvents`
- basic best-horizon summary:
  - best average-return horizon
  - best median-return horizon
  - best win-rate horizon
  - worst average-return horizon

This means a signal detected on bar `T` can be entered on `T+1`, which is safer for signals only known after the bar has closed.

### State-period studies

Updated `lib/utils/state-period-study.js`.

Added:

- optional `maxHoldBars`
- exit now uses the earliest of:
  - normal state end + `exitDelayBars`
  - `entryIndex + maxHoldBars`
- state-period results include `maxHoldBars` in the result payload

This allows testing TF Sync-style periods both as:

- green start → green end
- green start → max hold, e.g. 20 or 60 bars

### Config validation

Updated `lib/utils/signal-study-config.js`.

Added validation/normalization for:

- forward `entryDelayBars`
- forward `minBarsBetweenEvents`
- forward `allowOverlappingEvents`
- state-period `maxHoldBars`

### Signal registry

Updated `lib/signal-registry/fields.js`.

Changed:

- `market.signal` possible options now include both `warning` and `risk_caution` so the registry does not block current/older market-signal values.

Added:

- `requiredColumns` support on registry fields
- `tf_sync.state` now declares the computed-state source columns:
  - `tf_sync_daily_green`
  - `tf_sync_weekly_green`
  - `tf_sync_intraday_green`
  - `tf_sync_daily_red`
  - `tf_sync_weekly_red`
  - `tf_sync_intraday_red`

### Field availability

Updated `lib/repositories/signal-studies.js` and `app/signal-study-lab/page.js`.

Added:

- `listSignalStudyFieldsWithAvailability`
- table/column availability checks for registry fields
- `/signal-study-lab` now receives fields with `isAvailable`, `tableExists`, and `missingColumns`

Important note: `requiredColumns` was added to the registry, but if this file later shows availability not reflecting those computed dependencies, check `buildFieldAvailability` in `lib/repositories/signal-studies.js` and ensure it includes `field.requiredColumns` when building the required-column list.

### Signal Study Lab UI

Updated `app/signal-study-lab/signal-study-lab-client.js`.

Added/exposed:

- clearer explanation of return instrument vs signal instrument
- forward `entryDelayBars`
- forward `minBarsBetweenEvents`
- forward `allowOverlappingEvents`
- state `maxHoldBars`
- forward result summary cards for best average return and best win rate
- forward event table now shows signal date/price and entry date/price
- state summary now shows max hold
- unavailable registry fields are filtered/disabled in selectors
- copy-config button for copying the current JSON payload

### Example configs

Updated:

- `studies/examples/breadth-cross-forward.json`
- `studies/examples/tf-sync-forward.json`
- `studies/examples/tf-sync-green-period.json`

Changes:

- forward examples now include `entryDelayBars`, `minBarsBetweenEvents`, and `allowOverlappingEvents`
- TF Sync examples now use `returnInstrument: SPY` and `signalInstrument: SPY` to avoid the confusing old example where AAPL signals were used to test SPY returns
- TF Sync state-period example includes `maxHoldBars: 60`

## Files touched

- `lib/utils/forward-return-study.js`
- `lib/utils/state-period-study.js`
- `lib/utils/signal-study-config.js`
- `lib/signal-registry/fields.js`
- `lib/repositories/signal-studies.js`
- `app/signal-study-lab/page.js`
- `app/signal-study-lab/signal-study-lab-client.js`
- `studies/examples/breadth-cross-forward.json`
- `studies/examples/tf-sync-forward.json`
- `studies/examples/tf-sync-green-period.json`

## What still should be checked next

1. Run the normal test/build commands locally or in GitHub Actions.
2. Open `/signal-study-lab` and verify the page compiles after the client refactor.
3. Run the three example studies from the UI:
   - `breadth_cross_above_50_forward`
   - `tf_sync_green_position75_breadth50`
   - `tf_sync_green_period_test`
4. If TF Sync fields show unavailable even after data exists, inspect `buildFieldAvailability` in `lib/repositories/signal-studies.js` and ensure it checks `field.requiredColumns` as intended.
5. Consider adding tests for:
   - forward entry delay
   - min bars between events
   - non-overlapping events
   - state-period max hold exits

## Important design note

Do not merge this into the existing `backtest-daily` strategy engine. This is a separate signal-study/event-study lab. The existing strategy engine should remain for equity curves and allocation strategies. This lab should answer questions like:

- what happens T+1 to T+60 after signal start?
- what happens from green start to green end?
- how does adding filters change the forward-return distribution?
