# FRED Source URLs - Phase 1

## Important secret note

The repository is public. Do **not** commit the real FRED API key to this file.

Use this environment variable instead:

```env
FRED_API_KEY=your_fred_api_key_here
```

All URLs below use this placeholder:

```text
FRED_API_KEY
```

Runtime code should replace it from `process.env.FRED_API_KEY`.

Base endpoint:

```text
https://api.stlouisfed.org/fred/series/observations?series_id=SERIES_ID&api_key=FRED_API_KEY&file_type=json
```

## Main conclusion

The indicator that can be built most directly from FRED is:

```text
docs/indicators/macro-matrix-us-high-frequency-growth-data.md
```

Other matrix indicators can use FRED only partially, mainly for rates, VIX, dollar, FX, and some commodity proxies.

## Indicator: macro-matrix-us-high-frequency-growth-data.md

Reference image:

```text
docs/indicators/pictures/macro-matrix-us-high-frequency-growth-data.png
```

### Trade / exports / imports

| Row key | Display name | FRED series_id | Transform | Direct URL |
|---|---|---|---|---|
| exports_yoy | Exports Y/Y % | BOPTEXP | YoY via `units=pc1` | `https://api.stlouisfed.org/fred/series/observations?series_id=BOPTEXP&api_key=FRED_API_KEY&file_type=json&units=pc1` |
| imports_yoy | Imports Y/Y % | BOPTIMP | YoY via `units=pc1` | `https://api.stlouisfed.org/fred/series/observations?series_id=BOPTIMP&api_key=FRED_API_KEY&file_type=json&units=pc1` |
| exports_goods_yoy_proxy | Exports of Goods Y/Y % | BOPGEXP | YoY via `units=pc1` | `https://api.stlouisfed.org/fred/series/observations?series_id=BOPGEXP&api_key=FRED_API_KEY&file_type=json&units=pc1` |
| imports_goods_yoy_proxy | Imports of Goods Y/Y % | BOPGIMP | YoY via `units=pc1` | `https://api.stlouisfed.org/fred/series/observations?series_id=BOPGIMP&api_key=FRED_API_KEY&file_type=json&units=pc1` |

### Production / retail / vehicles

| Row key | Display name | FRED series_id | Transform | Direct URL |
|---|---|---|---|---|
| industrial_production_yoy | Industrial Production Y/Y % | INDPRO | YoY via `units=pc1` | `https://api.stlouisfed.org/fred/series/observations?series_id=INDPRO&api_key=FRED_API_KEY&file_type=json&units=pc1` |
| retail_sales_food_services_yoy | Retail Sales & Food Services Y/Y % | RSAFS | YoY via `units=pc1` | `https://api.stlouisfed.org/fred/series/observations?series_id=RSAFS&api_key=FRED_API_KEY&file_type=json&units=pc1` |
| retail_sales_ex_motor_parts_yoy | Retail Sales Ex Motor Vehicles & Parts Y/Y % | RSFSXMV | YoY via `units=pc1` | `https://api.stlouisfed.org/fred/series/observations?series_id=RSFSXMV&api_key=FRED_API_KEY&file_type=json&units=pc1` |
| domestic_auto_sales_yoy_proxy | Domestic Auto Sales Y/Y % | DAUTOSA | YoY via `units=pc1` | `https://api.stlouisfed.org/fred/series/observations?series_id=DAUTOSA&api_key=FRED_API_KEY&file_type=json&units=pc1` |
| total_vehicle_sales_yoy_proxy | Total Vehicle Sales Y/Y % | TOTALSA | YoY via `units=pc1` | `https://api.stlouisfed.org/fred/series/observations?series_id=TOTALSA&api_key=FRED_API_KEY&file_type=json&units=pc1` |

### Labor / jobs

| Row key | Display name | FRED series_id | Transform | Direct URL |
|---|---|---|---|---|
| nonfarm_payrolls_yoy | Non-Farm Payrolls Y/Y % | PAYEMS | YoY via `units=pc1` | `https://api.stlouisfed.org/fred/series/observations?series_id=PAYEMS&api_key=FRED_API_KEY&file_type=json&units=pc1` |
| initial_jobless_claims_raw | Initial Jobless Claims | ICSA | raw weekly | `https://api.stlouisfed.org/fred/series/observations?series_id=ICSA&api_key=FRED_API_KEY&file_type=json` |
| initial_jobless_claims_yoy | Initial Jobless Claims Y/Y % | ICSA | weekly to monthly average + YoY | `https://api.stlouisfed.org/fred/series/observations?series_id=ICSA&api_key=FRED_API_KEY&file_type=json&frequency=m&aggregation_method=avg&units=pc1` |

