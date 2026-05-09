# DATA_FETCH_FREQUENCY.md

## Syfte

Det här dokumentet definierar hur ofta Stock Signals ska hämta data från Yahoo Finance och andra källor.

Grundprincipen är att olika typer av data ska hämtas olika ofta. Historisk daily-data ska inte hämtas lika ofta som intraday/current-price-data.

---

## Rekommenderad frekvens

### Fas 1: Data Foundation

I fas 1 ska systemet endast hämta daily-data.

Rekommenderad körning:

```text
1 gång per handelsdag efter USA-börsens stängning
Tid: sent på kvällen svensk tid, men före 00:00 UTC om datumet i externa breadth-snapshots ska matcha USA-marknadsdagen
```

Yahoo Finance daily endpoint:

```text
https://query1.finance.yahoo.com/v8/finance/chart/{YAHOO_TICKER}?range=400d&interval=1d
```

Syfte:

- fylla databasen med 400 dagar historik,
- uppdatera senaste daily candle,
- säkerställa att MA20/50/200 kan räknas senare,
- skapa stabil grund för breadth-indikatorer.

I fas 1 ska Yahoo alltså inte pollas var 15:e minut.

---

## Fas 2: Daily update

När fas 1 fungerar ska daily-jobbet fortsätta köras en gång per handelsdag efter stängning.

Daily-jobbet ska vara den officiella datakällan för:

- end-of-day close,
- daily candles,
- MA20/50/200-underlag,
- advancers/decliners på daily-basis,
- new highs/new lows,
- A/D-line,
- McClellan,
- Market Regime Score.
- externa end-of-day indikatorserier som OCC, FINRA eller Barchart-breadth när sådana läggs till

Rekommenderad frekvens:

```text
1 gång per handelsdag
```

Rekommenderad tid:

```text
ca 21:53 UTC
ca 22:53 CET
ca 23:53 CEST
```

Den här tiden är vald som kompromiss:

- USA-marknaden har stängt
- Yahoo/FRED/OCC/FINRA/Barchart har haft tid att uppdatera
- workflowen kör fortfarande före midnatt UTC, vilket gör att Barchart-baserade snapshotserier kan sparas på rätt marknadsdatum utan extra datum-omräkning

När nya externa daily-källor läggs till ska de normalt:

- köras i samma dagliga GitHub Actions-workflow
- ligga som separata fetch/calculate-steg
- inte byggas in i `scripts/fetch-daily.js`

Det ger ett samlat dagligt jobb utan att blanda ihop Yahoo/FRED-kärnan med externa indikator-specifika hämtningar.

---

## Fas 3: Intraday breadth pulse

När daily-systemet fungerar kan ett separat intraday-jobb byggas.

Det ska inte ersätta daily-jobbet. Det ska endast visa hur marknaden utvecklas under dagen.

Rekommenderad standardfrekvens:

```text
var 15:e minut under USA-börsens öppettider
```

USA-börsens ordinarie öppettider svensk tid är normalt ungefär:

```text
15:30–22:00 svensk tid
```

Observera att svensk/amerikansk sommartid kan skapa tillfälliga skillnader.

---

## Intraday Yahoo endpoint

För intraday kan Yahoo chart endpoint användas med kortare intervall:

```text
https://query1.finance.yahoo.com/v8/finance/chart/{YAHOO_TICKER}?range=1d&interval=5m
```

Alternativ:

```text
https://query1.finance.yahoo.com/v8/finance/chart/{YAHOO_TICKER}?range=1d&interval=15m
```

Rekommendation:

- använd 15m som standard för systemets intraday breadth summary,
- använd 5m endast för live-pulse/debug om det behövs senare,
- använd inte 1m i MVP eftersom det ger mer brus och fler anrop.

---

## Vad ska hämtas var 15:e minut?

För varje aktiv S&P 500-ticker:

- latest intraday price,
- day open,
- previous close, om endpointen ger detta,
- latest timestamp.

Systemet ska sedan jämföra latest price mot de daily MA-värden som räknades från daily-datan.

Exempel senare:

```text
price_now > daily_ma20
price_now > daily_ma50
price_now > daily_ma200
price_now > previous_close
```

---

## Vad ska inte göras var 15:e minut?

Systemet ska inte hämta 400 dagar historik var 15:e minut.

Undvik detta:

```text
503 tickers × 400d candles × var 15:e minut
```

Det är onödigt, långsamt och kan trigga rate limits.

Rätt upplägg:

```text
Daily job:
- hämta 400d/compact daily historik
- körs en gång per dag

Intraday job:
- hämta endast dagens intraday/current data
- körs var 15:e minut
```

---

## Lagringsstrategi

### Spara permanent

- `stock_daily_prices`
- `market_series_daily`
- `market_breadth_daily`, när den finns senare
- `market_intraday_breadth_snapshots`, när den finns senare
- `market_alerts`, när den finns senare

### Spara kortvarigt

Detaljerade intraday-snapshots per aktie ska inte sparas permanent i gratisdatabas.

Rekommenderad retention:

```text
7–14 dagar
```

---

## Slutlig rekommendation

För implementationen gäller:

```text
Fas 1:
Yahoo daily data: 1 gång per handelsdag efter stängning

Senare intraday-fas:
Yahoo intraday/current data: var 15:e minut under börsens öppettider

Senare live-pulse:
Eventuellt var 5:e minut, men endast summary och inte permanent rådata
```

Viktigast:

> Bygg daily datahämtningen först. Lägg inte på 15-minutershämtning förrän daily-pipelinen är stabil.
