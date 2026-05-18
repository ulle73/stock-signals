# Stock Signals

Ett framtida marknadsbreddsbaserat signalsystem för S&P 500.

Första versionen fokuserar på datahämtning, lagring och en liten läsyta ovanpå datan:

- hämta S&P 500-komponenter,
- hämta daily candles från Yahoo Finance,
- hämta marknads- och makroserier från FRED,
- spara allt i Neon Postgres,
- visa datans status i appen,
- skapa en stabil grund för senare indikatorer och signaler.

Läs först:

- [`GOALS.md`](./GOALS.md)
- [`PRD.md`](./PRD.md)
- [`DATA_FETCH_FREQUENCY.md`](./DATA_FETCH_FREQUENCY.md)
- [`IMPLEMENTATION_PLAN.md`](./IMPLEMENTATION_PLAN.md)
- [`CODEX_TASK.md`](./CODEX_TASK.md)

---

## Stack

- JavaScript
- Next.js App Router
- Neon Postgres
- `pg` för databasanslutning
- Yahoo Finance chart endpoint
- FRED CSV endpoints
- Wikipedia S&P 500-lista

---

## Fas 1

Fas 1 ska endast bygga data foundation.

Inget av detta ska byggas ännu:

- trading-signaler,
- Market Regime Score,
- intraday polling,
- alerts,
- AI-analys.

En minimal read-only dashboard finns nu för att verifiera att live-datan faktiskt läses från databasen. Det är fortfarande inte en indikator- eller alertsprodukt.

---

## Setup

### 1. Installera dependencies

```bash
npm install
```

### 2. Skapa env-fil

Kopiera `.env.example` till `.env.local`:

```bash
cp .env.example .env.local
```

Fyll i:

```env
# default -> DATABASE_URL
# cockroach -> DATABASE_URL_COCKROACH
DATABASE_TARGET="default"
DATABASE_URL="postgresql://USER:PASSWORD@HOST.neon.tech/DBNAME?sslmode=require"
DATABASE_URL_COCKROACH="postgresql://USER:PASSWORD@HOST.cockroachlabs.cloud:26257/DBNAME?sslmode=verify-full&sslrootcert=C:/Users/ryd/AppData/Roaming/postgresql/root.crt"
```

`npm run db:migrate` och `npm run fetch:daily` laddar nu samma `.env*`-filer som Next.js gör, så `.env.local` fungerar även för scriptkörningar.

Om du vill växla databas utan att ändra kod sätter du bara:

```powershell
$env:DATABASE_TARGET="cockroach"
```

eller låter `.env.local` stå på:

```env
DATABASE_TARGET="default"
```

### 3. Kör migration

```bash
npm run db:migrate
```

Det skapar:

- `sp500_constituents`
- `benchmark_daily_prices`
- `stock_daily_prices`
- `stock_daily_indicators`
- `market_series_daily`
- `occ_daily_volume_totals`
- `cvol_call_volume_indicator_daily`
- `finra_daily_short_volume`
- `plce_short_volume_indicator_daily`
- `external_breadth_daily`
- `r3tw_mmtw_20dma_breadth_indicator_daily`
- `implied_volatility_proxy_source_daily`
- `macro_matrix_yahoo_proxy_daily`
- `implied_volatility_ratio_signals_daily`
- `market_breadth_ma200_forward_return_signal_daily`
- `market_breadth_ma200_forward_return_empirical_daily`
- `market_breadth_daily`
- `sector_breadth_daily`
- `sector_signal_daily`
- `market_signal_daily`
- `trading_signal_daily`
- `position_facts_daily`
- `position_signal_daily`
- `swing_signal_daily`
- `swing_watchlist_daily`
- `strategy_definitions`
- `backtest_runs`
- `strategy_positions_daily`
- `strategy_equity_daily`
- `data_fetch_runs`

### 4. Testa fetch med få tickers

```bash
FETCH_TICKER_LIMIT=10 npm run fetch:daily
```

På Windows PowerShell:

```powershell
$env:FETCH_TICKER_LIMIT="10"; npm run fetch:daily
```

### 5. Kör full fetch

```bash
npm run fetch:daily
```