### Inventories / orders / capacity

| Row key | Display name | FRED series_id | Transform | Direct URL |
|---|---|---|---|---|
| business_inventories_yoy | Business Inventories Y/Y % | BUSINV | YoY via `units=pc1` | `https://api.stlouisfed.org/fred/series/observations?series_id=BUSINV&api_key=FRED_API_KEY&file_type=json&units=pc1` |
| new_orders_durable_goods_yoy | New Orders Durable Goods Y/Y % | DGORDER | YoY via `units=pc1` | `https://api.stlouisfed.org/fred/series/observations?series_id=DGORDER&api_key=FRED_API_KEY&file_type=json&units=pc1` |
| capacity_utilization_rate | Capacity Utilization Rate | TCU | raw level | `https://api.stlouisfed.org/fred/series/observations?series_id=TCU&api_key=FRED_API_KEY&file_type=json` |
| capacity_utilization_mom_change | Capacity Utilization MoM Change | TCU | change via `units=chg` | `https://api.stlouisfed.org/fred/series/observations?series_id=TCU&api_key=FRED_API_KEY&file_type=json&units=chg` |
| manufacturers_inventories_yoy | Manufacturers Inventories Y/Y % | AMTMTI | YoY via `units=pc1` | `https://api.stlouisfed.org/fred/series/observations?series_id=AMTMTI&api_key=FRED_API_KEY&file_type=json&units=pc1` |

### Inflation / income / savings / liquidity

| Row key | Display name | FRED series_id | Transform | Direct URL |
|---|---|---|---|---|
| pce_yoy | PCE Y/Y % | PCEPI | YoY via `units=pc1` | `https://api.stlouisfed.org/fred/series/observations?series_id=PCEPI&api_key=FRED_API_KEY&file_type=json&units=pc1` |
| core_pce_yoy | Core PCE Y/Y % | PCEPILFE | YoY via `units=pc1` | `https://api.stlouisfed.org/fred/series/observations?series_id=PCEPILFE&api_key=FRED_API_KEY&file_type=json&units=pc1` |
| personal_income_yoy | Personal Income Y/Y % | PI | YoY via `units=pc1` | `https://api.stlouisfed.org/fred/series/observations?series_id=PI&api_key=FRED_API_KEY&file_type=json&units=pc1` |
| personal_saving_rate | Personal Saving Rate | PSAVERT | raw level | `https://api.stlouisfed.org/fred/series/observations?series_id=PSAVERT&api_key=FRED_API_KEY&file_type=json` |
| m2_money_supply_yoy | M2 Money Supply Y/Y % | M2SL | YoY via `units=pc1` | `https://api.stlouisfed.org/fred/series/observations?series_id=M2SL&api_key=FRED_API_KEY&file_type=json&units=pc1` |
| m1_money_supply_yoy | M1 Money Supply Y/Y % | M1SL | YoY via `units=pc1` | `https://api.stlouisfed.org/fred/series/observations?series_id=M1SL&api_key=FRED_API_KEY&file_type=json&units=pc1` |

### Leading / confidence / regional surveys

| Row key | Display name | FRED series_id | Transform | Direct URL |
|---|---|---|---|---|
| consumer_sentiment_michigan | Consumer Sentiment, Michigan | UMCSENT | raw level / MoM / z-score | `https://api.stlouisfed.org/fred/series/observations?series_id=UMCSENT&api_key=FRED_API_KEY&file_type=json` |
| philadelphia_fed_general_activity | Philadelphia Fed General Business Activity | GACDFSA066MSFRBPHI | raw level / MoM | `https://api.stlouisfed.org/fred/series/observations?series_id=GACDFSA066MSFRBPHI&api_key=FRED_API_KEY&file_type=json` |
| oecd_leading_indicator_us_proxy | OECD Leading Indicator US | USALOLITOAASTSAM | raw level | `https://api.stlouisfed.org/fred/series/observations?series_id=USALOLITOAASTSAM&api_key=FRED_API_KEY&file_type=json` |
| oecd_leading_indicator_us_yoy_proxy | OECD Leading Indicator US Y/Y | USALOLITOAASTSAM | YoY via `units=pc1` | `https://api.stlouisfed.org/fred/series/observations?series_id=USALOLITOAASTSAM&api_key=FRED_API_KEY&file_type=json&units=pc1` |

