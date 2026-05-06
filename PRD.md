# PRD.md — Stock Signals Data Foundation

## 1. Produktöversikt

Stock Signals ska på sikt bli ett eget marknadsbreddsbaserat signalsystem för S&P 500.

Första versionen ska däremot **endast** bygga datagrunden:

- hämta S&P 500-komponenter,
- hämta historisk daily prisdata för alla komponenter,
- hämta index-/riskdata från FRED,
- spara allt strukturerat i Neon Postgres,
- göra systemet redo för indikatorberäkningar i nästa fas.

Denna PRD gäller endast fas 1: **Data Foundation**.

---

## 2. Problem

För att kunna bygga egna indikatorer som `% över MA20`, `% över MA50`, `% över MA200`, `advancers`, `decliners`, `new highs/lows`, `A/D-line`, `McClellan` och divergenser krävs en stabil databas med korrekt historisk rådata.

Om datagrunden är dålig blir alla framtida signaler opålitliga.

Därför ska första implementationen fokusera på datakvalitet, upprepningsbarhet och enkel felsökning.

---

## 3. Mål för fas 1

Bygg en minimal men robust data pipeline som kan:

1. Hämta aktuell S&P 500-komponentlista.
2. Normalisera tickers för Yahoo Finance.
3. Hämta 400 dagar daily candles för alla aktiva tickers.
4. Hämta daglig S&P 500 close, VIX och HY spread från FRED.
5. Spara datan i Neon Postgres.
6. Undvika dubbletter vid upprepade körningar.
7. Logga alla datajobb med status, antal lyckade tickers och fel.

---

## 4. Icke-mål i fas 1

Implementera inte detta ännu:

- Market Regime Score.
- Dashboard.
- Grafer.
- Alerts.
- Intraday data.
- Cron i produktion.
- MA20/MA50/MA200-beräkningar.
- Advancers/decliners.
- A/D-line.
- New highs/new lows.
- McClellan.
- Backtesting.
- AI-genererad analys.

Kodstrukturen ska däremot göra det lätt att lägga till dessa senare.

---

## 5. Rekommenderad stack

### App/backend

- JavaScript.
- Next.js App Router.
- Next.js används både som frontend-ramverk och lätt backend/API-lager.
- För datahämtning används separata scripts i `scripts/`, inte UI-routes som första val.

### Databas

- Neon Postgres.
- Använd `pg` eller annan enkel Postgres-klient.
- Undvik ORM i första versionen om det gör implementationen långsammare.
- SQL-migrationer kan ligga i `db/migrations/`.

### Hosting senare

- Vercel kan användas för Next.js-appen.
- Datajobben kan i början köras lokalt via npm script.
- Produktion/cron bestäms senare.

---

## 6. Föreslagen mappstruktur

```text
/
  app/
    page.js
  db/
    migrations/
      001_initial_schema.sql
  lib/
    db.js
    sources/
      wikipedia.js
      yahoo.js
      fred.js
    utils/
      tickers.js
      dates.js
      logger.js
  scripts/
    fetch-daily.js
  .env.example
  GOALS.md
  PRD.md
  README.md
  package.json
```

---

## 7. Datakällor

### 7.1 S&P 500-komponenter

Källa:

```text
https://en.wikipedia.org/wiki/List_of_S%26P_500_companies
```

Hämta och spara:

- `ticker`
- `yahoo_ticker`
- `company_name`
- `sector`
- `industry`
- `is_active`
- `source`
- `last_seen_at`

Ticker-normalisering:

```js
function toYahooTicker(ticker) {
  return ticker.replaceAll('.', '-');
}
```

Exempel:

```text
BRK.B -> BRK-B
BF.B  -> BF-B
```

---

### 7.2 Yahoo Finance daily candles

Källa:

```text
https://query1.finance.yahoo.com/v8/finance/chart/{YAHOO_TICKER}?range=400d&interval=1d
```

Exempel:

```text
https://query1.finance.yahoo.com/v8/finance/chart/AAPL?range=400d&interval=1d
```

Spara:

- `ticker`
- `date`
- `open`
- `high`
- `low`
- `close`
- `adj_close`, om finns
- `volume`
- `source`
- `created_at`
- `updated_at`

Krav:

- Om en ticker misslyckas ska scriptet fortsätta med nästa ticker.
- Fel ska sparas i fetch-loggen.
- Körningen ska inte skapa dubbletter.

---

### 7.3 FRED index/riskdata

Källor:

```text
https://fred.stlouisfed.org/graph/fredgraph.csv?id=SP500
https://fred.stlouisfed.org/graph/fredgraph.csv?id=VIXCLS
https://fred.stlouisfed.org/graph/fredgraph.csv?id=BAMLH0A0HYM2
```

Serier:

| Series ID | Namn | Användning senare |
|---|---|---|
| `SP500` | S&P 500 close | indexpris och divergens |
| `VIXCLS` | VIX close | riskfilter |
| `BAMLH0A0HYM2` | High Yield OAS | kredit-/riskfilter |

Spara i en generell tabell för market series.

---

## 8. Databasschema

### 8.1 `sp500_constituents`