Full fetch hämtar cirka 400 daily candles för alla aktiva S&P 500-komponenter.

Om du vill göra en större engångs-backfill kan du tillfälligt sätta `YAHOO_DAILY_RANGE`.
Exempel: cirka 1.5 år extra historik ovanpå nuvarande nivå:

```powershell
$env:NODE_ENV="production"
$env:YAHOO_DAILY_RANGE="800d"
npm run fetch:daily
```

För cirka fem års Yahoo-historik i vald databas:

```powershell
$env:DATABASE_TARGET="cockroach"
$env:YAHOO_DAILY_RANGE="5y"
npm run fetch:daily
```

Det kräver ingen rensning av databasen. Scriptet upsertar befintliga datum och lägger till äldre datum som saknas.

Utan `YAHOO_DAILY_RANGE` kör scriptet inkrementellt:

- nya tickers får normal backfill
- befintliga tickers hämtas från senaste lagrade datum med en liten overlap-buffert
- `SPY` hämtas också inkrementellt till `benchmark_daily_prices`
- dagliga FRED-serier upsertas inkrementellt med liten overlap
- månadsvisa FRED-serier upsertas i full längd vid varje körning för att inte missa revisioner

### 6. Hämta Yahoo 60m-candles separat

`fetch:intraday-60m` är en egen pipeline och rör inte `stock_daily_prices`.

Standard är två månader bakåt:

```powershell
npm run fetch:intraday-60m
```

Begränsa gärna första testet:

```powershell
$env:FETCH_TICKER_LIMIT="10"
$env:YAHOO_INTRADAY_60M_RANGE="2mo"
npm run fetch:intraday-60m
```

Eller en enskild ticker:

```powershell
$env:FETCH_TICKER="AAPL"
$env:YAHOO_INTRADAY_60M_RANGE="2mo"
npm run fetch:intraday-60m
```

### 7. Hämta macro-matrix Yahoo-proxyer separat

Sektor/faktor- och equity/style-matriserna läser nu från databasen i stället för att hämta Yahoo live vid render.

Första körningen backfillar symboler som saknas med lång historik:

```powershell
npm run fetch:macro-matrix-yahoo-proxy
```

Standard är:

- nya symboler: `10y`
- befintliga symboler: `400d`

Du kan skriva över detta manuellt:

```powershell
$env:YAHOO_PROXY_DAILY_INITIAL_RANGE="10y"
$env:YAHOO_PROXY_DAILY_RANGE="90d"
npm run fetch:macro-matrix-yahoo-proxy
```

---

## Scripts

```bash
npm run dev
npm run db:migrate
npm run fetch:daily
npm run fetch:intraday-60m
npm run fetch:macro-matrix-yahoo-proxy
npm run fetch:occ-volume-totals
npm run fetch:finra-short-volume
npm run fetch:barchart-breadth
npm run fetch:implied-volatility-proxy
npm run calculate:daily
npm run calculate:cvol-call-volume
npm run calculate:plce-short-volume
npm run calculate:r3tw-mmtw-breadth
npm run calculate:implied-volatility-ratio
npm run calculate:market-breadth-ma200-forward-return
npm run calculate:market-breadth-ma200-forward-return-empirical
npm run calculate:sector-breadth
npm run calculate:sector-signals
npm run calculate:signals
npm run calculate:trading-signals
npm run calculate:position-facts
npm run calculate:position-signals
npm run calculate:swing-signals
npm run calculate:swing-watchlists
npm run seed:strategies
npm run backtest:daily
npm run validate:indicator -- AAPL
```

De fyra externa indikatorvägarna och ett separat breadth-modellager körs isolerat och lämnar den befintliga Yahoo/FRED/S&P 500-pipelinen orörd:

- `npm run fetch:occ-volume-totals` hämtar OCC daily volume totals till `occ_daily_volume_totals`
- `npm run calculate:cvol-call-volume` bygger `cvol_call_volume_indicator_daily`
- `npm run fetch:finra-short-volume` hämtar FINRA PLCE short volume till `finra_daily_short_volume`
- `npm run calculate:plce-short-volume` bygger `plce_short_volume_indicator_daily`
- `npm run fetch:barchart-breadth` hämtar dagens `$R3TW` och `$MMTW` från Barchart till `external_breadth_daily`
- `npm run calculate:r3tw-mmtw-breadth` bygger `r3tw_mmtw_20dma_breadth_indicator_daily`
- `npm run fetch:implied-volatility-proxy` hämtar ett separat cross-asset-universum med underliggande Yahoo-priser och Yahoo/Cboe-volatilitetsproxyserier till `implied_volatility_proxy_source_daily`
- `npm run fetch:macro-matrix-yahoo-proxy` hämtar Yahoo daily-proxyserierna för macro-matriserna till `macro_matrix_yahoo_proxy_daily`
- `npm run calculate:implied-volatility-ratio` bygger `implied_volatility_ratio_signals_daily`
- `npm run calculate:market-breadth-ma200-forward-return` bygger ett separat MA200 breadth-signalmodellager i `market_breadth_ma200_forward_return_signal_daily`
- `npm run calculate:market-breadth-ma200-forward-return-empirical` bygger ett separat empiriskt SPY-baserat priorlager i `market_breadth_ma200_forward_return_empirical_daily`

Miljövariabler för manuella körningar:

- `OCC_REPORT_DATE` eller `OCC_START_DATE` + `OCC_END_DATE`
- `FINRA_SHORT_VOLUME_DATE` eller `FINRA_SHORT_VOLUME_START_DATE` + `FINRA_SHORT_VOLUME_END_DATE`
- `BARCHART_BREADTH_DATE`
- `IMPLIED_VOLATILITY_PROXY_RANGE` (default `800d`)
- `YAHOO_PROXY_DAILY_INITIAL_RANGE` (default `10y` för symboler som saknas i proxy-tabellen)
- `YAHOO_PROXY_DAILY_RANGE` (default `400d` för löpande uppdatering av redan backfillade proxy-symboler)

`npm run dev` öppnar nu en server-renderad startsida som visar:

- senaste fetch-status,
- datatäckning för aktier,
- senaste SP500/VIX/HY spread,
- senaste prisrader för vald ticker.

`npm run calculate:daily` beräknar nu:

- `SMA5`
- `SMA10`
- `SMA20`
- `SMA50`
- `SMA200`
- `daily_return_pct`
- `avg_volume20`
- `relative_volume20`
- `pct_from_52w_high`
- `pct_from_52w_low`
- `ryd_obv`
- `ryd_obv_zscore_80`
- `ryd_obv_buy_signal`
- `ryd_obv_sell_signal`
- `ryd_obv_signal`

per ticker och datum i `stock_daily_indicators`.

Samma körning bygger också dagliga breadth-rader i `market_breadth_daily`:

- `pct_above_sma20`
- `pct_above_sma50`
- `pct_above_sma200`
- `advancers`
- `decliners`
- `unchanged`
- `new_highs_52w`
- `new_lows_52w`
- `is_valid_signal_date`

`npm run calculate:sector-breadth` bygger sedan samma typ av breadth-fakta per `date + sector` i `sector_breadth_daily`:

- `ticker_count` via `active_ticker_count`
- `pct_above_sma20`
- `pct_above_sma50`
- `pct_above_sma200`
- `advancers`
- `decliners`
- `unchanged`
- `new_highs_52w`
- `new_lows_52w`
- `is_valid_signal_date`

Det gör det möjligt att följa om indexrörelsen bärs av många sektorer eller bara några få, utan att ännu låsa in logiken i en separat sektor-signalmodell.

`npm run calculate:sector-signals` bygger sedan ett rent sektorbeslutslager i `sector_signal_daily` ovanpå `sector_breadth_daily`. Varje rad per `date + sector` sparar bland annat:

- `pct_above_sma50`
- `pct_above_sma50_14d_change`
- `pct_above_sma200`
- `pct_above_sma200_14d_change`
- `ad_net`
- `ad_net_14d_change`
- `new_highs_52w`
- `new_lows_52w`
- `sector_regime_score`
- `signal` (`leading`, `improving`, `weakening`, `lagging`, `mixed`)
- `reason_summary`

