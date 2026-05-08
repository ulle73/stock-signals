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
DATABASE_URL="postgresql://USER:PASSWORD@HOST.neon.tech/DBNAME?sslmode=require"
```

`npm run db:migrate` och `npm run fetch:daily` laddar nu samma `.env*`-filer som Next.js gör, så `.env.local` fungerar även för scriptkörningar.

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
- `market_breadth_daily`
- `sector_breadth_daily`
- `market_signal_daily`
- `trading_signal_daily`
- `position_facts_daily`
- `position_signal_daily`
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

Det kräver ingen rensning av databasen. Scriptet upsertar befintliga datum och lägger till äldre datum som saknas.

Utan `YAHOO_DAILY_RANGE` kör scriptet inkrementellt:

- nya tickers får normal backfill
- befintliga tickers hämtas från senaste lagrade datum med en liten overlap-buffert
- `SPY` hämtas också inkrementellt till `benchmark_daily_prices`
- dagliga FRED-serier upsertas inkrementellt med liten overlap
- månadsvisa FRED-serier upsertas i full längd vid varje körning för att inte missa revisioner

---

## Scripts

```bash
npm run dev
npm run db:migrate
npm run fetch:daily
npm run calculate:daily
npm run calculate:sector-breadth
npm run calculate:signals
npm run calculate:trading-signals
npm run calculate:position-facts
npm run calculate:position-signals
npm run seed:strategies
npm run backtest:daily
npm run validate:indicator -- AAPL
```

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

`npm run seed:strategies` upsertar sedan de första strategidefinitionerna:

- `buy_and_hold_spy`
- `market_regime_signal_v1`
- `bearish_divergence_cash_v1`
- `bullish_divergence_context_v1`
- `pct_above_50_threshold_v1`
- `position_macro_signal_v1`

`npm run backtest:daily` kör dessa strategier mot `SPY` och fyller:

- `backtest_runs`
- `strategy_positions_daily`
- `strategy_equity_daily`

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

---

## Live-setup

Projektet använder en enda Neon-databas, direkt mot `main`, för allt:

- lokal utveckling
- `npm run db:migrate`
- `npm run fetch:daily`
- live-miljön

Det är kortaste vägen till live, men betyder också att alla schemaändringar och datakörningar träffar produktionsdatabasen direkt.

## Daglig körning

Repo:t innehåller en GitHub Actions-workflow i [`.github/workflows/fetch-daily.yml`](./.github/workflows/fetch-daily.yml).

För att den ska fungera behöver du lägga in repository secret:

- `DATABASE_URL` = din Neon connection string

Workflowen kör:

- manuellt via `workflow_dispatch`
- automatiskt vardagar `07:23 UTC`
- därefter `npm run calculate:daily`
- därefter `npm run calculate:signals`
- därefter `npm run calculate:trading-signals`
- därefter `npm run calculate:position-facts`
- därefter `npm run calculate:position-signals`
- därefter `npm run seed:strategies`
- därefter `npm run backtest:daily`

Schemat ligger medvetet inte på exakt hel timme, eftersom GitHubs schemalagda workflows kan fördröjas vid hög last runt timskiften.

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
- dagliga positionsfakta i `position_facts_daily`,
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
