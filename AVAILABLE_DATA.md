# Available data in Stock Signals

Det här dokumentet beskriver vilken data och vilka beräknade indikatorer som finns tillgängliga i repot just nu.

Syftet är att kunna skicka denna sammanställning till en annan AI och säga: "Här är datan jag har. Föreslå olika system, signaler, analyser och sätt att använda den."

Detta dokument beskriver därför **input-data och indikatorlager**, inte backtester, strategier eller resultat. Backtest ska ses som något som kan byggas ovanpå pris + indikatorer.

---

## 1. Universum

### S&P 500-komponenter

Repo/databasen innehåller ett S&P 500-universum med:

- ticker
- Yahoo-ticker
- bolagsnamn
- sektor
- industri
- om tickern är aktiv
- källa
- första/senaste observerade datum i systemet

Det här gör att signaler kan analyseras både per aktie, per sektor och för hela S&P 500-universumet.

---

## 2. Prisdata

### Daily aktiepriser

För aktier i S&P 500-universumet finns daglig OHLCV-data:

- ticker
- date
- open
- high
- low
- close
- adjusted close
- volume
- source

Standardregeln för indikatorberäkningar är:

```text
indicator_price = adj_close ?? close
```

Det betyder att indikatorer normalt räknas på justerad close om den finns, annars vanlig close.

### Daily benchmark-priser

Det finns separat daglig benchmark-prisdata med OHLCV:

- ticker
- date
- open
- high
- low
- close
- adjusted close
- volume
- source

Den används för benchmark/marknadsjämförelse, främst SPY/SPX-liknande marknadslogik beroende på pipeline.

### 60-minuters intraday-priser

Det finns ett separat intraday-lager med 60-minuters candles:

- ticker
- candle timestamp
- session date
- open
- high
- low
- close
- adjusted close
- volume
- source = `yahoo_60m`

Det här används inte som huvudprisdata, utan som separat intraday-/timeframe-underlag.

### Macro/factor/style proxy-priser

Det finns ett separat Yahoo-proxy-lager för macro-, faktor-, sektor- och style-serier:

- symbol
- date
- open
- high
- low
- close
- adjusted close
- volume
- source
- source URL

Det här är prisserier för bredare marknads-/macro-matriser och ska ses som proxy-data.

---

## 3. Makro- och marknadsserier

### FRED/market series daily

Det finns ett generiskt dagligt marknadsserielager:

- series_id
- date
- value
- source

Det används för dagliga externa serier som t.ex. VIX, räntor, kreditspreadar eller andra FRED-liknande marknadsserier beroende på vad som hämtas.

### Global Manufacturing PMI monthly

Det finns ett månatligt globalt PMI-lager:

- country key
- country label
- period date
- PMI-värde
- source URL
- source snippet
- observed timestamp

Det används för att bygga en global manufacturing PMI-matris med trend/risk-on/risk-off-liknande makrobild.

### Europe Growth Indicators monthly

Det finns ett separat månatligt europeiskt growth-lager:

- indicator key
- indicator label
- period date
- value
- source URL
- source snippet
- observed timestamp

Det används som europeisk makro-/tillväxtproxy.

---

## 4. Market breadth

### Daglig S&P 500-bredd

Systemet bygger dagliga breadth-rader för hela S&P 500-universumet:

- active ticker count
- advancers
- decliners
- unchanged
- valid SMA20 count
- above SMA20 count
- percent above SMA20
- valid SMA50 count
- above SMA50 count
- percent above SMA50
- valid SMA200 count
- above SMA200 count
- percent above SMA200
- valid 52-week count
- new 52-week highs
- new 52-week lows
- valid signal date flag

`is_valid_signal_date` används för att undvika signaler innan tillräckligt många aktier har tillräcklig historik.

### Sektorbredder

Samma typ av breadth-data finns även per sektor:

- date
- sector
- active ticker count
- advancers
- decliners
- unchanged
- percent above SMA20
- percent above SMA50
- percent above SMA200
- new 52-week highs
- new 52-week lows
- valid signal date flag

Det här gör det möjligt att analysera sektorrotation och om marknadsrörelser stöds brett eller bara av några sektorer.