Det ger ett separat faktalager för sektorrotation som går att använda både för läsyta och senare swing-/watchlistlogik utan att blanda ihop det med det bredare marknadssignallagret.

`npm run calculate:signals` bygger sedan en rad per marknadsdag i `market_signal_daily` med bland annat:

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
- `divergence_status`
- `short_divergence_status`

`npm run calculate:trading-signals` bygger sedan ett explicit beslutslager i `trading_signal_daily` för kortsiktig SPY-handel. Första versionen använder befintlig breadth-, trend- och volatilitetsdata och outputtar raka orderord:

- `KÖP SPY`
- `SÄLJ SPY`
- `GÅ KORT SPY`
- `STÄNG KORT`
- `BEHÅLL`
- `GÅ TILL CASH`
- `SITT STILL`

Varje rad sparar också:

- `setup` (`bullish`, `bearish`, `risk_off`, `neutral`)
- `previous_state`
- `target_state`
- `trigger_count`
- `market_regime_score`
- `reason_summary`

Trading v1 är avsiktligt ett beslutslager och ännu inte en full short-backtestmotor. Själva signalerna kan alltså säga `GÅ KORT SPY`, men den befintliga backtestmotorn kör fortfarande bara long/cash-strategier.

`npm run calculate:position-facts` bygger sedan en rad per `SPY`-marknadsdag i `position_facts_daily` med as-of-mappade makrofakta för positionsystemet, bland annat:

- `sp500`
- `sp500_200dma`
- `sp500_pct_from_200dma`
- `vix`
- `high_yield_spread`
- `yield_curve_spread`
- `fed_funds`
- `unemployment_rate`
- `cpi_yoy`
- `consumer_sentiment`
- `sp500_trend_regime`
- `vix_regime`
- `credit_regime`
- `yield_curve_regime`
- `fed_policy_trend`
- `labor_trend`
- `inflation_trend`
- `sentiment_trend`

Månadsserierna forward-fillas som “senast kända observation” till varje marknadsdag, och respektive observationsdatum sparas separat så att positionlogik kan byggas utan lookahead.

`npm run calculate:position-signals` bygger sedan en rad per marknadsdag i `position_signal_daily` med första versionens positionsbeslut och målallokering, bland annat:

- `signal`
- `decision`
- `target_equity_weight_pct`
- `target_cash_weight_pct`
- `raw_signal`
- `raw_decision`
- `raw_target_equity_weight_pct`
- `raw_target_cash_weight_pct`
- `market_signal`
- `market_regime_score`
- `caution_count`
- `hard_risk_off_count`
- `reason_summary`
- `persistence_direction`
- `persistence_streak_days`
- `persistence_required_days`

Första versionen väger ihop makrofakta från `position_facts_daily` med breadthkontext från `market_signal_daily` och mappar dem till `0%`, `25%`, `50%`, `75%` eller `100%` exponering.

`raw_*`-kolumnerna visar daglig modelloutput före persistens. De applicerade `target_*`-kolumnerna är avsiktligt långsammare för positionssystemet:

- mjuk nedväxling till lägre allokering kräver `3` dagar i rad med samma rå-allokering
- uppväxling tillbaka till högre allokering kräver `5` dagar i rad med samma rå-allokering
- hårda riskkluster styrs separat och kräver både bredd och varaktighet:
  - `3+` hårda flaggor i `3` dagar i rad kapar till högst `50%`
  - `3+` hårda flaggor i `5` dagar i rad kapar till `25%`
  - `4+` hårda flaggor i `2` dagar i rad skickar modellen till `0%`

Nuvarande hårda flaggor är:

- `SP500` under `200-dma`
- `VIX` i `stress`
- high yield-spread i `stress`
- `market_signal_daily.signal = risk_off`

Yield curve-inversion används nu som makrokontext i försiktighetslagret, inte som ensam full-exit-trigger.

Det gör att positionssystemet ligger närmare `buy-and-hold` i normalläge och bara kliver av kraftigt när riskbilden är både bred och ihållande.

