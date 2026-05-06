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

## Miljövariabler

Kopiera `.env.example` till `.env.local`:

```bash
cp .env.example .env.local
```

Fyll i:

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST.neon.tech/DBNAME?sslmode=require"
```

---

## Förväntade scripts

När implementationen är klar bör dessa scripts finnas:

```bash
npm run dev
npm run db:migrate
npm run fetch:daily
```

---

## Förväntat fas 1-resultat

Efter `npm run fetch:daily` ska databasen innehålla:

- aktiva S&P 500-komponenter i `sp500_constituents`,
- daily candles i `stock_daily_prices`,
- SP500/VIX/HY spread i `market_series_daily`,
- körlogg i `data_fetch_runs`.

Scriptet ska vara idempotent: att köra det flera gånger ska inte skapa dubbletter.