### Externa breadth-serier

Det finns ett externt breadth-lager för externa breadth-symboler/serier:

- date
- series key
- symbol
- name
- value
- source
- source URL

Nuvarande externa breadth-indikator bygger på R3TW/MMTW-liknande serier.

---

## 5. Core daily indicators per aktie

Följande basindikatorer beräknas per ticker och datum:

### Pris och trend

- indicator_price
- daily_return_pct
- trend_20d_pct
- pct_from_52w_high
- pct_from_52w_low

### Moving averages

- SMA5
- SMA10
- SMA20
- SMA50
- SMA200

### Volym

- avg_volume20
- relative_volume20
- volume_z20

### Candle-/range-mått

- range_pct
- body_pct

### Volume event classification

Systemet klassificerar volymhändelser med labels som:

- normal
- possible_capitulation
- possible_exhaustion
- accumulation
- distribution
- weak_upside_confirmation

Det finns även en tone/karaktär, t.ex:

- positive
- danger
- warning
- caution
- neutral

---

## 6. Custom indicators per aktie

### RYD OBV Z-score

Beräknar OBV-liknande volymtryck och en 80-dagars z-score.

Tillgängliga fält:

- ryd_obv
- ryd_obv_zscore_80
- ryd_obv_buy_signal
- ryd_obv_sell_signal
- ryd_obv_signal

Signalidé:

- buy när OBV-zscore vänder upp från extremt låg nivå
- sell när OBV-zscore vänder ner från extremt hög nivå

### Price Z-score

Beräknar prisets 20-dagars z-score och ett 20-perioders snitt av z-score.

Tillgängliga fält:

- price_zscore_20
- price_zscore_avg_20
- price_zscore_buy_signal
- price_zscore_sell_signal
- price_zscore_signal

Signalidé:

- buy/sell baserat på när z-score korsar sitt eget snitt i överdrivna lägen

### IBS + RSI

Kombinerar Internal Bar Strength och RSI14.

Tillgängliga fält:

- ibs_value
- rsi14
- ibs_rsi_buy_signal
- ibs_rsi_signal

Signalidé:

- buy när aktien stänger svagt i dagens range och RSI är lågt

### MACD-V

MACD-liknande momentumindikator normaliserad med ATR.

Tillgängliga fält:

- macd_v
- macd_v_buy_signal
- macd_v_sell_signal
- macd_v_active
- macd_v_signal

Signalidé:

- buy när MACD-V passerar en stark triggernivå
- sell när snabb EMA korsar ner under långsam EMA

### 20D Breakout

Beräknar 20-dagars breakoutnivåer.

Tillgängliga fält:

- breakout_20d_high
- breakout_20d_low
- breakout_20d_buy_signal
- breakout_20d_sell_signal
- breakout_20d_signal

Signalidé:

- buy vid brott över 20-dagars high-nivå
- sell vid brott under 20-dagars low-nivå

### PLCE Threshold

Använder FINRA short-volume-data för PLCE som extern specialindikator.

Tillgängliga fält:

- plce_threshold_value
- plce_threshold_buy_signal
- plce_threshold_signal

Signalidé:

- buy när PLCE short volume passerar en fast extremnivå

### TF Sync

Timeframe sync-indikator som jämför om flera tidsramar pekar åt samma håll.

Den använder:

- daily candle
- veckologik från daily candles
- senaste 60m intraday candle

Tillgängliga fält:

- tf_sync_weekly_open
- tf_sync_weekly_close
- tf_sync_daily_green
- tf_sync_daily_red
- tf_sync_weekly_green
- tf_sync_weekly_red
- tf_sync_intraday_green
- tf_sync_intraday_red
- tf_sync_buy_condition
- tf_sync_sell_condition
- tf_sync_buy_signal
- tf_sync_sell_signal
- tf_sync_buy_active
- tf_sync_sell_active
- tf_sync_signal

Signalidé:

- buy när daily, weekly och intraday är gröna samtidigt
- sell när daily, weekly och intraday är röda samtidigt

---

## 7. Options-, volym- och short-interest-relaterade indikatorlager

### OCC daily volume totals / CVOL

