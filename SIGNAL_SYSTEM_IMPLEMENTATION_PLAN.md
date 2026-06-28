# Implementationsplan — Stock Signals signal-system

## Mål

Bygg vidare på befintlig data och indikatorer i `stock-signals` för att skapa ett tydligt swing/position trading-system som kan skicka användbara signaler till Telegram/Discord.

Systemet ska inte bara räkna indikatorer. Det ska kunna avgöra:

- när marknaden är okej att handla
- vilka sektorer som är starka/svaga
- vilka aktier som är bäst kandidater
- vilka signaler som ska skickas
- vilka signaler som ska blockeras
- hur signaler ska dedupliceras
- varför en signal skickades

Backtest kan användas senare för validering, men huvudmålet nu är att bygga ett robust signalflöde.

---

## Del 1 — Signal event queue

### Bygg

Lägg till ett generiskt `signal_events`-lager.

Det ska samla signaler från olika indikatorer/system i en gemensam kö innan de skickas till Telegram/Discord.

### Varför

Just nu finns många indikatorer och summary-lager, men inget tydligt mellanlager som säger:

- denna signal triggade
- den ska skickas
- den har redan skickats
- den är expired/cancelled
- den tillhör en viss kategori
- den ska till en viss kanal

Utan detta blir Telegram/Discord-routingen svår att hålla ren.

### Mål

Efter denna del ska alla framtida signalmodeller kunna skapa standardiserade signal-events utan att själva skicka meddelanden.

---

## Del 2 — Standardisera market regime

### Bygg

Gör befintligt market regime-lager tydligt och konsekvent.

Det ska finnas ett enkelt tre-läges output:

```text
risk_on
neutral
risk_off
```

Detta ska användas som global gate för alla andra signaler.

### Varför

Systemet får inte skicka aggressiva köpsignaler i fel marknadsmiljö.

Market regime är ett av de starkaste lagren i repot eftersom det redan bygger på breadth, VIX, SPX-change, A/D-line och divergences.

### Mål

Alla framtida signalsystem ska kunna läsa samma tydliga regime-status och använda den som filter.

---

## Del 3 — Earnings-filter

### Bygg

Lägg till earnings-data per ticker och ett filter som kan blockera signaler nära rapportdatum.

### Varför

Swing-signaler nära earnings är ofta för riskabla. En bra teknisk signal kan bli värdelös om earnings kommer om 1–3 dagar.

### Mål

Systemet ska kunna veta:

```text
days_to_earnings
is_near_earnings
safe_to_open_new_position
```

Buy-signaler ska kunna blockeras inom ett definierat fönster före/efter earnings.

---

## Del 4 — Relative strength-ranking

### Bygg

Lägg till ett dagligt RS-lager.

Minst:

```text
RS 21d vs SPY
RS 63d vs SPY
RS 126d vs SPY
RS percentile/rank inom S&P 500
```

Senare även:

```text
RS vs sector
RS rank within sector
RS vs sector ETF
```

### Varför

Relative strength är en av de mest användbara saknade delarna. Det gör det möjligt att filtrera fram aktier som faktiskt leder marknaden, inte bara aktier som triggar tekniska signaler.

### Mål

Alla long-system ska kunna kräva att aktien är relativt stark. Alla short/risk-system ska kunna hitta relativ svaghet.

---

## Del 5 — Data quality gates

### Bygg

Lägg till enkla datakvalitetskontroller för viktiga datalager.

Fokus:

- daily price freshness
- 60m intraday coverage
- missing tickers
- stale external sources
- earnings-data freshness
- IVOL/RVOL source status

### Varför

En signal är bara så bra som datan den bygger på. Särskilt TF Sync och externa proxyserier behöver kunna nedgraderas om data saknas eller är för gammal.

### Mål

Systemet ska kunna avgöra om en signal får skapas eller om den ska blockeras på grund av dålig/stale data.

---

## Del 6 — Första produktionssystemet: Regime-Gated Breakout

### Bygg

Bygg första riktiga signalmodellen:

```text
Regime-Gated Breakout
```

Den ska använda befintliga lager:

- market regime
- sector signal
- 20d breakout
- relative volume
- RS rank
- earnings-filter