`npm run calculate:swing-signals` bygger sedan ett swinglager i `swing_signal_daily` som kombinerar `sector_signal_daily` med `market_signal_daily`. Första versionen fokuserar på sektorrotation och timing för `1-4 veckor` och outputtar raka beslut:

- `KÖP STARKA SEKTORER`
- `BEHÅLL LONGS`
- `MINSKA RISK`
- `GÅ TILL CASH`
- `LONG WATCHLIST`
- `SHORT WATCHLIST`
- `SITT STILL`

Varje rad sparar också:

- `setup` (`bullish`, `improving`, `weakening`, `bearish_watch`, `risk_off`, `neutral`)
- `previous_state`
- `target_state`
- `active_sector_count`
- `leading_sector_count`
- `improving_sector_count`
- `weakening_sector_count`
- `lagging_sector_count`
- `mixed_sector_count`
- `market_signal`
- `market_regime_score`
- `reason_summary`

Swing v1 är avsiktligt ett beslutslager för sektorrörelse och watchlists, inte en egen backtestmotor eller portföljallokator ännu.

`npm run calculate:swing-watchlists` bygger sedan en rankad watchlist i `swing_watchlist_daily` ovanpå `stock_daily_indicators`, `sector_signal_daily` och `swing_signal_daily`. Första versionen sparar toppkandidater per dag och bias:

- `bias` (`long`, `short`)
- `rank_in_bias`
- `ticker`
- `sector`
- `sector_signal`
- `swing_setup`
- `swing_decision`
- `playbook`
- `is_actionable`
- `watchlist_score`
- `indicator_price`
- `daily_return_pct`
- `relative_volume20`
- `pct_from_52w_high`
- `pct_from_52w_low`
- `distance_from_sma50_pct`
- `distance_from_sma200_pct`
- `reason_summary`

Long-kandidater kommer från `leading` och `improving` sektorer. Short-kandidater kommer från `lagging` och `weakening` sektorer. Score v1 använder bara indikatorer som redan finns i systemet:

- pris över/under `SMA50`
- pris över/under `SMA200`
- närhet till `52w high/low`
- daglig riktning
- relativ volym
- sektorstyrka

Själva watchlisten ersätts i full längd vid varje körning i stället för att bara upsertas. Det gör att gamla toppkandidater inte ligger kvar om rankingreglerna eller score-trösklar ändras senare.

De nya indikator-specifika rå- och signallagren är separata från den ordinarie aktie- och marknadsbreddspipelinen:

- `occ_daily_volume_totals` sparar OCC `calls`, `puts`, `ratio`, `volume` och `market_share` per `report_date + exchange`
- `cvol_call_volume_indicator_daily` sparar CVOL-ersättningen från OCC med:
  - `cvol_calls`
  - `cvol_puts`
  - `cvol_ratio`
  - `cvol_total_volume`
  - `cvol_market_share`
  - `cvol_zscore_20`
  - `cvol_zscore_15`
  - `cvol_zscore_10`
  - `cvol_price_condition`
  - `cvol_sell_signal_1`
  - `cvol_sell_signal_2`
  - `cvol_sell_signal_3`
  - `cvol_signal`

- `finra_daily_short_volume` sparar PLCE:s FINRA-rad per datum med:
  - `short_volume`
  - `short_exempt_volume`
  - `total_volume`
  - `market`
- `plce_short_volume_indicator_daily` sparar:
  - `plce_short_volume`
  - `plce_short_exempt_volume`
  - `plce_total_volume`
  - `plce_short_volume_market`
  - `plce_short_volume_zscore_50`
  - `plce_short_volume_zscore_20`
  - `plce_short_volume_price_condition`
  - `plce_short_volume_buy_signal_50`
  - `plce_short_volume_buy_signal_20`
  - `plce_short_volume_extreme_signal`
  - `plce_short_volume_signal`

- `external_breadth_daily` sparar dagliga Barchart-värden för `R3TW` och `MMTW`
- `r3tw_mmtw_20dma_breadth_indicator_daily` sparar:
  - `r3tw_value`
  - `mmtw_value`
  - `r3tw_cross_up_20`
  - `mmtw_cross_up_20`
  - `r3tw_mmtw_buy_signal`
  - `r3tw_mmtw_signal`

