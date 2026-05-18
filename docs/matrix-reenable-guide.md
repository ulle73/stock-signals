# Matrix guide

Den här filen finns för att det ska gå snabbt att lägga tillbaka matrix-sektionerna i dashboarden utan att leta genom hela koden igen.

## Status nu

Matrix-sektionerna är borttagna från startsidan i [C:\dev\stock-signals\app\page.js](C:\dev\stock-signals\app\page.js), men all underliggande kod finns kvar.

Följande sektioner renderas **inte längre** på `/`:

- `UsGrowthSection`
- `GlobalManufacturingPmiSection`
- `EuropeGrowthSection`
- `PmiGrowthMomentumSection`
- `GrowthDataBaseEffectsSection`
- `SectorFactorRegimePerformanceClientSection`
- `EquitySectorStyleRegimePerformanceSection`
- `ImpliedVolatilityRatioSection`

Dessutom hämtar [C:\dev\stock-signals\lib\repositories\dashboard.js](C:\dev\stock-signals\lib\repositories\dashboard.js) **inte längre** `macroMatrix` eller `globalManufacturingPmiMatrix` i `getDashboardSnapshot()`.

## Snabb återaktivering

För att lägga tillbaka matrixer på startsidan:

1. Lägg tillbaka importerna i [C:\dev\stock-signals\app\page.js](C:\dev\stock-signals\app\page.js).
2. Lägg tillbaka respektive JSX-sektion i slutet av sidan, före `StockSignalBoardClientSection`.
3. Om du återaktiverar `UsGrowthSection`, lägg också tillbaka `macroMatrix` i [C:\dev\stock-signals\lib\repositories\dashboard.js](C:\dev\stock-signals\lib\repositories\dashboard.js) och `const macroMatrix = snapshot.macroMatrix;` i [C:\dev\stock-signals\app\page.js](C:\dev\stock-signals\app\page.js).
4. Kör de fetch/calculate-kommandon som hör till respektive matrix innan du startar appen.

## Exakt dashboard-koppling

### `UsGrowthSection`

Behöver detta i [C:\dev\stock-signals\lib\repositories\dashboard.js](C:\dev\stock-signals\lib\repositories\dashboard.js):

```js
import { getMacroMatrixUsGrowthSnapshot } from './macro-matrix-us-growth.js';
```

Och detta tillbaka i `Promise.all(...)` i `getDashboardSnapshot()`:

```js
getMacroMatrixUsGrowthSnapshot(),
```

Och detta i retur-objektet:

```js
macroMatrix,
```

Och detta i [C:\dev\stock-signals\app\page.js](C:\dev\stock-signals\app\page.js):

```js
const macroMatrix = snapshot.macroMatrix;
<UsGrowthSection matrix={macroMatrix} />
```

## Matrix-katalog

| Matrix | UI-entrypoint | Datakälla i koden | Lagring/tabeller | Kräver kommando innan render? | Kommentar |
|---|---|---|---|---|---|
| USA high frequency growth | [C:\dev\stock-signals\app\us-growth-section.js](C:\dev\stock-signals\app\us-growth-section.js) | [C:\dev\stock-signals\lib\repositories\macro-matrix-us-growth.js](C:\dev\stock-signals\lib\repositories\macro-matrix-us-growth.js) | Ingen egen tabell, hämtar FRED live via `fetchFredSeries()` | Nej, men den fetchar FRED vid render | 30 min in-memory cache, inte DB-baserad idag |
| Global manufacturing PMI | [C:\dev\stock-signals\app\global-manufacturing-pmi-section.js](C:\dev\stock-signals\app\global-manufacturing-pmi-section.js) | [C:\dev\stock-signals\lib\repositories\global-manufacturing-pmi.js](C:\dev\stock-signals\lib\repositories\global-manufacturing-pmi.js) | `global_manufacturing_pmi_monthly` | Ja | Kör `npm run fetch:global-manufacturing-pmi` |
| Europe growth indicators | [C:\dev\stock-signals\app\europe-growth-section.js](C:\dev\stock-signals\app\europe-growth-section.js) | [C:\dev\stock-signals\lib\repositories\europe-growth-indicators.js](C:\dev\stock-signals\lib\repositories\europe-growth-indicators.js) | `europe_growth_indicators_monthly` | Ja | Kör `npm run fetch:europe-growth` |
| PMI growth momentum | [C:\dev\stock-signals\app\pmi-growth-momentum-section.js](C:\dev\stock-signals\app\pmi-growth-momentum-section.js) | [C:\dev\stock-signals\lib\repositories\macro-matrix-pmi-growth.js](C:\dev\stock-signals\lib\repositories\macro-matrix-pmi-growth.js) | Ingen egen tabell, hämtar FRED live via `fetchFredSeries()` | Nej, men den fetchar FRED vid render | 30 min in-memory cache, inte DB-baserad idag |
| Growth data base effects | [C:\dev\stock-signals\app\growth-data-base-effects-section.js](C:\dev\stock-signals\app\growth-data-base-effects-section.js) | [C:\dev\stock-signals\lib\repositories\macro-matrix-growth-data-base-effects.js](C:\dev\stock-signals\lib\repositories\macro-matrix-growth-data-base-effects.js) | Ingen egen tabell, hämtar FRED live via `fetchFredSeries()` | Nej, men den fetchar FRED vid render | 30 min in-memory cache, inte DB-baserad idag |
| Sector/factor regime performance | [C:\dev\stock-signals\app\sector-factor-regime-performance-client-section.js](C:\dev\stock-signals\app\sector-factor-regime-performance-client-section.js) → [C:\dev\stock-signals\app\api\sector-factor-regime-performance\route.js](C:\dev\stock-signals\app\api\sector-factor-regime-performance\route.js) | [C:\dev\stock-signals\lib\repositories\macro-matrix-sector-factor-regime-performance.js](C:\dev\stock-signals\lib\repositories\macro-matrix-sector-factor-regime-performance.js) | `macro_matrix_yahoo_proxy_daily` + render-beräknad PMI-regim | Ja | Kör `npm run fetch:macro-matrix-yahoo-proxy`. Själva regimlagret använder fortfarande `getMacroMatrixPmiGrowthSnapshot()` |
| Equity sector/style regime performance | [C:\dev\stock-signals\app\equity-sector-style-regime-performance-section.js](C:\dev\stock-signals\app\equity-sector-style-regime-performance-section.js) | [C:\dev\stock-signals\lib\repositories\macro-matrix-equity-sector-style-regime-performance.js](C:\dev\stock-signals\lib\repositories\macro-matrix-equity-sector-style-regime-performance.js) | `macro_matrix_yahoo_proxy_daily` + render-beräknad PMI-regim | Ja | Kör `npm run fetch:macro-matrix-yahoo-proxy` |
| Implied volatility ratio | [C:\dev\stock-signals\app\implied-volatility-ratio-section.js](C:\dev\stock-signals\app\implied-volatility-ratio-section.js) | [C:\dev\stock-signals\lib\repositories\implied-volatility-ratio-signals.js](C:\dev\stock-signals\lib\repositories\implied-volatility-ratio-signals.js) | `implied_volatility_proxy_source_daily`, `implied_volatility_ratio_signals_daily` | Ja | Kör `npm run fetch:implied-volatility-proxy` och sedan `npm run calculate:implied-volatility-ratio` |

