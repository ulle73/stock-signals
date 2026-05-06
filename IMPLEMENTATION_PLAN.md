# IMPLEMENTATION_PLAN.md

## Syfte

Det här är den praktiska byggordningen för fas 1 i Stock Signals.

Målet är att få en stabil data pipeline innan några indikatorer, signaler eller dashboards byggs.

---

## Viktig regel

Implementera bara data foundation i denna fas.

Bygg inte:

- dashboard,
- Market Regime Score,
- alerts,
- intraday polling,
- MA20/50/200,
- advancers/decliners,
- McClellan,
- divergenser.

---

## Steg 1 — Initiera Next.js-projektet

Skapa ett enkelt Next.js App Router-projekt i befintligt repo.

Krav:

- JavaScript, inte TypeScript i första versionen.
- Minimal startsida i `app/page.js`.
- `package.json` med scripts:

```json
{
  "scripts": {
    "dev": "next dev",
    "db:migrate": "node scripts/run-migrations.js",
    "fetch:daily": "node scripts/fetch-daily.js"
  }
}
```

Installera minst:

```bash
npm install next react react-dom pg
```

Lägg eventuellt till små hjälpbibliotek om det gör parsing enklare, men håll dependency-listan kort.

---

## Steg 2 — Databasanslutning

Skapa:

```text
lib/db.js
```

Krav:

- Läs `DATABASE_URL` från environment.
- Använd `pg` Pool.
- Exportera en enkel query-funktion.
- Ge tydligt fel om `DATABASE_URL` saknas.

---

## Steg 3 — Migration runner

Skapa:

```text
scripts/run-migrations.js
```

Krav:

- Läs alla `.sql`-filer i `db/migrations/` i sorterad ordning.
- Kör dem mot Neon Postgres.
- Logga vilken migration som körs.
- Avsluta tydligt vid fel.

Första migrationen finns redan:

```text
db/migrations/001_initial_schema.sql
```

---

## Steg 4 — S&P 500-komponenter från Wikipedia

Skapa:

```text
lib/sources/wikipedia.js
lib/utils/tickers.js
```

Krav:

- Hämta `https://en.wikipedia.org/wiki/List_of_S%26P_500_companies`.
- Extrahera tabellen med S&P 500-komponenter.
- Returnera array med:
  - ticker,
  - yahoo_ticker,
  - company_name,
  - sector,
  - industry.

Ticker-normalisering:

```js
function toYahooTicker(ticker) {
  return ticker.replaceAll('.', '-');
}
```

Om parsing med ren HTML blir för skör kan ett litet bibliotek användas, men undvik tung setup.

---

## Steg 5 — Yahoo Finance daily candles

Skapa:

```text
lib/sources/yahoo.js
```

Krav:

- Funktion: `fetchYahooDailyCandles(yahooTicker, range = '400d')`.
- Använd endpoint:

```text
https://query1.finance.yahoo.com/v8/finance/chart/{YAHOO_TICKER}?range=400d&interval=1d
```

- Returnera array med:
  - date,
  - open,
  - high,
  - low,
  - close,
  - adj_close,
  - volume.

Felhantering:

- Tomt svar ska ge tydligt fel.
- Tickerfel ska kastas upp till fetch-scriptet men inte stoppa hela körningen.

---

## Steg 6 — FRED daily series

Skapa:

```text
lib/sources/fred.js
```

Krav:

- Funktion: `fetchFredSeries(seriesId)`.
- Hämta CSV från:

```text
https://fred.stlouisfed.org/graph/fredgraph.csv?id={SERIES_ID}
```

- Stöd minst:
  - `SP500`,
  - `VIXCLS`,
  - `BAMLH0A0HYM2`.

Returnera array med:

- date,
- value,
- series_id.

Ignorera rader där värdet är `.` eller saknas.

---

## Steg 7 — Upsert-funktioner

Skapa gärna:

```text
lib/repositories/constituents.js
lib/repositories/prices.js
lib/repositories/market-series.js
lib/repositories/fetch-runs.js
```

Krav:

- `upsertConstituents(items)`.
- `upsertStockDailyPrices(ticker, candles)`.
- `upsertMarketSeries(seriesId, rows)`.
- `startFetchRun(jobName)`.
- `finishFetchRun(id, status, metadata)`.

Alla writes ska vara idempotenta.

---

## Steg 8 — Fetch daily script

Skapa:

```text
scripts/fetch-daily.js
```

Flöde:

```text
1. Starta fetch-run: job_name = fetch_daily.
2. Hämta S&P 500-komponenter.
3. Upserta komponenter.
4. För varje aktiv komponent:
   - hämta 400d daily candles från Yahoo,
   - upserta candles,
   - logga success/failure per ticker.
5. Hämta FRED-serier:
   - SP500,
   - VIXCLS,
   - BAMLH0A0HYM2.
6. Upserta FRED-data.
7. Avsluta fetch-run med:
   - success om allt lyckas,
   - partial_success om vissa tickers failar,
   - failure om huvudjobbet kraschar.
```

Concurrency:

- Använd 5–10 samtidiga Yahoo-anrop.
- Kör inte 500 requests helt obegränsat parallellt.

---

## Steg 9 — README-instruktioner

Uppdatera README efter implementation med:

```bash
npm install
cp .env.example .env.local
npm run db:migrate
npm run fetch:daily
```

Förklara:

- hur Neon `DATABASE_URL` sätts,
- vilka tabeller som fylls,
- hur man ser om fetch-run lyckades.

---

## Steg 10 — Definition of Done

Fas 1 är klar när:

- Next.js-appen startar.
- Migrationen kan köras.
- `fetch:daily` hämtar komponenter.
- `fetch:daily` hämtar Yahoo daily candles.
- `fetch:daily` hämtar FRED-serier.
- Data sparas i Neon.
- Scriptet kan köras flera gånger utan dubbletter.
- Misslyckade tickers loggas i `data_fetch_runs.metadata`.

---

## Rekommenderad första testkörning

För att undvika lång testloop kan agenten först stödja en temporär limit via environment:

```env
FETCH_TICKER_LIMIT=10
```

Detta är endast för lokal testning. Standard ska vara alla aktiva tickers.