- `implied_volatility_proxy_source_daily` sparar dagliga råinput för ett separat cross-asset-volatilitetsuniversum:
  - `asset_key`
  - `source_symbol`
  - `implied_volatility_symbol`
  - `close`
  - `adj_close`
  - `volume`
  - `implied_volatility`
  - `source_status`

- `implied_volatility_ratio_signals_daily` sparar IVOL/RVOL-indikatorn med bland annat:
  - `realised_volatility_30d`
  - `ivol_rvol_ratio`
  - `ivol_rvol_ratio_z_1y`
  - `ivol_rvol_ratio_z_1w_ago`
  - `ivol_rvol_ratio_z_1w_change`
  - `rvol_20d`
  - `trend_regime`
  - `range_position_20d`
  - `ivol_rvol_level`
  - `signal`
  - `action`
  - `opportunity_score`
  - `ivol_rvol_rank`
  - `ivol_rvol_percentile`

- `market_breadth_ma200_forward_return_signal_daily` sparar MA200 breadth-modellen med bland annat:
  - `ma200_breadth_pct`
  - `ma200_breadth_bucket`
  - `ma200_breadth_5d_change`
  - `ma200_breadth_10d_change`
  - `ma200_breadth_20d_change`
  - `ma200_breadth_50d_change`
  - `ma200_breadth_signal`
  - `ma200_breadth_action`
  - `ma200_breadth_confidence`
  - `ma200_breadth_warning`
  - `ma200_expected_return_5d`
  - `ma200_expected_return_10d`
  - `ma200_expected_return_1m`
  - `ma200_expected_return_3m`
  - `ma200_expected_return_6m`
  - `ma200_expected_return_12m`
  - `ma200_win_ratio_5d`
  - `ma200_win_ratio_10d`
  - `ma200_win_ratio_1m`
  - `ma200_win_ratio_3m`
  - `ma200_win_ratio_6m`
  - `ma200_win_ratio_12m`
  - `ma200_forward_model_version`

- `market_breadth_ma200_forward_return_empirical_daily` sparar ett separat empiriskt priorlager för aktuell breadth-bucket på varje datum, baserat på historiskt känd `SPY`-utveckling:
  - `benchmark_symbol`
  - `ma200_breadth_pct`
  - `ma200_breadth_bucket`
  - `ma200_empirical_sample_count_5d`
  - `ma200_empirical_sample_count_10d`
  - `ma200_empirical_sample_count_1m`
  - `ma200_empirical_sample_count_3m`
  - `ma200_empirical_sample_count_6m`
  - `ma200_empirical_sample_count_12m`
  - `ma200_empirical_expected_return_5d`
  - `ma200_empirical_expected_return_10d`
  - `ma200_empirical_expected_return_1m`
  - `ma200_empirical_expected_return_3m`
  - `ma200_empirical_expected_return_6m`
  - `ma200_empirical_expected_return_12m`
  - `ma200_empirical_win_ratio_5d`
  - `ma200_empirical_win_ratio_10d`
  - `ma200_empirical_win_ratio_1m`
  - `ma200_empirical_win_ratio_3m`
  - `ma200_empirical_win_ratio_6m`
  - `ma200_empirical_win_ratio_12m`
  - `ma200_forward_model_version`

Watchlisten får nu också ett litet exekveringslager så att listan går att tolka operativt:

- `playbook` beskriver hur raden ska användas, t.ex. `deploy_long`, `defensive_watch`, `hedge_watch` eller `standby_short`
- `is_actionable` markerar om raden är tänkt som faktisk kandidat att agera på i nuvarande swingläge, eller bara som observations-/beredskapsnamn

Det gör att samma kandidatlista kan visas även under `MINSKA RISK` eller `risk_off`, utan att den ser ut som en aktiv köplista när den egentligen bara är en defensiv eller informationsmässig watchlist.

`npm run seed:strategies` upsertar sedan de första strategidefinitionerna:

- `buy_and_hold_spy`
- `market_regime_signal_v1`
- `bearish_divergence_cash_v1`
- `bullish_divergence_context_v1`
- `pct_above_50_threshold_v1`
- `position_macro_signal_v1`
- `trading_signal_v1_long_cash`

