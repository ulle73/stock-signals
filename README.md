# Stock Signals

Ett framtida marknadsbreddsbaserat signalsystem för S&P 500.

Första versionen fokuserar endast på datahämtning och lagring:

- hämta S&P 500-komponenter,
- hämta daily candles från Yahoo Finance,
- hämta SP500/VIX/HY spread från FRED,
- spara allt i Neon Postgres,
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

- dashboard,
- trading-signaler,
- Market Regime Score,
- intraday polling,
- alerts,
- AI-analys.

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

### 3. Kör migration

```bash
npm run db:migrate
```

Det skapar:

- `sp500_constituents`
- `stock_daily_prices`
- `market_series_daily`
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

---

## Scripts

```bash
npm run dev
npm run db:migrate
npm run fetch:daily
```

---

## Vad `fetch:daily` gör

1. Hämtar S&P 500-komponenter från Wikipedia.
2. Normaliserar Yahoo-tickers, t.ex. `BRK.B -> BRK-B`.
3. Upsertar komponenter till `sp500_constituents`.
4. Hämtar 400 dagar daily candles från Yahoo för varje aktiv ticker.
5. Upsertar candles till `stock_daily_prices`.
6. Hämtar `SP500`, `VIXCLS` och `BAMLH0A0HYM2` från FRED.
7. Upsertar FRED-data till `market_series_daily`.
8. Loggar körningen i `data_fetch_runs`.

---

## Förväntat fas 1-resultat

Efter `npm run fetch:daily` ska databasen innehålla:

- aktiva S&P 500-komponenter i `sp500_constituents`,
- daily candles i `stock_daily_prices`,
- SP500/VIX/HY spread i `market_series_daily`,
- körlogg i `data_fetch_runs`.

Scriptet är byggt för att vara idempotent: att köra det flera gånger ska inte skapa dubbletter.

---

## Nästa fas senare

När datahämtningen är verifierad kan nästa fas lägga till:

- MA20/50/200,
- breadth summaries,
- advancers/decliners,
- new highs/lows,
- Market Regime Score,
- dashboard,
- intraday pulse och alerts.