Det finns OCC daily volume totals:

- report date
- exchange
- calls
- puts
- ratio
- total volume
- market share
- source/source URL

Det finns även ett beräknat CVOL-indikatorlager:

- cvol_calls
- cvol_puts
- cvol_ratio
- cvol_total_volume
- cvol_market_share
- cvol_zscore_20
- cvol_zscore_15
- cvol_zscore_10
- cvol_price_condition
- cvol_sell_signal_1
- cvol_sell_signal_2
- cvol_sell_signal_3
- cvol_signal

### FINRA short volume / PLCE

Det finns FINRA short-volume-data:

- date
- symbol
- short volume
- short exempt volume
- total volume
- market
- source/source URL

Det finns även ett PLCE-indikatorlager:

- plce_short_volume
- plce_short_exempt_volume
- plce_total_volume
- plce_short_volume_market
- plce_short_volume_zscore_50
- plce_short_volume_zscore_20
- plce_short_volume_price_condition
- plce_short_volume_buy_signal_50
- plce_short_volume_buy_signal_20
- plce_short_volume_extreme_signal
- plce_short_volume_signal

### R3TW/MMTW breadth indicator

Det finns en beräknad breadth-indikator baserad på externa R3TW/MMTW-värden:

- r3tw_value
- mmtw_value
- r3tw_cross_up_20
- mmtw_cross_up_20
- r3tw_mmtw_buy_signal
- r3tw_mmtw_signal

Signalidé:

- buy när båda externa breadth-serierna korsar upp över 20-nivån

### Implied volatility / realised volatility ratio

Det finns ett proxy-lager med pris + implied volatility per asset:

- date
- asset key
- asset name
- asset type
- source symbol
- implied volatility symbol
- close
- adjusted close
- volume
- implied volatility
- source status
- price source
- implied volatility source

Det finns även ett beräknat IVOL/RVOL-signal-lager:

- close
- implied_volatility
- realised_volatility_30d
- realised_volatility_30d_5d_change
- realised_volatility_30d_rising_sharply
- ivol_rvol_ratio
- ivol_rvol_ratio_z_1y
- ivol_rvol_ratio_z_1w_ago
- ivol_rvol_ratio_z_1w_change
- ivol_rvol_ratio_z_1y_min
- ivol_rvol_ratio_z_1y_max
- rvol_20d
- rvol_bucket
- close_above_ma20
- close_above_ma50
- close_above_ma200
- ma20_slope_20d
- ma50_slope_20d
- trend_regime
- range_position_20d
- range_bucket
- ivol_rvol_level
- signal
- action
- opportunity_score
- ivol_rvol_rank
- ivol_rvol_percentile

### GEX/DEX Options Positioning Beta

Det finns ett separat GammaLens-baserat snapshotlager för en konfigurerbar watchlist (default `SPY,QQQ`). Det lagrar leverantörens färdigberäknade data, inte en egen optionskedja:

- source timestamp, source URL och rått JSON-svar
- provider status (`active`/`stale`), cache-flagga och provider quality label
- spot price, call wall, put wall, gamma flip, net GEX och net DEX
- DEX support/resistance, provider ATR och per-strike GEX/DEX-fördelning

Ett separat beräkningslager sparar endast kontextuella råsignaler:

- `gamma_regime`
- `spot_to_gamma_flip_atr`
- `inside_walls`
- `near_gamma_flip`
- `above_call_wall` / `below_put_wall`
- `gex_dex_confluence`
- `gex_dex_signal` (`range`, `flip_risk`, `expansion`, `neutral`, `unknown`)

Detta är inte köp-/säljsignaler och inte ett bevis på faktisk dealer-positionering. Historik byggs upp genom sparade snapshots.

---

## 8. Markov-/state-data per ticker

Det finns ett per-ticker Markov-liknande state-lager:

- ticker
- date
- markov_state
- twenty_day_return
- bull_probability
- sideways_probability
- bear_probability
- markov_total
- markov_stickiness
- sample_size
- signal
- rank_bull
- rank_sell

Detta är inte prisdata i sig utan ett beräknat state-/sannolikhetslager ovanpå historiska rörelser.