### ISM / PMI candidates to verify

These are useful candidates but should be verified before hard-coding in production.

| Row key | Display name | FRED series_id | Transform | Direct URL | Status |
|---|---|---|---|---|---|
| ism_manufacturing_index_candidate | ISM Manufacturing Index / PMI | NAPM | PMI 50-line rule | `https://api.stlouisfed.org/fred/series/observations?series_id=NAPM&api_key=FRED_API_KEY&file_type=json` | verify |
| ism_manufacturing_new_orders_candidate | ISM Manufacturing New Orders | NAPMNOI | PMI 50-line rule | `https://api.stlouisfed.org/fred/series/observations?series_id=NAPMNOI&api_key=FRED_API_KEY&file_type=json` | verify |
| ism_manufacturing_production_candidate | ISM Manufacturing Production | NAPMPI | PMI 50-line rule | `https://api.stlouisfed.org/fred/series/observations?series_id=NAPMPI&api_key=FRED_API_KEY&file_type=json` | verify |
| ism_manufacturing_inventories_candidate | ISM Manufacturing Inventories | NAPMII | PMI 50-line rule | `https://api.stlouisfed.org/fred/series/observations?series_id=NAPMII&api_key=FRED_API_KEY&file_type=json` | verify |

## Indicator: macro-matrix-global-manufacturing-pmi.md

FRED can only help partially. Use FRED for US proxies and some global/US macro context. Exact global PMI by country usually needs another source.

| Row key | Display name | FRED series_id | Transform | Direct URL | Match quality |
|---|---|---|---|---|---|
| us_manufacturing_pmi_candidate | US Manufacturing PMI / ISM proxy | NAPM | PMI 50-line rule | `https://api.stlouisfed.org/fred/series/observations?series_id=NAPM&api_key=FRED_API_KEY&file_type=json` | candidate/proxy |
| us_industrial_production_yoy_proxy | US Industrial Production Y/Y | INDPRO | YoY | `https://api.stlouisfed.org/fred/series/observations?series_id=INDPRO&api_key=FRED_API_KEY&file_type=json&units=pc1` | proxy |

## Indicator: macro-matrix-growth-data-base-effects.md

This matrix appears Swedish/Nordic/OECD/KI/PMI-heavy, so it cannot be built fully from FRED. FRED can only be used as a proxy/template for the US-equivalent methodology.

Useful US equivalents from FRED:

| Row key | Display name | FRED series_id | Transform | Direct URL | Match quality |
|---|---|---|---|---|---|
| industrial_production_yoy_us_proxy | Industrial Production Y/Y US proxy | INDPRO | YoY + base effects | `https://api.stlouisfed.org/fred/series/observations?series_id=INDPRO&api_key=FRED_API_KEY&file_type=json&units=pc1` | proxy |
| retail_sales_yoy_us_proxy | Retail Sales Y/Y US proxy | RSAFS | YoY + base effects | `https://api.stlouisfed.org/fred/series/observations?series_id=RSAFS&api_key=FRED_API_KEY&file_type=json&units=pc1` | proxy |
| vehicle_sales_yoy_us_proxy | Vehicle Sales Y/Y US proxy | TOTALSA | YoY + base effects | `https://api.stlouisfed.org/fred/series/observations?series_id=TOTALSA&api_key=FRED_API_KEY&file_type=json&units=pc1` | proxy |
| consumer_sentiment_us_proxy | Consumer Sentiment US proxy | UMCSENT | level / MoM | `https://api.stlouisfed.org/fred/series/observations?series_id=UMCSENT&api_key=FRED_API_KEY&file_type=json` | proxy |

## Indicator: macro-matrix-europe-growth-indicators.md

This should not be built mainly from FRED. Use Eurostat/ECFIN/OECD/ZEW/IFO/ECB instead. FRED may have occasional mirrored/proxy series, but source quality should be checked separately.

## Indicator: macro-matrix-equity-sector-style-regime-performance.md

