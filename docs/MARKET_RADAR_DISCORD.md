# MARKET RADAR – Discord research panel (v1)

**Status:** isolated research implementation. No broker orders, position sizing, fund transactions, or automatic BUY/SELL rules. Deployment requires review and merge of the feature PR, a webhook secret, and successful tests.

## Goal

Make a single readable Discord overview of five questions: long-term trend, breadth, credit stress, macro direction and oversold/recovery situations to watch. The emphasis is on **changes** rather than one static heatmap or a single unvalidated score.

Existing reference files: docs/indicators/MATRIX_MOMENTUM_PHILOSOPHY.md, AVAILABLE_DATA.md and the Google Drive STOCK research log chapters 17–25.

## Inputs from existing Neon tables

| Domain | Source | Rule, as of v1 |
|---|---|---|
| Long trend | benchmark_daily_prices: SPY / QQQ | Last **completed** month close versus average of the last 10 completed month closes (SMA10). Also show current SPY distance to daily MA200. |
| Market breadth | market_breadth_daily | Percentage above SMA20/50/200, MA50 breadth change over five trading observations. Improvement >=+5 percentage points, deterioration <=-5pp. Valid breadth must match the latest SPY date exactly. |
| Credit | market_series_daily: BAMLH0A0HYM2 | HY OAS level and change over 20 source observations. Rising stress >=+0.20 percentage points; easing <=-0.20pp. Source must be <=5 calendar days older than the benchmark. |
| Growth proxy | market_series_daily: UNRATE, UMCSENT | Three-release change in unemployment and Michigan sentiment. Both are required to classify. PROVISIONAL macro proxy, not a full economic regime or historical point-in-time test. |
| Inflation proxy | market_series_daily: CPIAUCSL | Three-month annualized CPI compared with the prior three-month period. 0.5pp change threshold. Informational, not a trading rule. |
| Oversold watch | SPY daily closes | Wilder RSI(2)<=5 or drawdown from 252-session high<=-15%; with earlier RSI(2)<=10 and a 5-day breakout alongside breadth improvement mark recovery watch. NEVER an automatic BUY. |

**All thresholds are descriptive/watch heuristics, not proven trading edge.** Market macro readings come from revised FRED snapshots and may lag publication. Trading Economics PMI/Europe sources are deliberately EXCLUDED because retrieval month is mistakenly used as observation month in current source adapters.

## Discord behavior

- One main current-status message edited on every successful daily publish (no daily message spam). Pin it manually in Discord after first publishing.
- Additional notifications: trend state flip; entry into oversold/recovery watch; breadth and credit state changes only after TWO consecutive stored Radar observations.
- Weekly recap on Saturday UTC after US Friday data. Shows previous vs current climate and MA50 breadth change.
- Database tables market_radar_daily, market_radar_delivery and market_radar_alerts are isolated from existing order/execution and signal_events pipelines. Duplicate alert IDs are suppressed; failed webhook delivery remains pending for that report date. A process crash after successful Discord POST but before DB confirmation could lead to a retry duplicate.
- Safety gates: fail publishing on missing/stale SPY data (>4 calendar days) or missing/not-date-matched valid breadth. Unknown credit/macro displays as unknown, never presumed safe.
- The existing market_signal_daily can be stale; this panel computes separately from benchmark/breadth/series inputs.

## How to activate

1. Create a Discord text channel such as #market-radar.
2. Discord channel settings > Integrations > Webhooks > New webhook. Copy the webhook URL.
3. GitHub repository > Settings > Secrets and variables > Actions > New repository secret. Name: DISCORD_MARKET_RADAR_WEBHOOK_URL. Put the full URL there. Existing DATABASE_URL is reused. Never commit webhook credentials in the public repository.
4. Merge the reviewed PR after tests pass. The existing core fetch pipeline and any broker execution jobs are untouched.
5. GitHub Actions > Market Radar Discord (research only) > Run workflow > preview. This reads Neon only and applies no migration.
6. Review preview; then Run workflow > publish. Standard migrations create the three Radar tables and post the first status.
7. Pin that status message in Discord. Schedule runs at 02:15 UTC Tuesday–Saturday, after the existing 23:23 UTC US-market fetch.

Local Node 22 commands:
- npm run radar:preview
- npm run radar:publish
- node --test tests/market-radar.test.js

Publish requires DATABASE_URL, DISCORD_MARKET_RADAR_WEBHOOK_URL and migrated tables. Preview writes nothing.

## Research limitations / next step

RSI panic watches, macro improvement, credit and breadth alert colors are NOT approved portfolio-allocation or buy/sell decisions. SMA10 is a research baseline only; fund timing requires a separate point-in-time OOS test with cash return, NAV cutoffs and matched market exposure. Future improvements: full ALFRED vintages, corrected PMI reference periods, separate inflation-growth 4-quadrant research and cautious study of incremental economic predictive value. Do not add GO_TO_CASH automation from these labels.
