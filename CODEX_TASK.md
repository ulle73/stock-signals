# CODEX_TASK.md

## Uppgift

Implementera fas 1 för Stock Signals: Data Foundation.

Du ska bygga en fungerande grund för att hämta och lagra marknadsdata.

Läs dessa filer innan du kodar:

1. `GOALS.md`
2. `PRD.md`
3. `DATA_FETCH_FREQUENCY.md`
4. `IMPLEMENTATION_PLAN.md`
5. `db/migrations/001_initial_schema.sql`

---

## Mycket viktigt

Implementera endast datahämtning och databasgrund.

Bygg inte:

- dashboard,
- signaler,
- alerts,
- Market Regime Score,
- intraday polling,
- indikatorberäkningar,
- backtesting.

---

## Teknisk riktning

Använd:

- JavaScript
- Next.js App Router
- Neon Postgres
- `pg`
- scripts i `scripts/`

Första fungerande scripts ska vara:

```bash
npm run db:migrate
npm run fetch:daily
```

---

## Data som ska hämtas

### S&P 500-komponenter

Från Wikipedia:

```text
https://en.wikipedia.org/wiki/List_of_S%26P_500_companies
```

Spara i:

```text
sp500_constituents
```

Ticker-normalisering:

```text
BRK.B -> BRK-B
BF.B  -> BF-B
```

Generell regel:

```js
ticker.replaceAll('.', '-')
```

---

### Yahoo Finance daily candles

För varje aktiv S&P 500-ticker:

```text
https://query1.finance.yahoo.com/v8/finance/chart/{YAHOO_TICKER}?range=400d&interval=1d
```

Spara i:

```text
stock_daily_prices
```

---

### FRED-serier

Hämta:

```text
SP500
VIXCLS
BAMLH0A0HYM2
```

Endpoint:

```text
https://fred.stlouisfed.org/graph/fredgraph.csv?id={SERIES_ID}
```

Spara i:

```text
market_series_daily
```

---

## Fetch-loggning

Varje körning av `npm run fetch:daily` ska skapa/uppdatera en rad i:

```text
data_fetch_runs
```

Statusar:

```text
running
success
partial_success
failure
```

Om vissa tickers misslyckas men jobbet i stort fungerar ska status bli:

```text
partial_success
```

Misslyckade tickers ska sparas i `metadata.failedTickers`.

---

## Acceptanskriterier

Uppgiften är klar när:

1. `npm install` fungerar.
2. `npm run dev` fungerar.
3. `npm run db:migrate` skapar tabellerna.
4. `npm run fetch:daily` hämtar data.
5. Datan sparas i Neon Postgres.
6. Scriptet kan köras flera gånger utan dubbletter.
7. Fetch-run loggas.
8. README är uppdaterad med exakta körsteg.

---

## Rekommenderad testväg

Implementera stöd för:

```env
FETCH_TICKER_LIMIT=10
```

Det gör att man kan testa med 10 tickers innan man kör alla.

Standardbeteende utan limit ska vara att hämta alla aktiva tickers.

---

## Slutrapport

När du är klar, redovisa:

- vilka filer du skapade,
- hur man kör migration,
- hur man kör datahämtning,
- vilka env vars som krävs,
- kända begränsningar,
- hur många tickers som lyckades i testkörning.