`npm run backtest:daily` kör dessa strategier mot `SPY` och fyller:

- `backtest_runs`
- `strategy_positions_daily`
- `strategy_equity_daily`

För `trading_signal_v1_long_cash` tolkas tradingbesluten just nu så här i backtestet:

- `KÖP SPY` och `BEHÅLL` med `target_state = long` => `long`
- `SÄLJ SPY`, `GÅ TILL CASH`, `SITT STILL` => `cash`
- `GÅ KORT SPY` och `STÄNG KORT` behandlas också som `cash`

Det gör att tradinglagret går att validera direkt som en första `long/cash`-strategi innan backtestmotorn byggs ut med riktig short-support.

För att databasen inte ska växa okontrollerat behålls nu som standard bara den senaste lyckade backtest-runen per strategi. Äldre lyckade runs rensas automatiskt efter varje ny lyckad körning, och detaljraderna i `strategy_positions_daily` och `strategy_equity_daily` försvinner samtidigt via `on delete cascade`.

Standard-retention:

- `BACKTEST_SUCCESS_RUN_RETENTION=1`
- `BACKTEST_FAILURE_RUN_RETENTION=10`

Om du vill behålla fler historiska runs kan du sätta dessa env-variabler högre före `npm run backtest:daily`.

Prisbasen är konsekvent:

```text
indicator_price = adj_close ?? close
```

Warmup-regler:

- `sma5 = null` tills 5 fulla handelsdagar finns
- `sma10 = null` tills 10 fulla handelsdagar finns
- `sma20 = null` tills 20 fulla handelsdagar finns
- `sma50 = null` tills 50 fulla handelsdagar finns
- `sma200 = null` tills 200 fulla handelsdagar finns
- `avg_volume20 = null` tills 20 fulla volymrader finns
- `pct_from_52w_high/low = null` tills 252 fulla handelsdagar finns

Definitioner:

```text
indicator_price    = adj_close ?? close
daily_return_pct   = ((today / yesterday) - 1) * 100
avg_volume20       = 20-dagars snittvolym, inklusive aktuell dag
relative_volume20  = volume / avg_volume20
pct_from_52w_high  = ((today / rolling_252d_high) - 1) * 100
pct_from_52w_low   = ((today / rolling_252d_low) - 1) * 100
```

För att verifiera en specifik rad mot råpriserna:

```bash
npm run validate:indicator -- AAPL
npm run validate:indicator -- AAPL 2026-05-06
```

Scriptet skriver ut:

- sparad indikatorrad,
- omräknad indikatorrad från råpriser,
- om de matchar exakt,
- vilka datumfönster som användes för `sma20/50/200`.

`validate:indicator` verifierar nu också `ryd_obv`, `ryd_obv_zscore_80`, `ryd_obv_buy_signal`, `ryd_obv_sell_signal` och `ryd_obv_signal` mot råpriserna.

---

## Live-setup

Projektet använder alltid exakt en aktiv databas per körning, men du kan nu växla mellan flera connection strings via `DATABASE_TARGET`.

Standard:

- `DATABASE_TARGET=default` -> `DATABASE_URL`

Exempel för sekundär databas:

- `DATABASE_TARGET=cockroach` -> `DATABASE_URL_COCKROACH`

Det gör att lokal utveckling, scriptkörningar och live kan använda olika databaser utan kodändringar, så länge rätt env-variabler finns.

## Daglig körning

Repo:t innehåller en GitHub Actions-workflow i [`.github/workflows/fetch-daily.yml`](./.github/workflows/fetch-daily.yml).

För att den ska fungera behöver du lägga in repository secret:

- `DATABASE_URL` = din Neon connection string

Om du senare flyttar workflowen till Cockroach kan du i stället:

- sätta `DATABASE_TARGET=cockroach`
- lägga in `DATABASE_URL_COCKROACH` som repository secret

Workflowen kör:

- manuellt via `workflow_dispatch`
- automatiskt vardagar `21:53 UTC`
- därefter `npm run calculate:daily`
- därefter `npm run calculate:sector-breadth`
- därefter `npm run calculate:sector-signals`
- därefter `npm run calculate:signals`
- därefter `npm run calculate:trading-signals`
- därefter `npm run calculate:position-facts`
- därefter `npm run calculate:position-signals`
- därefter `npm run calculate:swing-signals`
- därefter `npm run calculate:swing-watchlists`
- därefter `npm run seed:strategies`
- därefter `npm run backtest:daily`

Workflowen kör nu också de externa daily-källorna som separata steg i samma pipeline:

- `npm run fetch:occ-volume-totals`
- `npm run fetch:finra-short-volume`
- `npm run fetch:barchart-breadth`
- `npm run fetch:implied-volatility-proxy`
- `npm run calculate:cvol-call-volume`
- `npm run calculate:plce-short-volume`
- `npm run calculate:r3tw-mmtw-breadth`
- `npm run calculate:implied-volatility-ratio`
- `npm run calculate:market-breadth-ma200-forward-return`
- `npm run calculate:market-breadth-ma200-forward-return-empirical`

Principen framåt är:

- behåll `fetch:daily` för Yahoo/FRED/S&P 500-kärnan
- lägg nya externa daily-indikatorer som egna fetch/calculate-scripts
- kör dem i samma dagliga workflow som separata steg

Det motsvarar normalt ungefär:

- `22:53` svensk vintertid (`CET`)
- `23:53` svensk sommartid (`CEST`)

Schemat ligger medvetet:

- efter USA-stängning så att daily-källor hinner uppdateras,
- före `00:00 UTC` så att Barchart-snapshots för `$R3TW` och `$MMTW` lagras på rätt USA-marknadsdatum,
- och inte på exakt hel timme, eftersom GitHubs schemalagda workflows kan fördröjas vid hög last runt timskiften.

---

## Vad `fetch:daily` gör

1. Hämtar S&P 500-komponenter från Wikipedia.
2. Normaliserar Yahoo-tickers, t.ex. `BRK.B -> BRK-B`.
3. Upsertar komponenter till `sp500_constituents`.
4. Hämtar 400 dagar daily candles från Yahoo för varje aktiv ticker.
5. Upsertar candles till `stock_daily_prices`.
6. Hämtar daily OHLCV för `SPY` från Yahoo och upsertar till `benchmark_daily_prices`.
7. Hämtar `SP500`, `VIXCLS`, `BAMLH0A0HYM2`, `T10Y2Y`, `FEDFUNDS`, `UNRATE`, `CPIAUCSL` och `UMCSENT` från FRED.
8. Upsertar FRED-data till `market_series_daily`.
9. Loggar körningen i `data_fetch_runs`, inklusive benchmark-resultatet i `metadata.benchmark`.

---

## Förväntat fas 1-resultat

Efter `npm run fetch:daily` ska databasen innehålla:

- aktiva S&P 500-komponenter i `sp500_constituents`,
- daily candles i `stock_daily_prices`,
- dagliga indikatorvärden i `stock_daily_indicators`,
- SP500/VIX/HY spread i `market_series_daily`,
- dagliga breadth-sammanställningar i `market_breadth_daily`,
- dagliga sektorbreadth-rader i `sector_breadth_daily`,
- dagliga sektorsignaler i `sector_signal_daily`,
- dagliga positionsfakta i `position_facts_daily`,
- dagliga swing-signaler i `swing_signal_daily`,
- dagliga swing-watchlists i `swing_watchlist_daily`,
- dagliga positionssignaler i `position_signal_daily`,
- körlogg i `data_fetch_runs`.

Scriptet är byggt för att vara idempotent: att köra det flera gånger ska inte skapa dubbletter.

FRED-serier som hämtas nu:

- `SP500`
- `VIXCLS`
- `BAMLH0A0HYM2`
- `T10Y2Y`
- `FEDFUNDS`
- `UNRATE`
- `CPIAUCSL`
- `UMCSENT`

---

## Nästa fas senare

När datahämtningen är verifierad kan nästa fas lägga till:

- breadth summaries,
- advancers/decliners,
- new highs/lows,
- Market Regime Score,
- dashboard,
- intraday pulse och alerts.