This should not be built mainly from FRED. Use Stooq/Yahoo/ETF/index proxies for monthly adjusted close/returns.

## Indicator: macro-matrix-sector-factor-regime-performance.md

FRED can support rates, FX, VIX and selected commodities.

### Volatility / rates / FX

| Row key | Display name | FRED series_id | Transform | Direct URL |
|---|---|---|---|---|
| vix | VIX | VIXCLS | level / z-score / change | `https://api.stlouisfed.org/fred/series/observations?series_id=VIXCLS&api_key=FRED_API_KEY&file_type=json` |
| dollar_index_broad | Dollar Index, broad | DTWEXBGS | level / change | `https://api.stlouisfed.org/fred/series/observations?series_id=DTWEXBGS&api_key=FRED_API_KEY&file_type=json` |
| usd_sek | USD/SEK | DEXSDUS | level / change | `https://api.stlouisfed.org/fred/series/observations?series_id=DEXSDUS&api_key=FRED_API_KEY&file_type=json` |
| us_30y_treasury_yield | US 30Y Treasury Yield | DGS30 | level / change | `https://api.stlouisfed.org/fred/series/observations?series_id=DGS30&api_key=FRED_API_KEY&file_type=json` |
| us_10y_treasury_yield | US 10Y Treasury Yield | DGS10 | level / change | `https://api.stlouisfed.org/fred/series/observations?series_id=DGS10&api_key=FRED_API_KEY&file_type=json` |
| us_2y_treasury_yield | US 2Y Treasury Yield | DGS2 | level / change | `https://api.stlouisfed.org/fred/series/observations?series_id=DGS2&api_key=FRED_API_KEY&file_type=json` |

### Commodities

| Row key | Display name | FRED series_id | Transform | Direct URL |
|---|---|---|---|---|
| brent_crude | Brent crude | DCOILBRENTEU | returns / trend / z-score | `https://api.stlouisfed.org/fred/series/observations?series_id=DCOILBRENTEU&api_key=FRED_API_KEY&file_type=json` |
| natural_gas | Natural Gas | DHHNGSP | returns / trend / z-score | `https://api.stlouisfed.org/fred/series/observations?series_id=DHHNGSP&api_key=FRED_API_KEY&file_type=json` |
| gold | Gold | GOLDAMGBD228NLBM | returns / trend / z-score | `https://api.stlouisfed.org/fred/series/observations?series_id=GOLDAMGBD228NLBM&api_key=FRED_API_KEY&file_type=json` |
| copper_proxy | Copper global price proxy | PCOPPUSDM | returns / trend / z-score | `https://api.stlouisfed.org/fred/series/observations?series_id=PCOPPUSDM&api_key=FRED_API_KEY&file_type=json` |

## Indicator: implied-volatility-ratio-rvol-short-squeeze.md

FRED can provide VIX and some macro/market volatility proxies, but it does not provide complete ETF-level implied volatility. Use CBOE/options sources for exact IV by ETF.

| Row key | Display name | FRED series_id | Transform | Direct URL | Match quality |
|---|---|---|---|---|---|
| vix_sp500_vol_proxy | VIX / S&P 500 implied volatility proxy | VIXCLS | level / z-score | `https://api.stlouisfed.org/fred/series/observations?series_id=VIXCLS&api_key=FRED_API_KEY&file_type=json` | exact for VIX, proxy for ETF IV |

## Recommended Phase 1 implementation

Build a FRED-only first version of:

```text
macro-matrix-us-high-frequency-growth-data.md
```

Use partial FRED support for:

```text
macro-matrix-sector-factor-regime-performance.md
implied-volatility-ratio-rvol-short-squeeze.md
```

Do not try to force these to be FRED-only:

```text
macro-matrix-europe-growth-indicators.md
macro-matrix-growth-data-base-effects.md
macro-matrix-pmi-growth-momentum.md
macro-matrix-equity-sector-style-regime-performance.md
```

## Example runtime helper

```ts
export function fredUrl(seriesId: string, params: Record<string, string> = {}) {
  const url = new URL('https://api.stlouisfed.org/fred/series/observations');
  url.searchParams.set('series_id', seriesId);
  url.searchParams.set('api_key', process.env.FRED_API_KEY ?? '');
  url.searchParams.set('file_type', 'json');
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return url.toString();
}
```