## Kommandon per matrix

### Minsta nödvändiga för DB-baserade matrixer

```powershell
npm run fetch:global-manufacturing-pmi
npm run fetch:europe-growth
npm run fetch:macro-matrix-yahoo-proxy
npm run fetch:implied-volatility-proxy
npm run calculate:implied-volatility-ratio
```

### Om du vill fylla allt matrisrelaterat i ett svep

```powershell
npm run fetch:global-manufacturing-pmi
npm run fetch:europe-growth
npm run fetch:macro-matrix-yahoo-proxy
npm run fetch:implied-volatility-proxy
npm run calculate:implied-volatility-ratio
```

Det här täcker de matrixer som idag faktiskt läser från sparade tabeller.

## Viktiga tekniska noter

### 1. Inte alla matrixer är DB-baserade idag

Följande matrixer använder fortfarande render-tids-FRED i repositories:

- [C:\dev\stock-signals\lib\repositories\macro-matrix-us-growth.js](C:\dev\stock-signals\lib\repositories\macro-matrix-us-growth.js)
- [C:\dev\stock-signals\lib\repositories\macro-matrix-pmi-growth.js](C:\dev\stock-signals\lib\repositories\macro-matrix-pmi-growth.js)
- [C:\dev\stock-signals\lib\repositories\macro-matrix-growth-data-base-effects.js](C:\dev\stock-signals\lib\repositories\macro-matrix-growth-data-base-effects.js)

Om målet senare är att **alla** matrixer ska vara helt DB-only behöver dessa tre flyttas till separata fetch-/lagringsteg, precis som Yahoo-proxyerna redan har flyttats.

### 2. Live-Yahoo på render är borttaget

De två regime-matrixarna hämtar inte längre 10 års Yahoo-data direkt under sidrender.

De läser nu i stället från:

- [C:\dev\stock-signals\lib\repositories\macro-matrix-yahoo-proxy-source.js](C:\dev\stock-signals\lib\repositories\macro-matrix-yahoo-proxy-source.js)
- tabellen `macro_matrix_yahoo_proxy_daily`
- scriptet [C:\dev\stock-signals\scripts\fetch-macro-matrix-yahoo-proxy.js](C:\dev\stock-signals\scripts\fetch-macro-matrix-yahoo-proxy.js)

Just nu svarar dessutom [C:\dev\stock-signals\app\api\sector-factor-regime-performance\route.js](C:\dev\stock-signals\app\api\sector-factor-regime-performance\route.js) med `410` för att markera att matrix-sektionen är avstängd tills den uttryckligen läggs tillbaka.

### 3. Workflow-koppling

Macro-matrix Yahoo-proxyerna är redan inkopplade i:

- [C:\dev\stock-signals\.github\workflows\fetch-daily.yml](C:\dev\stock-signals\.github\workflows\fetch-daily.yml)

Så om workflow-körningen används behöver du normalt inte lägga till ett extra steg för just de två Yahoo-baserade regim-matrixarna.

## Rekommenderad återstart-ordning

Om du senare vill slå på matrixerna igen med minsta möjliga friktion:

1. Kör `npm run db:migrate`
2. Kör matris-kommandona ovan
3. Lägg tillbaka önskade sektioner i [C:\dev\stock-signals\app\page.js](C:\dev\stock-signals\app\page.js)
4. Om `UsGrowthSection` ska tillbaka: återställ `macroMatrix` i [C:\dev\stock-signals\lib\repositories\dashboard.js](C:\dev\stock-signals\lib\repositories\dashboard.js)
5. Kör `npm run dev`

## Vad som togs bort nu

Det här arbetet tog bort matrix-renderingen från dashboarden, men tog **inte** bort:

- matrix-komponenterna
- repositories
- tabeller
- scripts
- workflow-kopplingar

Det innebär att matrixerna senare kan återaktiveras snabbt utan att byggas om från noll.