---

## 9. Derived market/sector summaries

Det här är sammanfattande indikator-/beslutslager, inte backtestresultat.

### Market signal daily

Dagligt marknadslager med:

- SPX close
- SPX 3d change
- SPX 14d change
- percent above SMA50
- percent above SMA50 3d change
- percent above SMA50 14d change
- percent above SMA200
- percent above SMA200 14d change
- A/D line
- A/D line 14d change
- new highs
- new lows
- VIX
- market_regime_score
- signal
- divergence_status
- short_divergence_status

### Sector signal daily

Per sektor finns:

- sector
- active ticker count
- percent above SMA50
- percent above SMA50 14d change
- percent above SMA200
- percent above SMA200 14d change
- A/D net
- A/D net 14d change
- new 52-week highs
- new 52-week lows
- sector_regime_score
- signal
- reason_summary

Sektorsignaler kan vara:

- leading
- improving
- weakening
- lagging
- mixed

### Position / trading / swing summaries

Det finns även sammanfattande dagliga lager för:

- position_signal_daily
- trading_signal_daily
- swing_signal_daily
- swing_watchlist_daily

Dessa är mer tolkade beslutslager ovanpå pris, breadth och indikatorer. De kan användas som input, men om målet är att uppfinna nya system bör den externa AI:n främst börja från prisdata, breadth-data och råindikatorerna ovan.

---

## 10. Nuvarande datakällor i korthet

- Yahoo Finance daily candles
- Yahoo Finance 60m candles
- Yahoo Finance/Cboe-liknande IV-proxyserier
- Wikipedia S&P 500 constituents
- FRED/market series daily
- OCC daily volume totals
- FINRA short-volume data
- Barchart/external breadth snapshots
- Trading Economics HTML-scrape för global manufacturing PMI
- Europe growth indicator scrape/source layer
- GammaLens GEX/DEX snapshots (SPY/QQQ beta)

---

## 11. Tidsramar som finns

Tillgängliga tidsramar i data/indikatorer:

- Daily aktiepriser
- Daily benchmark-priser
- Daily marknads-/makroserier
- Daily breadth
- Daily sektorbreadth
- Daily indikatorer per aktie
- 60m intraday candles
- Intraday GammaLens GEX/DEX-snapshots för konfigurerad watchlist
- Weekly-derived state via TF Sync
- Monthly makrodata för global PMI och europeiska growth-indikatorer

---

## 12. Viktiga begränsningar

Det här finns inte som stabilt lagrat datalager just nu:

- Tick-by-tick-data
- Orderbok/orderflow
- Fundamentala bolagsdata
- Earnings/calendar-data
- Nyhetsdata
- Insiderköp/insiderförsäljning
- Full, rå options chain per aktie
- Oberoende verifierad dealer-positionering eller GEX/DEX-formel
- Realtidskurser från betald feed

Det går att bygga ovanpå nuvarande system, men just nu är basen främst:

```text
S&P 500 daily OHLCV
+ daily/60m price-derived indicators
+ breadth
+ sector breadth
+ macro/risk proxyserier
+ external volume/short/IV proxyindikatorer
```

---

## 13. Kort sammanfattning för en extern AI

Jag har ett signalsystem för S&P 500 med:

- daily OHLCV per aktie
- 60m intraday candles
- S&P 500 constituents med sektor/industri
- benchmark daily OHLCV
- daily macro/market series
- monthly global/europe macro indicators
- market breadth för hela S&P 500
- sector breadth per sektor
- moving averages 5/10/20/50/200
- daily returns, volume metrics, 20d trend, 52w distance
- volume event classification
- custom indicators: RYD OBV Z-score, price z-score, IBS+RSI, MACD-V, 20d breakout, PLCE threshold, TF Sync
- external indicator layers: OCC/CVOL, FINRA PLCE short volume, R3TW/MMTW breadth, IVOL/RVOL ratio
- Markov/state probabilities per ticker
- derived market, sector, trading, position and swing summary layers

Utgå från den här datan och föreslå möjliga system, signaler, rankingmodeller, riskfilter, watchlists eller analyslager. Utgå inte från befintliga backtester.
