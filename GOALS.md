# GOALS.md

## Projekt: Stock Signals

Målet är att bygga grunden till ett eget signalsystem för S&P 500, men första fasen ska **endast** handla om att hämta, normalisera och lagra marknadsdata korrekt.

Det här projektet ska börja som en stabil data-engine. Inga trading-signaler, ingen dashboard, inga alerts och ingen AI-tolkning ska byggas i första steget.

---

## Övergripande mål

Bygg en databasdriven grund som varje dag kan:

1. Hämta aktuell S&P 500-komponentlista.
2. Hämta historisk daily prisdata för alla S&P 500-aktier.
3. Hämta basdata för S&P 500-index, VIX och High Yield Spread.
4. Spara datan strukturerat i Neon Postgres.
5. Göra datan redo för senare indikatorer som MA20, MA50, MA200, advancers, decliners, new highs/lows, A/D-line, McClellan och divergenser.

---

## Viktig princip

Första versionen ska inte försöka skapa den perfekta marknadssignalen.

Första versionen ska bara svara på frågan:

> Kan vi stabilt hämta all rådata som behövs för att senare bygga ett robust breadth-baserat signalsystem?

Om svaret är ja är första fasen lyckad.

---

## Fas 1: Data foundation

### Ska byggas

- Next.js-projekt med JavaScript.
- API-/backend-logik i Next.js, men håll datajobben separerade från UI.
- Neon Postgres som databas.
- Skript eller route/cron-kompatibel funktion för att hämta data.
- Databastabeller för:
  - S&P 500-komponenter.
  - Daily stock prices.
  - Market index daily prices.
  - Data fetch logs.

### Ska inte byggas ännu

- Dashboard.
- Market Regime Score.
- Trading-signaler.
- Live alerts.
- Intraday polling.
- MA20/MA50/MA200-beräkning.
- A/D-line.
- McClellan.
- Divergenslogik.
- Backtesting.

---

## Datakällor i fas 1

### S&P 500-komponenter

Primär källa:

- Wikipedia: `https://en.wikipedia.org/wiki/List_of_S%26P_500_companies`

Behov:

- Ticker.
- Yahoo-kompatibel ticker.
- Bolagsnamn.
- Sektor.
- Industri, om tillgängligt.

Ticker-normalisering:

- `BRK.B` ska sparas som original ticker men Yahoo-symbol ska vara `BRK-B`.
- `BF.B` ska sparas som original ticker men Yahoo-symbol ska vara `BF-B`.
- Generell regel: Yahoo ticker = original ticker där `.` ersätts med `-`.

---

### Aktiepriser

Primär källa:

- Yahoo Finance chart endpoint.

Exempel:

```text
https://query1.finance.yahoo.com/v8/finance/chart/AAPL?range=400d&interval=1d
```

Krav:

- Hämta minst 400 handelsdagar daily candles per ticker.
- Spara open, high, low, close, adjusted close om tillgängligt, volume och datum.
- Hantera misslyckade tickers utan att hela jobbet kraschar.
- Logga fel per ticker.

---

### Index/riskdata

Primär källa:

- FRED CSV endpoints.

Serier:

```text
SP500             = S&P 500 daily close
VIXCLS            = VIX daily close
BAMLH0A0HYM2      = ICE BofA US High Yield Index Option-Adjusted Spread
```

CSV-format:

```text
https://fred.stlouisfed.org/graph/fredgraph.csv?id=SP500
https://fred.stlouisfed.org/graph/fredgraph.csv?id=VIXCLS
https://fred.stlouisfed.org/graph/fredgraph.csv?id=BAMLH0A0HYM2
```

---

## Fas 1 acceptanskriterier

Fas 1 är klar när följande fungerar:

1. Projektet kan installeras med `npm install`.
2. Projektet kan köras lokalt med `npm run dev`.
3. Det finns ett tydligt script, exempelvis `npm run fetch:daily`, som:
   - hämtar S&P 500-komponenter,
   - hämtar 400 dagar daily data för varje aktiv ticker,
   - hämtar SP500, VIXCLS och BAMLH0A0HYM2 från FRED,
   - sparar allt i Neon Postgres,
   - loggar lyckade och misslyckade hämtningar.
4. Dubbletter skapas inte om scriptet körs flera gånger.
5. Data sparas med `upsert` där det är rimligt.
6. Det finns en README-sektion eller instruktion i PRD som visar exakt vilka env vars som krävs.

---

## Nästa fas, senare

När datahämtningen är stabil kan nästa fas lägga till:

- MA20, MA50, MA200.
- % aktier över MA20/50/200.
- Advancers/decliners.
- New highs/new lows.
- A/D-line.
- McClellan Oscillator.
- Market Regime Score.
- Daglig rapport.
- Intraday breadth pulse.
- Live alerts.

Men detta ska inte implementeras i första steget.