```sql
create table if not exists sp500_constituents (
  id bigserial primary key,
  ticker text not null unique,
  yahoo_ticker text not null,
  company_name text,
  sector text,
  industry text,
  is_active boolean not null default true,
  source text not null default 'wikipedia',
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_sp500_constituents_active
  on sp500_constituents (is_active);
```

---

### 8.2 `stock_daily_prices`

```sql
create table if not exists stock_daily_prices (
  id bigserial primary key,
  ticker text not null,
  date date not null,
  open numeric,
  high numeric,
  low numeric,
  close numeric,
  adj_close numeric,
  volume bigint,
  source text not null default 'yahoo',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (ticker, date)
);

create index if not exists idx_stock_daily_prices_date
  on stock_daily_prices (date);

create index if not exists idx_stock_daily_prices_ticker_date
  on stock_daily_prices (ticker, date desc);
```

---

### 8.3 `market_series_daily`

```sql
create table if not exists market_series_daily (
  id bigserial primary key,
  series_id text not null,
  date date not null,
  value numeric,
  source text not null default 'fred',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (series_id, date)
);

create index if not exists idx_market_series_daily_series_date
  on market_series_daily (series_id, date desc);
```

---

### 8.4 `data_fetch_runs`

```sql
create table if not exists data_fetch_runs (
  id bigserial primary key,
  job_name text not null,
  status text not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  total_items integer,
  successful_items integer,
  failed_items integer,
  error_message text,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_data_fetch_runs_job_started
  on data_fetch_runs (job_name, started_at desc);
```

---

## 9. Miljövariabler

Skapa `.env.example`:

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST.neon.tech/DBNAME?sslmode=require"
NODE_ENV="development"
```

Senare kan fler läggas till, men fas 1 ska inte kräva API-nycklar.

---

## 10. Scriptkrav

### `npm run fetch:daily`

Ska köra:

```text
1. Starta data_fetch_runs med status running.
2. Hämta S&P 500-komponenter från Wikipedia.
3. Upserta komponenterna till sp500_constituents.
4. Hämta 400d daily candles från Yahoo för varje aktiv ticker.
5. Upserta candles till stock_daily_prices.
6. Hämta FRED-serierna SP500, VIXCLS och BAMLH0A0HYM2.
7. Upserta FRED-värden till market_series_daily.
8. Uppdatera data_fetch_runs med success eller partial_success/failure.
```

### Statusvärden

Använd helst:

```text
running
success
partial_success
failure
```

---

## 11. Felhantering

Krav:

- En ticker som failar får inte stoppa hela jobbet.
- Alla misslyckade tickers ska samlas i `metadata.failedTickers`.
- HTTP-fel, tomma svar och parse-fel ska loggas tydligt.
- Om databasanslutning saknas ska scriptet avslutas med tydligt felmeddelande.
- Om Wikipedia ändrar tabellstruktur ska felet säga att komponentlistan inte kunde parsas.

---

## 12. Idempotens

Scriptet ska kunna köras flera gånger utan att skapa dubbletter.

Använd `insert ... on conflict ... do update` för:

- `sp500_constituents.ticker`
- `stock_daily_prices(ticker, date)`
- `market_series_daily(series_id, date)`

---

## 13. Prestanda och rate limiting

Eftersom Yahoo anropas för cirka 500 tickers:

- Kör inte alla requests helt obegränsat parallellt.
- Använd batch/concurrency på exempelvis 5–10 samtidiga anrop.
- Lägg gärna liten retry-logik för tillfälliga nätverksfel.
- Logga antal lyckade och misslyckade tickers.

Första versionen behöver inte vara snabb. Stabilitet är viktigare än hastighet.

---

## 14. Definition of Done för fas 1

Fas 1 är klar när:

- `npm install` fungerar.
- `.env.example` finns.
- SQL-migration för grundschema finns.
- `npm run fetch:daily` finns.
- Scriptet kan hämta S&P 500-komponenter.
- Scriptet kan hämta Yahoo daily candles för aktier.
- Scriptet kan hämta FRED-serier.
- Data sparas i Neon Postgres.
- Dubbletter undviks.
- Misslyckade tickers loggas.
- README eller kommentarer förklarar hur man kör lokalt.

---

## 15. Nästa fas efter PRD:n

När fas 1 är färdig kan nästa PRD/fas handla om att skapa:

- indikatorberäkningar,
- market breadth daily summary,
- `% above MA20/50/200`,
- advancers/decliners,
- new highs/lows,
- Market Regime Score,
- enkel dashboard.

Men Codex/agenten ska inte implementera detta förrän datagrunden är stabil.

---

## 16. Instruktion till AI-agent/Codex

Implementera endast fas 1.

Prioritera:

1. Enkelhet.
2. Datakvalitet.
3. Tydlig kodstruktur.
4. Upsert/idempotens.
5. Felsökbarhet.

Undvik att bygga features som inte finns i denna PRD.

När implementationen är klar ska agenten redovisa:

- vilka filer som skapats,
- hur man kör migration,
- hur man kör datahämtning,
- vilka tabeller som fylls,
- eventuella kända begränsningar.
