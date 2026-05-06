# INDICATOR_WARMUP_POLICY.md

## Syfte

Det här dokumentet definierar hur Stock Signals ska hantera glidande medelvärden och andra indikatorer som kräver historik.

Viktig princip:

> En indikator får inte räknas som giltig förrän det finns tillräckligt många historiska candles bakom den.

---

## Problemet

Om databasen börjar på ett visst datum och systemet räknar MA200 från första raden blir de första 199 handelsdagarna inte ett riktigt MA200.

Exempel:

```text
Dag 1: bara 1 candle finns
Dag 50: bara 50 candles finns
Dag 199: bara 199 candles finns
Dag 200: första riktiga SMA200-värdet
```

Därför får systemet aldrig behandla tidiga MA-värden som riktiga signalvärden.

---

## Viktig slutsats

För SMA/MA behövs inget manuellt startvärde.

Man ska inte sätta ett konstgjort startvärde för MA200.

Rätt metod är istället:

1. Hämta extra historik.
2. Räkna indikatorn först när tillräcklig historik finns.
3. Markera tidigare datum som `null` eller `not_valid`.
4. Börja signalhistoriken först efter warmup-perioden.

---

## Rekommenderad datahämtning

För fas 1 hämtades 400 dagar för att komma igång snabbt.

För mer robust indikatorberäkning rekommenderas att uppgradera historikhämtningen till minst:

```text
range=2y
interval=1d
```

Alternativt:

```text
range=3y
interval=1d
```

Rekommendation:

```text
MVP: 2y daily history
Bättre: 3y daily history
```

Varför:

- MA200 kräver minst 200 handelsdagar.
- 52-week high/low kräver cirka 252 handelsdagar.
- McClellan/Summation blir stabilare med mer historik.
- Backtest och trendjämförelser blir mer meningsfulla.

---

## Indicator valid dates

### MA20

Första giltiga datum per ticker:

```text
första datum där minst 20 tidigare/inklusive candles finns
```

### MA50

Första giltiga datum per ticker:

```text
första datum där minst 50 tidigare/inklusive candles finns
```

### MA200

Första giltiga datum per ticker:

```text
första datum där minst 200 tidigare/inklusive candles finns
```

### 52-week highs/lows

Första giltiga datum per ticker:

```text
första datum där minst 252 tidigare/inklusive candles finns
```

---

## Market breadth valid date

En market breadth-rad för en viss indikator ska bara räknas på aktier som har giltigt underlag för indikatorn.

Exempel:

```text
pct_above_ma200 = antal aktier med giltig MA200 och close > MA200 / antal aktier med giltig MA200
```

Inte:

```text
antal över MA200 / alla S&P 500-aktier
```

om vissa saknar MA200-data.

---

## Rekommenderad signalstart

Även om data finns från första datumet ska systemet inte börja visa signaler direkt.

Rekommenderad signalstart:

```text
första datum där minst 95 % av aktiva tickers har giltig MA200 och 52-week lookback
```

Detta kan sparas som:

```text
is_valid_signal_date = true/false
```

på framtida `market_breadth_daily`-rader.

---

## Adjusted close eller close?

För historiska indikatorer bör systemet i första hand använda:

```text
adj_close om det finns, annars close
```

Motivering:

- `adj_close` hanterar splits och utdelningsjusteringar bättre.
- Det gör historiska MA-värden mer jämförbara över tid.

Men systemet ska vara konsekvent:

```text
indicator_price = adj_close ?? close
```

Denna beräknade prisserie kan användas för MA20/50/200 och 52-week highs/lows.

---

## Jämförelse mot TradingView/Investing

Det kan finnas små skillnader mot TradingView, Investing eller andra dataleverantörer eftersom de kan använda:

- annan datakälla,
- annan justeringsmetod,
- annan hantering av utdelningar/splits,
- olika indexkomponenter vid historiska datum,
- close vs adjusted close.

Målet är inte exakt tick-för-tick-matchning mot varje extern plattform.

Målet är en konsekvent intern breadth-engine där alla aktier behandlas på samma sätt.

---

## Implementation requirement för fas 2

När `calculate:daily` byggs ska det:

1. Aldrig räkna MA20/50/200 som giltigt innan full lookback finns.
2. Sätta MA-värden till `null` om lookback saknas.
3. Räkna breadth-procent på antal aktier med giltigt underlag.
4. Markera om en market breadth-rad är giltig för signal eller endast warmup.
5. Inte skapa manuella startvärden för SMA.

---

## Slutlig regel

> Hämta mer historik än du tänker analysera. Räkna indikatorer först efter full warmup. Använd aldrig konstgjorda startvärden för SMA.
