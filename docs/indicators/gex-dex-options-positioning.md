# Indicator: GEX/DEX Options Positioning Beta

## Status

Status: implemented
Implemented commit: Git history
TradingView verification: not applicable

## Purpose

This is an external, intraday context layer for the GammaLens GEX endpoint. It stores provider-calculated GEX/DEX strike distributions and turns them into non-directional states for the dashboard:

- `range`: positive gamma and spot inside the call/put walls
- `flip_risk`: spot is within 0.5 provider ATR of gamma flip
- `expansion`: negative gamma and spot outside the relevant wall
- `neutral` or `unknown`: no reliable contextual state

It deliberately does not emit a buy, sell, order, alert, or backtest strategy.

## Source

```text
GET https://gammalens-api.onrender.com/api/gex/{ticker}
```

The scheduled watchlist contains:

- configured base tickers, normally `SPY,QQQ`,
- the 30 active S&P 500 stocks with the highest average share volume over their latest 20 stored sessions.

The stock selection is recalculated from `stock_daily_prices` before every scheduled fetch, so the liquid-stock universe updates automatically rather than relying on a stale hard-coded list.

Configuration:

```powershell
$env:GEX_DEX_TICKERS="SPY,QQQ"
$env:GEX_DEX_TOP_VOLUME_LIMIT="30"
$env:GEX_DEX_TOP_VOLUME_LOOKBACK="20"
$env:GEX_DEX_FETCH_CONCURRENCY="4"
npm run fetch:gex-dex
```

Configured tickers are placed first and duplicates are removed. A provider failure for one stock is recorded as a partial failure and does not discard successful snapshots for the remaining tickers.

## Storage

Raw source snapshots are isolated in:

```text
gex_dex_source_snapshots
gex_dex_strike_snapshots
```

Derived contextual fields are isolated in:

```text
gex_dex_signal_snapshots
```

Every source row preserves provider timestamp, source URL, `stale`, `from_cache`, `data_quality`, `key_levels`, and the raw JSON payload.

## Commands

```bash
npm run db:migrate
npm run fetch:gex-dex
npm run calculate:gex-dex-signals
```

The dedicated `gex-dex-snapshots.yml` workflow runs these steps independently of `fetch:daily`.

## Limits and validation

- GammaLens reports a provider model, not observable dealer inventory. Treat levels as zones and context, not deterministic support/resistance.
- The provider API is the v1 dependency; no source SLA, raw chain, ticker-coverage guarantee, or historical replay contract is assumed by this implementation.
- Stored snapshots create future point-in-time history, but no historical GEX/DEX claim should be made before enough snapshots exist.
- The dashboard explicitly displays provider freshness. A stale snapshot yields `unknown`, never a directional state.