### Varför

Detta är den mest naturliga första produktionssignalen. Den använder redan starka delar av systemet och är enkel att förklara.

### Mål

Skapa tydliga breakout-signaler endast när:

- marknaden inte är risk-off
- sektorn är stark eller förbättras
- aktien bryter ut
- volymen bekräftar
- aktien har relativ styrka
- earnings inte ligger för nära

Output ska vara ett `signal_event`, inte direkt Telegram/Discord.

---

## Del 7 — Telegram/Discord-routing

### Bygg

Bygg formattering och routing för `signal_events`.

Det ska finnas olika message templates för olika signaltyper.

Exempel:

- breakout
- dip-buy
- sector rotation
- market regime change
- risk-off alert
- daily summary

### Varför

Målet är inte bara att skicka signaler, utan att signalerna ska vara tydliga och användbara.

Ett bra meddelande ska visa:

- ticker
- signaltyp
- sektor
- regime
- RS-rank
- volym
- earnings-risk
- varför signalen triggade

### Mål

När `signal_events` fungerar ska systemet kunna skicka rena, deduplicerade och förklarbara signaler till Telegram/Discord.

---

## Del 8 — Sector Rotation Alert

### Bygg

Bygg ett signal-/summary-system för sektorrotation.

Det ska använda:

- sector signals
- sector breadth
- förändring i % över SMA50/SMA200
- market regime

### Varför

Sektorrotation är en av de starkaste sakerna i befintlig data. Det bör inte bara ligga dolt i dashboard eller tabeller.

### Mål

Systemet ska kunna skicka alerts som:

```text
Sektor går från improving till leading
Sektor försvagas från improving till weakening
Top long-kandidater i stark sektor
Riskvarning i svag sektor
```

---

## Del 9 — Volatility Dip Buyer

### Bygg

Bygg andra aktiespecifika signalmodellen:

```text
Volatility Dip Buyer
```

Den ska använda:

- market regime
- sector signal
- IBS + RSI
- price z-score
- IVOL/RVOL
- SMA200 trendfilter
- earnings-filter

### Varför

Detta fångar pullbacks i starkare miljöer. Det kompletterar breakout-systemet eftersom det hittar dip-köp istället för utbrott.

### Mål

Skapa dip-buy-signaler endast när aktien är översåld men fortfarande befinner sig i en acceptabel trend och marknadsmiljö.

---

## Del 10 — Hantera svagare/research-lager

### Bygg

Nedprioritera eller omklassificera svagare signaler.

Gäller främst:

- PLCE Threshold
- Markov/state
- TF Sync
- RYD OBV Z-score som standalone

### Varför

Dessa kan vara användbara, men bör inte vara primära triggers utan validering.

### Mål

Använd dem som:

```text
confirmation
ranking
research
secondary filter
```

Inte som standalone Telegram/Discord-signaler.

---

## Del 11 — Daglig sammanfattning

### Bygg

Skapa en daglig market/signal summary.

Den kan skickas till Telegram/Discord en gång per dag.

### Varför

Alla signaler behöver inte vara “köp nu”. En daglig sammanfattning gör systemet lättare att följa.

### Mål

Sammanfattningen ska kunna visa:

- dagens market regime
- starkaste sektorer
- svagaste sektorer
- antal nya long-signaler
- antal risk-signaler
- toppkandidater
- blockerade signaler på grund av earnings/risk/data

---

## Rekommenderad byggordning

```text
1. signal_events queue
2. market regime standardisering
3. earnings-filter
4. RS-ranking
5. data quality gates
6. Regime-Gated Breakout
7. Telegram/Discord formatter + routing
8. Sector Rotation Alert
9. Volatility Dip Buyer
10. research/deprioritering av PLCE, Markov och TF Sync
11. daily summary
```

---

## Viktig princip

Bygg inte fler fristående indikatorer först.

Repo har redan mycket data och många indikatorer. Nästa nivå är att göra datan användbar genom:

```text
regime filter
+ ranking
+ signal queue
+ dedup
+ earnings filter
+ tydlig routing
+ förklarbara alerts
```

Målet är ett robust och praktiskt signalsystem, inte fler lösa signaler.
