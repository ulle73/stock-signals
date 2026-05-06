# Stock Signals

Ett framtida marknadsbreddsbaserat signalsystem för S&P 500.

Första versionen fokuserar på datahämtning, lagring och en liten läsyta ovanpå datan:

- hämta S&P 500-komponenter,
- hämta daily candles från Yahoo Finance,
- hämta SP500/VIX/HY spread från FRED,
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
- FRED-serier upsertas också inkrementellt med liten overlap

---

## Scripts

```bash
npm run dev
npm run db:migrate
npm run fetch:daily
npm run calculate:daily
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
- därefter även `npm run calculate:daily`

Schemat ligger medvetet inte på exakt hel timme, eftersom GitHubs schemalagda workflows kan fördröjas vid hög last runt timskiften.

---

## Vad `fetch:daily` gör

1. Hämtar S&P 500-komponenter från Wikipedia.
2. Normaliserar Yahoo-tickers, t.ex. `BRK.B -> BRK-B`.
3. Upsertar komponenter till `sp500_constituents`.
4. Hämtar 400 dagar daily candles från Yahoo för varje aktiv ticker.
5. Upsertar candles till `stock_daily_prices`.
6. Hämtar daily OHLCV för `SPY` från Yahoo och upsertar till `benchmark_daily_prices`.
7. Hämtar `SP500`, `VIXCLS` och `BAMLH0A0HYM2` från FRED.
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
- körlogg i `data_fetch_runs`.

Scriptet är byggt för att vara idempotent: att köra det flera gånger ska inte skapa dubbletter.

---

## Nästa fas senare

När datahämtningen är verifierad kan nästa fas lägga till:

- breadth summaries,
- advancers/decliners,
- new highs/lows,
- Market Regime Score,
- dashboard,
- intraday pulse och alerts.
