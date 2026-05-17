//@version=5
indicator("RYD MODIFIED", shorttitle="RYD COMBINED MODIFIED", overlay=true,  max_lines_count=500, max_labels_count = 500)



// Hämta historiska data för aktien
S_symbol = "USI:CVOL"
S_price = request.security(S_symbol, "D", close)

// Funktion för att beräkna z-score
S_zscore(S_src, S_length) =>
    S_mean = ta.sma(S_src, S_length)
    S_stdev = ta.stdev(S_src, S_length)
    S_zscore = (S_src - S_mean) / S_stdev

// Använd z-score funktionen för tre olika periodinställningar
S_length_1 = input(20, title="Z-Score Length 2.25")
S_length_2 = input(15, title="Z-Score Length 3")
S_length_3 = input(10, title="Z-Score Length 4")

S_z_score_1 = S_zscore(S_price, S_length_1)
S_z_score_2 = S_zscore(S_price, S_length_2)
S_z_score_3 = S_zscore(S_price, S_length_3)

// Ange ett villkor för att CVOLE måste vara över 30000000 och föregående två dagar över 20000000 respektive 10000000
S_price_condition = S_price > 30000000 and S_price[1] > 20000000 and S_price[2] > 10000000

// Skapa säljsignaler för varje z-score och periodinställning
S_sell_signal_1 = S_z_score_1 > 1.5 and S_price_condition
S_sell_signal_2 = S_z_score_2 > 2.5 and S_price_condition
S_sell_signal_3 = S_z_score_3 > 3 and S_price_condition

// Markera säljsignaler med olika färger och former (triangel nedåt)
plotshape(S_sell_signal_1, color=color.rgb(0, 4, 255), style=shape.triangledown, location=location.abovebar, size=size.small)
plotshape(S_sell_signal_2, color=color.rgb(0, 4, 255), style=shape.triangledown, location=location.abovebar, size=size.small)
plotshape(S_sell_signal_3, color=color.rgb(0, 4, 255), style=shape.triangledown, location=location.abovebar, size=size.small)


// // Hämta historiska data för aktien

//A_symbol = "USI:PVLCE" 
A_symbol = "FINRA:PLCE_SHORT_VOLUME"

A_price = request.security(A_symbol, "D", close)

// Funktion för att beräkna z-score
A_zscore(A_src, A_length) =>
    A_mean = ta.sma(A_src, A_length)
    A_stdev = ta.stdev(A_src, A_length)
    A_zscore = (A_src - A_mean) / A_stdev

// Använd z-score funktionen för tre olika periodinställningar
//A_length_1 = input(20, title="Z-Score Length 2.25")
A_length_2 = input(50, title="Z-Score Length 3")
A_length_3 = input(20, title="Z-Score Length 4")

//A_z_score_1 = A_zscore(A_price, A_length_1)
A_z_score_2 = A_zscore(A_price, A_length_2)
A_z_score_3 = A_zscore(A_price, A_length_3)

// Ange ett villkor för att PVLCE måste vara över 1750000
A_price_condition = A_price > 1750000 //1000000

// Skapa köpsignaler för varje z-score och periodinställning
//A_buy_signal_1 = A_z_score_1 > 2.25 and A_price_condition
A_buy_signal_2 = A_z_score_2 > 3 and A_price_condition
A_buy_signal_3 = A_z_score_3 > 3 and A_price_condition

// Markera köpsignaler med olika färger och former
//plotshape(A_buy_signal_1, color=color.green, style=shape.triangleup, location=location.belowbar, size=size.small)
plotshape(A_buy_signal_2, color=color.rgb(0, 4, 255), style=shape.triangleup, location=location.belowbar, size=size.small)
plotshape(A_buy_signal_3, color=color.rgb(0, 4, 255), style=shape.triangleup, location=location.belowbar, size=size.small)


///////////////////////////////////////////////////////////


// Function to request security data
getSecurityData(symbol, timeframe, src) =>
    request.security(symbol, timeframe, src)

// Get INDEX:R3TW and INDEX:MMTW data
r3twData = getSecurityData("INDEX:R3TW", "D", close)
mmtwData = getSecurityData("INDEX:MMTW", "D", close)

// Condition for both tickers crossing above 20
buySignalCondition = ta.crossover(r3twData, 20) and ta.crossover(mmtwData, 20)

// Plotting buy signal
plotshape(series=buySignalCondition, title="Buy Signal", color=color.rgb(0, 100, 131), style=shape.triangleup, size=size.tiny, location=location.belowbar)

///////////////////////////////////////////////////////

// Get INDEX:HIGN and INDEX:LOWN data
hignData = getSecurityData("INDEX:HIGN", "D", close)
lownData = getSecurityData("INDEX:LOWN", "D", close)

// Calculate cumulative new highs and new lows
var float cumulativeHign = na
var float cumulativeLown = na

if (ta.change(hignData) > 0)
    cumulativeHign := na(cumulativeHign[1]) ? 1 : cumulativeHign[1] + 1
else
    cumulativeHign := na(cumulativeHign[1]) ? 0 : cumulativeHign[1]

if (ta.change(lownData) > 0)
    cumulativeLown := na(cumulativeLown[1]) ? 1 : cumulativeLown[1] + 1
else
    cumulativeLown := na(cumulativeLown[1]) ? 0 : cumulativeLown[1]

// Calculate mean and standard deviation of cumulative new highs
meanHign = ta.sma(cumulativeHign, 10)
stdevHign = ta.stdev(cumulativeHign, 10)

// Calculate Z-score of cumulative new highs
zscoreHign = (cumulativeHign - meanHign) / stdevHign

// Calculate mean and standard deviation of cumulative new lows
meanLown = ta.sma(cumulativeLown, 10)
stdevLown = ta.stdev(cumulativeLown, 10)

// Calculate Z-score of cumulative new lows
zscoreLown = (cumulativeLown - meanLown) / stdevLown

// Calculate cumulative Z-score
cumulativeZscore = zscoreHign + zscoreLown

// Condition for red background when cumulative Z-score is under 0
bgcolorCondition = cumulativeZscore < 2

// Plotting signals
//bgcolor(bgcolorCondition ? color.new(color.red, 90) : na)
//plot(cumulativeZscore, title="Cumulative Z-score", color=color.blue)

// Plotting buy signal as a triangle
plotshape(series=bgcolorCondition ? cumulativeZscore : na, title="CUM new HI-LO", color=color.rgb(0, 100, 131), style=shape.triangledown, size=size.tiny, location=location.abovebar)

/////////////////////////////////////////////////






// Get VVIX and VIX data
vvixData = getSecurityData("CBOE:VVIX", "D", close)
vixData = getSecurityData("CBOE:VIX", "D", close)
gldData = getSecurityData("TVC:GOLD", "D", close)

// Calculate the correlation coefficients
correlation_vvix_7d = ta.correlation(close, vvixData, 7)
correlation_vix_7d = ta.correlation(close, vixData, 7)
correlation_gld_50d = ta.correlation(close, gldData, 50)

// Check conditions for sell signal
sellSignalCondition = correlation_vvix_7d > 0 and correlation_vix_7d > 0 and correlation_gld_50d > 0.6

// Plotting sell signal on DAILY and WEEKLY timeframes
dailyClose = request.security(syminfo.tickerid, "D", close)
weeklyClose = request.security(syminfo.tickerid, "W", close)

plotshape(series=sellSignalCondition and close == dailyClose, title="VIX-VVIX-GOLD (Daily)", color=color.rgb(127, 1, 158), style=shape.triangledown, size=size.tiny, location=location.abovebar)
plotshape(series=sellSignalCondition and close == weeklyClose, title="VIX-VVIX-GOLD (Weekly)", color=color.rgb(127, 1, 158), style=shape.triangledown, size=size.tiny, location=location.abovebar)

// // Get VIX and SPX data
// //vixData = getSecurityData("CBOE:VIX", "D", close)
// spxData = getSecurityData("SP:SPX", "D", close)

// // Calculate the correlation coefficient for 60 days
// correlation_vix_spx_60d = ta.correlation(close, vixData, 60)

// // Check condition for the signal
// signalCondition = correlation_vix_spx_60d > 0

// // Plotting signal on DAILY and WEEKLY timeframes
// plotshape(series=signalCondition and close == dailyClose, title="VIX-SPX (Daily)", color=color.rgb(212, 0, 255), style=shape.triangledown, size=size.tiny, location=location.abovebar)
// plotshape(series=signalCondition and close == weeklyClose, title="VIX-SPX (Weekly)", color=color.rgb(212, 0, 255), style=shape.triangledown, size=size.tiny, location=location.abovebar)


// Get VVIX and VIX data
//vvixData = getSecurityData("CBOE:VVIX", "D", close)
//vixData = getSecurityData("CBOE:VIX", "D", close)
spxData1 = getSecurityData("SP:SPX", "D", close)

// Calculate the correlation coefficients
//correlation_vvix_7d = ta.correlation(close, vvixData, 7)
correlation_vix_7d1 = ta.correlation(close, vixData, 50)
correlation_spx_50d = ta.correlation(close, spxData1, 50)

// Check conditions for sell signal
sellSignalCondition1 = correlation_vix_7d1 > 0 and correlation_spx_50d > 0.6

// Plotting sell signal on DAILY and WEEKLY timeframes
dailyClose1 = request.security(syminfo.tickerid, "D", close)
weeklyClose1 = request.security(syminfo.tickerid, "W", close)

plotshape(series=sellSignalCondition1 and close == dailyClose1, title="VIX-VVIX-GOLD (Daily)", color=color.rgb(255, 0, 221), style=shape.triangledown, size=size.tiny, location=location.abovebar)
plotshape(series=sellSignalCondition1 and close == weeklyClose1, title="VIX-VVIX-GOLD (Weekly)", color=color.rgb(255, 0, 191), style=shape.triangledown, size=size.tiny, location=location.abovebar)










///////////////////////////// NOT IN TABLE///////////////////////////
len = input.int(39, minval=1, title="Length")
src = input(close, title="Source")
offset = input.int(title="Offset", defval=0, minval=-500, maxval=500)

// Kolla om det aktuella tidsramen är veckovis (weekly)
isWeeklyTimeframe = timeframe.isweekly

// Beräkna EMA bara om det är ett veckovis tidsram
out = isWeeklyTimeframe ? ta.ema(src, len) : na

plot(out, title="EMA", color=color.rgb(0, 183, 255), offset=offset, linewidth = 3)

ma(source, length, type) =>
    switch type
        "SMA" => ta.sma(source, length)
        "EMA" => ta.ema(source, length)
        "SMMA (RMA)" => ta.rma(source, length)
        "WMA" => ta.wma(source, length)
        "VWMA" => ta.vwma(source, length)

typeMA = input.string(title = "Method", defval = "SMA", options=["SMA", "EMA", "SMMA (RMA)", "WMA", "VWMA"], group="Smoothing")
smoothingLength = input.int(title = "Length", defval = 5, minval = 1, maxval = 100, group="Smoothing")

smoothingLine = ma(out, smoothingLength, typeMA)
plot(smoothingLine, title="Smoothing Line", color=#f37f20, offset=offset, display=display.none)



len1 = input.int(12, minval=1, title="Length")

// Kolla om det aktuella tidsramen är veckovis (monthly)
isMonthlyTimeframe = timeframe.ismonthly

// Beräkna EMA bara om det är ett veckovis tidsram
out1 = isMonthlyTimeframe ? ta.ema(src, len1) : na

plot(out1, title="EMA", color=color.rgb(255, 0, 234), offset=offset, linewidth = 3)


len22 = input.int(200, minval=1, title="Length")

// Kolla om det aktuella tidsramen är veckovis (monthly)
isDailyTimeframe = timeframe.isdaily

// Beräkna EMA bara om det är ett veckovis tidsram
out11 = isDailyTimeframe ? ta.ema(src, len22) : na

plot(out11, title="EMA", color=color.rgb(255, 196, 0, 55), offset=offset, linewidth = 1)







// //Volatility MACD
// // Getting inputs
// // === MACD-V enligt [(EMA12 − EMA26) / ATR(26)] * 100 ===
// v_src      = input.source(close, "VOL Source")
// v_fastLen  = input.int(12,  "Fast EMA",  minval=1)
// v_slowLen  = input.int(26,  "Slow EMA",  minval=1)
// v_atrLen   = input.int(26,  "ATR Length", minval=1)
// v_level    = input.float(70, "Trigger-nivå (MACD-V)")

// v_fastEMA  = ta.ema(v_src, v_fastLen)
// v_slowEMA  = ta.ema(v_src, v_slowLen)
// v_atr      = ta.atr(v_atrLen)

// // MACD-V
// v_macdv    = 100 * (v_fastEMA - v_slowEMA) / v_atr

// // Grön triangel när MACD-V korsar UPP genom 70
// plotshape(ta.crossover(v_macdv, v_level),title="MACD-V cross > 70",location=location.belowbar,color=color.new(color.lime, 0),style=shape.triangleup,size=size.tiny)

// === MACD-V & bakgrundsfärg-logik ===
v_src      = input.source(close, "VOL Source")
v_fastLen  = input.int(12,  "Fast EMA",  minval=1)
v_slowLen  = input.int(26,  "Slow EMA",  minval=1)
v_atrLen   = input.int(26,  "ATR Length", minval=1)
v_level    = input.float(70, "Trigger-nivå (MACD-V)")
v_bgAlpha  = input.int(60,  "Bakgrund transparens (0-100)", minval=0, maxval=100)
v_bgColor  = color.rgb(0, 40, 0)  // mörk-mörk grön

v_fastEMA  = ta.ema(v_src, v_fastLen)
v_slowEMA  = ta.ema(v_src, v_slowLen)
v_atr      = ta.atr(v_atrLen)

// MACD-V: [(EMA12 − EMA26) / ATR(26)] × 100
v_macdv    = 100 * (v_fastEMA - v_slowEMA) / v_atr

// Tillstånd: ON efter första giltiga trigger; OFF efter bear-korsning
var bool paintBg = false
// starta om: om vi inte redan är på och MACD-V är > 70 (t.ex. direkt vid start) ELLER om vi nyss korsade upp
startNow = (not paintBg and v_macdv > v_level) or ta.crossover(v_macdv, v_level)
// stoppa när fast EMA korsar under slow EMA
stopNow  = ta.crossunder(v_fastEMA, v_slowEMA)

if startNow
    paintBg := true
if stopNow
    paintBg := false

bgcolor(paintBg ? color.new(v_bgColor, v_bgAlpha) : na)

// (valfritt) debug-plots så du ser vad som händer

hline(v_level, "70-linje", color=color.new(color.lime, 50))
plotchar(startNow, "Start BG", "▲", location.top, color=color.lime)
plotchar(stopNow,  "Stop BG",  "▼", location.top, color=color.red)



// (Valfritt) plotta hjälplinje om du vill se nivån i egen panel
// hline(v_level, "MACD-V 70-nivå", color=color.new(color.green, 50))

 






///////////////////////////// TABLE ////////////////////////////////////
//Läs in data för "USI:PVLCE"
//symbol = "USI:PVLCE"
symbol = "FINRA:PLCE_SHORT_VOLUME"

pvlce = request.security(symbol, "D", close)

// Definiera en tröskel för köpsignalen
var float threshold = 3000000

// Generera köpsignal när "USI:PVLCE" är över tröskeln
plotshape(pvlce > threshold ? true : false, style=shape.triangleup, location=location.belowbar, color=color.rgb(0, 4, 255), size=size.normal, title = "PUT Volume extremes")

/////////////////////////////////////////////////////////////////////////



/////////////////////////// NOT IN TABLE ///////////////////////////////
// // Definiera symbolerna för indexen
// index1 = request.security("INDEX:MMTW", "D", close)
// index2 = request.security("INDEX:MMFI", "D", close)
// index3 = request.security("INDEX:MMOH", "D", close)
// index4 = request.security("INDEX:MMTH", "D", close)

// // Kolla om alla 4 index är över 50%
// all_above_50 = (index1 > 50) and (index2 > 50) and (index3 > 50) and (index4 > 50)

// // Kolla om alla 4 index är under 50%
// all_under_50 = (index1 < 50) and (index2 < 50) and (index3 < 50) and (index4 < 50)

// // Skapa en köpsignal när alla index är över 50%
// buy_signal = all_above_50 ? 1 : 0

// // Skapa en säljsignal när alla index är under 50%
// sell_signal = all_under_50 ? -1 : 0

// // Rita en pil på grafen baserat på signalen
// plotshape(buy_signal == 1, style=shape.arrowup, color=color.rgb(0, 150, 2), location=location.belowbar, size=size.tiny, title='50% over MA BULLISH')
// plotshape(sell_signal == -1, style=shape.arrowdown, color=color.rgb(165, 2, 2), location=location.abovebar, size=size.tiny, title='50% over MA BEARISH')

///////////////////////////////////////////////////////////////////////////


///////////////////////////////////////////////// TABLE /////////////////////////////////////
//Inputs
// exchange = input.string("NYSE", options = ["NYSE", "Nasdaq"])
// MA_lenght = input(50, "MA lenght")

// // Data
// NetHL = exchange == "NYSE" ? request.security("MAHN", "D", close)-request.security("MALN","D",close) : request.security("MAHQ", "D", close)-request.security("MALQ","D",close)

// // Determine color of bars
// bar_color = NetHL >= 0 ? color.green : color.red


// // Triangle signal when NetHL crosses up through -400
// plotshape(ta.crossover(NetHL, -400) ? 1 : na, style=shape.triangleup, location=location.belowbar, color=color.purple, size=size.tiny, title="NetHL Cross Above -400")

///////////////////////////////////////////////////////////////////////



// //Momentum Check
// cciVal = ta.cci(hlc3, 34)
// cciLong = cciVal > 100 ? 1 : -1
// cciShort = cciVal < -50 ? 1 : -1
// plotshape(series=cciShort > 0, title='Momentum Bearish', style=shape.diamond, color=color.new(#ff0000, 0), location=location.abovebar, display=display.all)
// plotshape(series=cciLong > 0, title='Momentum Bullish', style=shape.diamond, color=color.new(#00ff08, 0), location=location.belowbar, display=display.all)


///////////////////////////////////////// TABLE ///////////////////////////////////////
// Indicator 1: Yield Curve

TwoYear = request.security("TVC:US02Y", "D", close)
TenYear = request.security("TVC:US10Y", "D", close)
TwoYearOld = request.security("TVC:US02Y", "D", close[5])
TenYearOld = request.security("TVC:US10Y", "D", close[5])

EFFR = request.security("FRED:FEDFUNDS", "D", close)
smoothEFFR = ta.sma(EFFR, 5)
prevEFFR = request.security("FRED:FEDFUNDS", "D", close[1])
prevsmoothEFFR = ta.sma(prevEFFR, 5)

FRR2_10 = (5*TenYear - TwoYear) / (4*TenYear)
FRRold = (5*TenYearOld - TwoYearOld) / (4*TenYearOld)

var isLong = false
var isShort = false
var isInverted = false

buySignal = not isLong and (FRR2_10 > 1.10) and (smoothEFFR < EFFR) and (prevsmoothEFFR >= prevEFFR)
sellSignal = not isShort and isInverted and (FRR2_10 > 1.005)
invertedSignal = not isInverted and (FRR2_10 < 1)

if (buySignal)
    isInverted := false
    isLong := true
    isShort := false

if (sellSignal)
    isInverted := false
    isLong := false
    isShort := true

if (invertedSignal)
    isInverted := true
    isLong := false
    isShort := false

// Plot the buy triangle from Indicator 1
plotshape(buySignal ? FRR2_10 - 0.02 : na, style=shape.triangleup, location=location.belowbar, color=color.rgb(255, 255, 255), size=size.large, title="10Y-2Y YIELD Buy")

// Plot the sell triangle from Indicator 1
plotshape(sellSignal ? FRR2_10 + 0.02 : na, style=shape.triangledown, location=location.abovebar, color=color.rgb(255, 255, 255), size=size.large, title="10y-2Y YIELD Sell")

///////////////////////////////////////////////////////////////////////



// ThreeMonth = request.security("TVC:US03MY", "D", close)
// TioYear = request.security("TVC:US10Y", "D", close)

// FRR10_3M = (TioYear - ThreeMonth) / TioYear

// var signalAbove = false
// var signalBelow = false

// if (ta.crossover(FRR10_3M, 0))
//     signalAbove := bar_index

// if (ta.crossunder(FRR10_3M, 0))
//     signalBelow := bar_index

// plotshape(signalAbove == bar_index ? 1 : na, style=shape.triangleup, location=location.belowbar ,color=color.rgb(255, 255, 255), size=size.small, title="10Y-3M BUY")
// plotshape(signalBelow == bar_index ? 1 : na, style=shape.triangledown, location=location.abovebar, color=color.rgb(255, 255, 255), size=size.small, title="10Y-3M SELL")
















////////////////////////////////////////////////// TABLE ////////////////////////////////////////////////
// Indicator 2: Combined Signal with NDTW

// Check if the timeframe is less than or equal to 60 minutes
//is_intraday = timeframe.isintraday and ta.change(timeframe.multiplier) <= 29
// is_intraday = timeframe.isintraday and timeframe.multiplier <= 29

// // Percent of Stocks Above VWAP
// ob = input(60, title="Overbought Level")
// os = input(40, title="Oversold Level")

// PCTABOVEVWAP = request.security("PCTABOVEVWAP.US", "", close)

// bgcolor(PCTABOVEVWAP > ob and is_intraday ? color.rgb(76, 175, 79, 80) : na)
// bgcolor(PCTABOVEVWAP < os and is_intraday ? color.rgb(255, 82, 82, 80) : na)

// plotshape(ta.crossover(PCTABOVEVWAP, 50) and is_intraday, title="VWAP bull cross", location=location.belowbar, color=color.rgb(255, 0, 221), style=shape.triangleup, size=size.tiny )
// plotshape(ta.crossunder(PCTABOVEVWAP, 50) and is_intraday, title="VWAP bear cross", location=location.abovebar, color=color.rgb(255, 0, 221), style=shape.triangledown, size=size.tiny)

//////////////////////////////////////////////////////////////

///////////////////////////////////////// TABLE ////////////////////////////////////////////

// Get the value of "INDEX-MMFD" with security
mmfiValue = request.security("MMFI", "D", close)

// Get the value of "INDEX-MMFD" with security
mmfdValue = request.security("MMFD", "D", close)

// Get the value of "INDEX-NDTW" with security
ndtwValue = request.security("NDTW", "D", close)

// Create a conditional buy signal when "INDEX-MMFD" crosses below -20 and "NDTW" is above -25
buySignal1 = ta.crossunder(mmfdValue, -20) and ndtwValue > -25

// Create a conditional sell signal when "INDEX-MMFD" crosses above -20 and "NDTW" is below -25
sellSignal1 = ta.crossover(ndtwValue, -75) and mmfiValue < -70

// Draw a green triangle when the buy signal occurs on the price chart
plotshape(buySignal1, style=shape.triangleup, location=location.belowbar, color=color.rgb(0, 100, 131), size=size.tiny, title="BREDD Buy")

// Draw an orange triangle when the sell signal occurs on the price chart
plotshape(sellSignal1, style=shape.triangledown, location=location.abovebar, color=color.rgb(0, 100, 131), size=size.tiny, title="BREDD Sell")

/////////////////////////////////////////////////////

//////////////////////////////////////////// TABLE ////////////////////////////////////////////////

// ZScore Indicator
price = close
lenght = input(20)
Zavglenght = input(20)

oneSD = ta.stdev(price, lenght)
avgClose = ta.sma(price, lenght)
ofoneSD = oneSD*price[1]
Zscorevalue = ((price-avgClose)/oneSD)
avgZv = ta.sma(Zscorevalue, 20)

avgZscore = ta.sma(Zscorevalue, Zavglenght)
Zscore = ((price-avgClose)/oneSD)

conditionbuy_z = ta.crossover(Zscore, avgZscore) and avgZscore < -1
conditionsell_z = ta.crossunder(Zscore, avgZscore) and avgZscore > 1.4

////////////////////////////////////////////////////////

////////////////////////////////// TABLE //////////////////////////////////////

// Another Z-Score indicator with a different period and levels of -1.5 and 1.5
price2 = close
lenght2 = input(20) // Change the period for the second Z-Score indicator
Zavglenght2 = input(20) // Change the period for the second Z-Score indicator

oneSD2 = ta.stdev(price2, lenght2)
avgClose2 = ta.sma(price2, lenght2)
ofoneSD2 = oneSD2*price2[1]
Zscorevalue2 = ((price2-avgClose2)/oneSD2)
avgZv2 = ta.sma(Zscorevalue2, 20)

avgZscore2 = ta.sma(Zscorevalue2, Zavglenght2)
Zscore2 = ((price2-avgClose2)/oneSD2)

conditionbuy_z2 = ta.crossover(Zscore2, avgZscore2) and avgZscore2 < -1.5
conditionsell_z2 = ta.crossunder(Zscore2, avgZscore2) and avgZscore2 > 1.5

// Draw normal triangles for buy and sell signals from the second Z-Score indicator
plotshape(conditionbuy_z2, style=shape.triangleup, color=color.rgb(0, 100, 131), location=location.belowbar, size=size.normal, title="Z-score Buy (1.5)")
plotshape(conditionsell_z2, style=shape.triangledown, color=color.rgb(0, 100, 131), location=location.abovebar, size=size.small, title="Z-score Sell (1.5)")

////////////////////////////////////////////////////////////


/////////////////////////// TABLE /////////////////////////////
// IBS and RSI Strategy
source = (close - low) / (high - low) * 100

rsi_lenght = 14
rsi_value = ta.rsi(close, rsi_lenght)

scaled_source = (source * 0.8) + 10
scaled_rsi_value = (rsi_value * 0.7) + 10

ibs_condition = source < 20
rsi_condition = rsi_value < 30

entry_condition_ibs = ibs_condition and rsi_condition

// Calculate the difference in bars between IBS+RSI and Z-Score signals
var signal_delay_ibs = 5
var signal_delay_z = 5

if (entry_condition_ibs)
    signal_delay_ibs := 0
else
    signal_delay_ibs := signal_delay_ibs + 1

if (conditionbuy_z or conditionsell_z)
    signal_delay_z := 0 
else
    signal_delay_z := signal_delay_z + 1

// Generate a new signal with a yellow "X" when both signals occur within the specified delay
combined_signal = (signal_delay_ibs <= 5) and (signal_delay_z <= 5)
plotshape(series=combined_signal, title="Combined Entry Signal", location=location.belowbar,color=color.rgb(0, 100, 131), style=shape.xcross, size=size.tiny)

// // IBS+RSI Entry Signal
// plotshape(series=entry_condition_ibs, title="IBS+RSI Entry Signal", location=location.belowbar, color=color.blue, style=shape.triangleup, size=size.tiny)

// Z-Score Buy and Sell Arrows
plotshape(conditionbuy_z, style=shape.triangleup,color=color.rgb(0, 100, 131), location=location.belowbar, size=size.tiny, title="Z-score Buy")
plotshape(conditionsell_z, style=shape.triangledown, color=color.rgb(0, 100, 131), location=location.abovebar, size=size.tiny, title="Z-score Sell")

////////////////////////////////////////////////




















// mtf_val = input.timeframe('', 'Resolution', inline="config", group="Algorithm Config")
// source22 = input.source(close, inline="config", group="Algorithm Config")
// length = input.int(100, minval=1, inline="config1", group="Algorithm Config")
// dev = input(2.0, 'Deviation', inline="config1", group="Algorithm Config")
// offset22 = input.int(0, minval=0, inline="config2", group="Algorithm Config")
// smoothing = input.int(1, minval=1, inline="config2", group="Algorithm Config")

// line_thick = input.int(4, 'S&R Size', minval=1, maxval=4, inline="levels", group="Display Config")
// show_last = input.bool(true, "Hide Old Signals", group="Display Config")
// p = input.color(color.lime, "Up", inline="colors", group="Display Config")
// q = input.color(color.red, "Down", inline="colors", group="Display Config")
// displacement = input.bool(false, "Show Displacement")
// goto = input.time(timestamp("20 Jul 2050 00:00 +0300"), "End Of Calculating")

// data(x) =>
//     ta.sma(request.security(syminfo.tickerid, mtf_val != '' ? mtf_val : timeframe.period, x), smoothing)

// linreg = data(ta.linreg(source, length, offset))
// linreg_p = data(ta.linreg(source, length, offset + 1))
// plot(linreg, 'Regression Line', linreg > linreg[1] ? p : q, editable=true)

// x = bar_index
// slope = linreg - linreg_p
// intercept = linreg - x * slope
// deviationSum = 0.0
// for i = 0 to length - 1 by 1
//     deviationSum += math.pow(source[i] - (slope * (x - i) + intercept), 2)
//     deviationSum
// deviation = math.sqrt(deviationSum / length)
// x1 = x - length
// x2 = x
// y1 = slope * (x - length) + intercept
// y2 = linreg

// var line b = na
// var line dp = na
// var line dm = na

// updating = goto >= time

// if updating
//     b := line.new(x1, y1, x2, y2, xloc.bar_index, extend.right, color.aqua, width=line_thick)
//     if not displacement
//         line.delete(b[1])
//     dp := line.new(x1, deviation * dev + y1, x2, deviation * dev + y2, xloc.bar_index, extend.right, q, width=line_thick)
//     if not displacement
//         line.delete(dp[1])
//     dm := line.new(x1, -deviation * dev + y1, x2, -deviation * dev + y2, xloc.bar_index, extend.right, p, width=line_thick)
//     if not displacement
//         line.delete(dm[1])

// dm_current = -deviation * dev + y2
// dp_current = deviation * dev + y2

// buy = ta.crossunder(close, dm_current)
// sell = ta.crossover(close, dp_current)

// alertcondition(buy, 'Buy Lin Reg', 'Crossing On the Lower Regression Channel')
// alertcondition(sell, 'Sell Lin Reg', 'Crossing On the Higher Regression Channel')

// plotshape(buy, style=shape.triangleup, location=location.belowbar, color=color.purple, size=size.tiny)
// plotshape(sell, style=shape.triangledown, location=location.abovebar, color=color.purple, size=size.tiny)


////////////////////// TABLE ///////////////////////////////

// Inputs
length = input.int(20, title="Length", minval=1)
Zavglength = input.int(20, title="Zavglength", minval=1)

// price = close
// oneSD = ta.stdev(price, length)
// avgClose = ta.sma(price, length)
// ofoneSD = oneSD * ta.sma(price[1], length)
// Zscorevalue = ((price - avgClose) / oneSD)
// avgZscore = ta.sma(Zscorevalue, Zavglength)

// Zscore = ((price - avgClose) / oneSD)

// Buy Signals
// buySignal5 = ta.crossover(Zscore, -2)
// plotshape(buySignal5, style=shape.triangleup, location=location.belowbar, color=color.green, size=size.tiny, title="Z-score 2 BUY")

// Buy Signals
// buySignal4 = ta.crossover(Zscore, -2.5)
// plotshape(buySignal4, style=shape.triangleup, location=location.belowbar, color=color.green, size=size.tiny, title="Z-score 2.5 BUY")

normalBuySignal = ta.crossover(Zscore, -3)
plotshape(normalBuySignal, style=shape.triangleup, location=location.belowbar, color=color.rgb(0, 100, 131), size=size.small, title="Z-score 3 BUY")

verynormalBuySignal = ta.crossover(Zscore, -3.5)
plotshape(verynormalBuySignal, style=shape.triangleup, location=location.belowbar, color=color.rgb(0, 100, 131), size=size.normal, title="Z-score 3.5 BUY")

// Sell Signals
sellSignal4 = ta.crossunder(Zscore, 2.5)
plotshape(sellSignal4, style=shape.triangledown, location=location.abovebar, color=color.rgb(0, 100, 131), size=size.tiny, title="Z-score 2.5 SELL")

normalSellSignal = ta.crossunder(Zscore, 3)
plotshape(normalSellSignal, style=shape.triangledown, location=location.abovebar,color=color.rgb(0, 100, 131), size=size.small, title="Z-score 3 SELL")

verynormalSellSignal = ta.crossunder(Zscore, 3.5)
plotshape(verynormalSellSignal, style=shape.triangledown, location=location.abovebar, color=color.rgb(0, 100, 131), size=size.small, title="Z-score 3.5 SELL")








// // Buy Signals
// buySignal6 = ta.crossover(Zscore, 1.5)
// plotshape(buySignal6, style=shape.arrowup, location=location.belowbar, color=color.rgb(0, 255, 8), size=size.tiny, title="Z-score momentum 1.5")

buySignal2 = ta.crossover(Zscore, 2)
plotshape(buySignal2, style=shape.triangledown, location=location.top, color=color.rgb(0, 255, 55), size=size.tiny, title="Z-score momentum 2")

// // Sell Signals
// sellSignal6 = ta.crossunder(Zscore, -1.5)
// plotshape(sellSignal6, style=shape.arrowdown, location=location.abovebar, color=color.rgb(255, 0, 0), size=size.tiny, title="Z-score momentum 1.5")

sellSignal2 = ta.crossunder(Zscore, -2)
plotshape(sellSignal2, style=shape.triangledown, location=location.top, color=color.rgb(255, 0, 0), size=size.tiny, title="Z-score momentum 2")

////////////////////////////////////////////////////////////////


//OPEX
opex = input(title='Monthly Equity, Index Expiration (OPEX)', defval=true)
quarterly = input(title='Quarterly Index Expiration (Q)', defval=true)
vixex = input(title='Monthly VIX Expiration (VIXEX/VIXPERATION)', defval=true)
opex_line_color = input(title='OPEX Line Color', defval=color.new(#494949, 50))
opex_label_color = input(title='OPEX Label Color', defval=color.new(color.orange, 100))
opex_label_txt_color = input(title='OPEX Label Text Color', defval=color.new(color.white, 100))
quarterly_line_color = input(title='Quarterly Line Color', defval=color.new(#ff00bf, 80))
quarterly_label_color = input(title='Quarterly Label Color', defval=color.new(color.red, 100))
quarterly_label_txt_color = input(title='Quarterly Label Text Color', defval=color.new(color.white, 100))
vixex_line_color = input(title='VIXEX Line Color', defval=color.new(color.purple, 100))
vixex_label_color = input(title='VIXEX Label Color', defval=color.new(color.purple, 100))
vixex_label_txt_color = input(title='VIXEX Label Text Color', defval=color.new(color.white, 100))
vline(TimeIndex, txt, line_color, label_color, label_txt_color) =>
    return_1 = line.new(TimeIndex, low, TimeIndex, high, xloc.bar_time, extend.both, line_color, line.style_dotted, 1)
    l = label.new(TimeIndex, high, txt, xloc.bar_time, yloc.abovebar, label_color, label.style_label_down, label_txt_color, size.small, text.align_left, txt)
    l


//MONTHLY OPEX DATES
dates_opex = array.new_int(0, timestamp(syminfo.timezone, 2021, 01, 15, timeframe.isdwm ? 0 : 16, 00, 00))
array.push(dates_opex, timestamp(syminfo.timezone, 2021, 02, 19, timeframe.isdwm ? 0 : 16, 00, 00))
array.push(dates_opex, timestamp(syminfo.timezone, 2021, 03, 19, timeframe.isdwm ? 0 : 16, 00, 00))
array.push(dates_opex, timestamp(syminfo.timezone, 2021, 04, 16, timeframe.isdwm ? 0 : 16, 00, 00))
array.push(dates_opex, timestamp(syminfo.timezone, 2021, 05, 21, timeframe.isdwm ? 0 : 16, 00, 00))
array.push(dates_opex, timestamp(syminfo.timezone, 2021, 06, 18, timeframe.isdwm ? 0 : 16, 00, 00))
array.push(dates_opex, timestamp(syminfo.timezone, 2021, 07, 16, timeframe.isdwm ? 0 : 16, 00, 00))
array.push(dates_opex, timestamp(syminfo.timezone, 2021, 08, 20, timeframe.isdwm ? 0 : 16, 00, 00))
array.push(dates_opex, timestamp(syminfo.timezone, 2021, 09, 17, timeframe.isdwm ? 0 : 16, 00, 00))
array.push(dates_opex, timestamp(syminfo.timezone, 2021, 10, 15, timeframe.isdwm ? 0 : 16, 00, 00))
array.push(dates_opex, timestamp(syminfo.timezone, 2021, 11, 19, timeframe.isdwm ? 0 : 16, 00, 00))
array.push(dates_opex, timestamp(syminfo.timezone, 2021, 12, 17, timeframe.isdwm ? 0 : 16, 00, 00))
array.push(dates_opex, timestamp(syminfo.timezone, 2022, 01, 21, timeframe.isdwm ? 0 : 16, 00, 00))
array.push(dates_opex, timestamp(syminfo.timezone, 2022, 02, 18, timeframe.isdwm ? 0 : 16, 00, 00))
array.push(dates_opex, timestamp(syminfo.timezone, 2022, 03, 18, timeframe.isdwm ? 0 : 16, 00, 00))
array.push(dates_opex, timestamp(syminfo.timezone, 2022, 04, 14, timeframe.isdwm ? 0 : 16, 00, 00))
array.push(dates_opex, timestamp(syminfo.timezone, 2022, 05, 20, timeframe.isdwm ? 0 : 16, 00, 00))
array.push(dates_opex, timestamp(syminfo.timezone, 2022, 06, 17, timeframe.isdwm ? 0 : 16, 00, 00))
array.push(dates_opex, timestamp(syminfo.timezone, 2022, 07, 15, timeframe.isdwm ? 0 : 16, 00, 00))
array.push(dates_opex, timestamp(syminfo.timezone, 2022, 08, 19, timeframe.isdwm ? 0 : 16, 00, 00))
array.push(dates_opex, timestamp(syminfo.timezone, 2022, 09, 16, timeframe.isdwm ? 0 : 16, 00, 00))
array.push(dates_opex, timestamp(syminfo.timezone, 2022, 10, 21, timeframe.isdwm ? 0 : 16, 00, 00))
array.push(dates_opex, timestamp(syminfo.timezone, 2022, 11, 18, timeframe.isdwm ? 0 : 16, 00, 00))
array.push(dates_opex, timestamp(syminfo.timezone, 2022, 12, 16, timeframe.isdwm ? 0 : 16, 00, 00))
array.push(dates_opex, timestamp(syminfo.timezone, 2023, 01, 20, timeframe.isdwm ? 0 : 16, 00, 00))
array.push(dates_opex, timestamp(syminfo.timezone, 2023, 02, 17, timeframe.isdwm ? 0 : 16, 00, 00))
array.push(dates_opex, timestamp(syminfo.timezone, 2023, 03, 17, timeframe.isdwm ? 0 : 16, 00, 00))
array.push(dates_opex, timestamp(syminfo.timezone, 2023, 04, 21, timeframe.isdwm ? 0 : 16, 00, 00))
array.push(dates_opex, timestamp(syminfo.timezone, 2023, 05, 19, timeframe.isdwm ? 0 : 16, 00, 00))
array.push(dates_opex, timestamp(syminfo.timezone, 2023, 06, 16, timeframe.isdwm ? 0 : 16, 00, 00))
array.push(dates_opex, timestamp(syminfo.timezone, 2023, 07, 21, timeframe.isdwm ? 0 : 16, 00, 00))
array.push(dates_opex, timestamp(syminfo.timezone, 2023, 08, 18, timeframe.isdwm ? 0 : 16, 00, 00))
array.push(dates_opex, timestamp(syminfo.timezone, 2023, 09, 15, timeframe.isdwm ? 0 : 16, 00, 00))
array.push(dates_opex, timestamp(syminfo.timezone, 2023, 10, 20, timeframe.isdwm ? 0 : 16, 00, 00))
array.push(dates_opex, timestamp(syminfo.timezone, 2023, 11, 17, timeframe.isdwm ? 0 : 16, 00, 00))
array.push(dates_opex, timestamp(syminfo.timezone, 2023, 12, 15, timeframe.isdwm ? 0 : 16, 00, 00))

//QUAETERLY OPEX DATES
dates_quarterly = array.new_int(0, timestamp(syminfo.timezone, 2021, 03, 31, timeframe.isdwm ? 0 : 15, 59, 00))
array.push(dates_quarterly, timestamp(syminfo.timezone, 2021, 06, 30, timeframe.isdwm ? 0 : 15, 59, 00))
array.push(dates_quarterly, timestamp(syminfo.timezone, 2021, 09, 30, timeframe.isdwm ? 0 : 15, 59, 00))
array.push(dates_quarterly, timestamp(syminfo.timezone, 2021, 12, 31, timeframe.isdwm ? 0 : 15, 59, 00))
array.push(dates_quarterly, timestamp(syminfo.timezone, 2022, 03, 31, timeframe.isdwm ? 0 : 15, 59, 00))
array.push(dates_quarterly, timestamp(syminfo.timezone, 2022, 06, 30, timeframe.isdwm ? 0 : 15, 59, 00))
array.push(dates_quarterly, timestamp(syminfo.timezone, 2022, 09, 30, timeframe.isdwm ? 0 : 15, 59, 00))
array.push(dates_quarterly, timestamp(syminfo.timezone, 2022, 12, 30, timeframe.isdwm ? 0 : 15, 59, 00))
array.push(dates_quarterly, timestamp(syminfo.timezone, 2023, 03, 31, timeframe.isdwm ? 0 : 15, 59, 00))
array.push(dates_quarterly, timestamp(syminfo.timezone, 2023, 06, 30, timeframe.isdwm ? 0 : 15, 59, 00))
array.push(dates_quarterly, timestamp(syminfo.timezone, 2023, 09, 29, timeframe.isdwm ? 0 : 15, 59, 00))
array.push(dates_quarterly, timestamp(syminfo.timezone, 2023, 12, 29, timeframe.isdwm ? 0 : 15, 59, 00))

//VIX EXPIRATION DATES
dates_vixex = array.new_int(0, timestamp(syminfo.timezone, 2021, 01, 20, timeframe.isdwm ? 0 : 09, 00, 00))
array.push(dates_vixex, timestamp(syminfo.timezone, 2021, 02, 17, timeframe.isdwm ? 0 : 09, 00, 00))
array.push(dates_vixex, timestamp(syminfo.timezone, 2021, 03, 17, timeframe.isdwm ? 0 : 09, 00, 00))
array.push(dates_vixex, timestamp(syminfo.timezone, 2021, 04, 21, timeframe.isdwm ? 0 : 09, 00, 00))
array.push(dates_vixex, timestamp(syminfo.timezone, 2021, 05, 19, timeframe.isdwm ? 0 : 09, 00, 00))
array.push(dates_vixex, timestamp(syminfo.timezone, 2021, 06, 16, timeframe.isdwm ? 0 : 09, 00, 00))
array.push(dates_vixex, timestamp(syminfo.timezone, 2021, 07, 21, timeframe.isdwm ? 0 : 09, 00, 00))
array.push(dates_vixex, timestamp(syminfo.timezone, 2021, 08, 18, timeframe.isdwm ? 0 : 09, 00, 00))
array.push(dates_vixex, timestamp(syminfo.timezone, 2021, 09, 15, timeframe.isdwm ? 0 : 09, 00, 00))
array.push(dates_vixex, timestamp(syminfo.timezone, 2021, 10, 20, timeframe.isdwm ? 0 : 09, 00, 00))
array.push(dates_vixex, timestamp(syminfo.timezone, 2021, 11, 17, timeframe.isdwm ? 0 : 09, 00, 00))
array.push(dates_vixex, timestamp(syminfo.timezone, 2021, 12, 22, timeframe.isdwm ? 0 : 09, 00, 00))
array.push(dates_vixex, timestamp(syminfo.timezone, 2022, 01, 19, timeframe.isdwm ? 0 : 09, 00, 00))
array.push(dates_vixex, timestamp(syminfo.timezone, 2022, 02, 16, timeframe.isdwm ? 0 : 09, 00, 00))
array.push(dates_vixex, timestamp(syminfo.timezone, 2022, 03, 15, timeframe.isdwm ? 0 : 09, 00, 00))
array.push(dates_vixex, timestamp(syminfo.timezone, 2022, 04, 20, timeframe.isdwm ? 0 : 09, 00, 00))
array.push(dates_vixex, timestamp(syminfo.timezone, 2022, 05, 18, timeframe.isdwm ? 0 : 09, 00, 00))
array.push(dates_vixex, timestamp(syminfo.timezone, 2022, 06, 15, timeframe.isdwm ? 0 : 09, 00, 00))
array.push(dates_vixex, timestamp(syminfo.timezone, 2022, 07, 20, timeframe.isdwm ? 0 : 09, 00, 00))
array.push(dates_vixex, timestamp(syminfo.timezone, 2022, 08, 17, timeframe.isdwm ? 0 : 09, 00, 00))
array.push(dates_vixex, timestamp(syminfo.timezone, 2022, 09, 21, timeframe.isdwm ? 0 : 09, 00, 00))
array.push(dates_vixex, timestamp(syminfo.timezone, 2022, 10, 19, timeframe.isdwm ? 0 : 09, 00, 00))
array.push(dates_vixex, timestamp(syminfo.timezone, 2022, 11, 16, timeframe.isdwm ? 0 : 09, 00, 00))
array.push(dates_vixex, timestamp(syminfo.timezone, 2022, 12, 21, timeframe.isdwm ? 0 : 09, 00, 00))
array.push(dates_vixex, timestamp(syminfo.timezone, 2023, 01, 18, timeframe.isdwm ? 0 : 09, 00, 00))
array.push(dates_vixex, timestamp(syminfo.timezone, 2023, 02, 15, timeframe.isdwm ? 0 : 09, 00, 00))
array.push(dates_vixex, timestamp(syminfo.timezone, 2023, 03, 22, timeframe.isdwm ? 0 : 09, 00, 00))
array.push(dates_vixex, timestamp(syminfo.timezone, 2023, 04, 19, timeframe.isdwm ? 0 : 09, 00, 00))
array.push(dates_vixex, timestamp(syminfo.timezone, 2023, 05, 17, timeframe.isdwm ? 0 : 09, 00, 00))
array.push(dates_vixex, timestamp(syminfo.timezone, 2023, 06, 21, timeframe.isdwm ? 0 : 09, 00, 00))
array.push(dates_vixex, timestamp(syminfo.timezone, 2023, 07, 19, timeframe.isdwm ? 0 : 09, 00, 00))
array.push(dates_vixex, timestamp(syminfo.timezone, 2023, 08, 16, timeframe.isdwm ? 0 : 09, 00, 00))
array.push(dates_vixex, timestamp(syminfo.timezone, 2023, 09, 20, timeframe.isdwm ? 0 : 09, 00, 00))
array.push(dates_vixex, timestamp(syminfo.timezone, 2023, 10, 18, timeframe.isdwm ? 0 : 09, 00, 00))
array.push(dates_vixex, timestamp(syminfo.timezone, 2023, 11, 15, timeframe.isdwm ? 0 : 09, 00, 00))
array.push(dates_vixex, timestamp(syminfo.timezone, 2023, 12, 20, timeframe.isdwm ? 0 : 09, 00, 00))

if opex == true
    for i = 0 to array.size(dates_opex) - 1 by 1
        vline(array.get(dates_opex, i), 'OPEX', opex_line_color, opex_label_color, opex_label_txt_color)

if quarterly == true
    for i = 0 to array.size(dates_quarterly) - 1 by 1
        vline(array.get(dates_quarterly, i), 'Q', quarterly_line_color, quarterly_label_color, quarterly_label_txt_color)

if vixex == true
    for i = 0 to array.size(dates_vixex) - 1 by 1
        vline(array.get(dates_vixex, i), 'VIXEX', vixex_line_color, vixex_label_color, vixex_label_txt_color)





 //////////////////////////////////// TABLE /////////////////////
//NYSE NEW LOWS:
hi = input.symbol("hign")
lo = input.symbol("lown")

length7 = input.int(2, "SMA Length")
res = input.timeframe('D', "Resolution", options=['D', 'W', 'M'])
source7 = input.source(close)
PlotCumulative = input(false, title='Plot Cumulative?', group="Basics")

newhi = request.security(hi, res, source7)
newlo = -1 * request.security(lo, res, source7)
newhicalc = ta.sma(newhi, length7)
newlocalc = ta.sma(newlo, length7)

// Create a condition for when the histogram changes from red to another color
histogramCondition = ta.crossover(newlocalc, -150)
histogramConditionChanged = ta.change(histogramCondition)

// Create a buy signal in the form of a normal triangle
plotshape(series=histogramConditionChanged, title="Buy Signal", location=location.belowbar, color=color.rgb(0, 100, 131), size=size.tiny, style=shape.triangleup)

///////////////////////////////////////




// //////////////////// ATR //////////////////






// // ============================== GET INPUTS ==================================

// atrLookback = input.int(defval=5, title='ATR Lookback Period')
// atrMultiplier = input.float(defval=1, title='ATR Multiplier', step=0.1, minval=0.5, maxval=4)
// atrTrailMode = input.string(title='Trail Mode', defval='Running', options=['Running', 'Trailing'])
// atrFlipInput = input.string(title='Flip Trail on:', defval='Close', options=['Close', 'Wick'])
// atrBodyPercent = input.int(title='Percentage of Body to Include', defval=100, minval=0, maxval=200, step=10, group="Advanced Settings")
// atrWickPercent = input.int(title='Percentage of Wick to Include', defval=100, minval=0, maxval=200, step=10)
// atrSmoothingMode = input.string(title='ATR Smoothing Mode', defval='RMA', options=['RMA', 'SMA', 'EMA', 'WMA'])


// // ============================== CALCULATE ATR ==================================

// f_ma(_source, _length, _atrSmoothingMode) =>
//     if _atrSmoothingMode == 'RMA'
//         ta.rma(_source, _length)
//     else
//         if _atrSmoothingMode == 'SMA'
//             ta.sma(_source, _length)
//         else
//             if _atrSmoothingMode == 'EMA'
//                 ta.ema(_source, _length)
//             else
//                 ta.wma(_source, _length)

// float atrBodyTrueRange = math.max(math.abs(open - close), math.abs(open - close[1]), math.abs(close - close[1]))
// float atrWickTrueRange = high - math.max(open, close) + math.min(open, close) - low
// float atrPercentAdjustedTrueRange = atrBodyTrueRange * (atrBodyPercent / 100) + atrWickTrueRange * (atrWickPercent / 100)

// float atrValue = f_ma(atrPercentAdjustedTrueRange, atrLookback, atrSmoothingMode)
// float atrMultiplied = atrValue * atrMultiplier

// // Plot the price plus or minus the ATR
// float atrLow = low - atrMultiplied
// float atrHigh = high + atrMultiplied


// // ============================== CALCULATE TRAILING ATR ==================================

// f_trail(_source, _trail, _direction) =>
//     // This function trails the source series up or down
//     _direction == 'down' and _source >= _trail ? _trail : _direction == 'up' and _source <= _trail ? _trail : _source

// // Need to declare these variables here, in the global scope, so we can use them in other functions later
// var float trailAtrLong = atrLow
// var float trailAtrShort = atrHigh

// // Trail the high (short) stop down and the low (long) stop up
// trailAtrLong := f_trail(atrLow, trailAtrLong, 'up')
// trailAtrShort := f_trail(atrHigh, trailAtrShort, 'down')

// // // DEBUG
// // plot(atrTrailMode == "Trailing" ? trailAtrLong : na, "Trailing ATR Long Stop Highlight", color=color.teal, style=plot.style_linebr, linewidth=1, transp=0)
// // plot(atrTrailMode == "Trailing" ? trailAtrShort : na, "Trailing ATR Short Stop Highlight", color=color.red, style=plot.style_linebr, linewidth=1, transp=0)

// // ============================== FLIP WHEN PRICE CROSSES ==================================

// f_flip(_flipInput, _longTrail, _shortTrail, _longReset, _shortReset) =>

//     // These variables say whether we are flipping long or short this very bar. Usually they are both false. Only one of them can be true at once.
//     var bool _flipLongNow = false
//     var bool _flipShortNow = false
//     // These variables say what state we're in: long or short. One or both are always true.
//     // In the beginning, we haven't hit any trails yet, so we start off both long and short, to display both lines.
//     var bool _isLong = true
//     var bool _isShort = true
//     // Get the source, depending whether it's on close or on touch
//     float _flipLongSource = _flipInput == 'Close' ? close : _flipInput == 'Wick' ? high : na
//     float _flipShortSource = _flipInput == 'Close' ? close : _flipInput == 'Wick' ? low : na
//     // Are we flipping long or short this bar?
//     _flipLongNow := _isShort[1] and _flipLongSource > _shortTrail ? true : false
//     _flipShortNow := _isLong[1] and _flipShortSource < _longTrail ? true : false
//     // In the edge case where we manage to flip both long and short, we need to reset that based on the close. The close is definitive for history and intra-candle it will take the current value.
//     _flipLongNow := _flipShortNow and _flipLongNow and close > _longTrail ? true : _flipShortNow and _flipLongNow and close <= _longTrail ? false : _flipLongNow
//     _flipShortNow := _flipLongNow and _flipShortNow and close < _shortTrail ? true : _flipShortNow and _flipLongNow and close >= _shortTrail ? false : _flipShortNow
//     // Set the long and short state variables. Set if we flip (simple), initialise to true if this is the first time (needed), otherwise persist.
//     _isLong := _flipLongNow ? true : _flipShortNow ? false : na(_isLong[1]) ? true : _isLong[1]
//     _isShort := _flipShortNow ? true : _flipLongNow ? false : na(_isShort[1]) ? true : _isShort[1]
//     // Update the trailing price. If we flip this bar, reset to the nearest fractal - which goes against the trail direction, which is why we need to use another series.
//     _longTrailOutput = _longTrail
//     _shortTrailOutput = _shortTrail
//     _longTrailOutput := _isLong and not _isLong[1] ? _longReset : _longTrailOutput
//     _shortTrailOutput := _isShort and not _isShort[1] ? _shortReset : _shortTrailOutput
//     // Hide the trailing long stop if we are short, and hide the trailing short stop if we are long. Show both if we are both long and short. 
//     float _longTrailPlot = _isLong ? _longTrailOutput : _isLong and _isShort ? _longTrailOutput : na
//     float _shortTrailPlot = _isShort ? _shortTrailOutput : _isLong and _isShort ? _shortTrailOutput : na
//     [_longTrailOutput, _shortTrailOutput, _longTrailPlot, _shortTrailPlot]

// // Get the plots for the trails, to show only long stop when long and short stop when short.
// [trailAtrLongTemp, trailAtrShortTemp, trailAtrLongPlot, trailAtrShortPlot] = f_flip(atrFlipInput, trailAtrLong, trailAtrShort, atrLow, atrHigh)

// // Put these variables back in the global scope so we can persist them and use them as inputs to the function next bar. 
// trailAtrLong := trailAtrLongTemp
// trailAtrShort := trailAtrShortTemp


// // ============================== PLOT LINES ==================================

// // If we are in Running mode, plot the price plus and minus the ATR
// plot(atrTrailMode == 'Running' ? atrLow : na, 'Running ATR Low', color=color.new(#00bd09, 48), style=plot.style_circles, linewidth=1)
// plot(atrTrailMode == 'Running' ? atrHigh : na, 'Running ATR High', color=color.new(#ff0101, 60), style=plot.style_circles, linewidth=1)

// plot(atrTrailMode == 'Trailing' ? trailAtrLongPlot : na, 'Trailing ATR Long Stop', color=color.new(color.navy, 50), style=plot.style_linebr, linewidth=3)
// plot(atrTrailMode == 'Trailing' ? trailAtrLongPlot : na, 'Trailing ATR Long Stop Highlight', color=color.teal, style=plot.style_linebr, linewidth=1)

// plot(atrTrailMode == 'Trailing' ? trailAtrShortPlot : na, 'Trailing ATR Short Stop', color=color.new(color.maroon, 50), style=plot.style_linebr, linewidth=3)
// plot(atrTrailMode == 'Trailing' ? trailAtrShortPlot : na, 'Trailing ATR Short Stop Highlight', color=color.red, style=plot.style_linebr, linewidth=1)


// // ============================== ALERTS ==================================

// // Alert for crossing the trailing ATR. You can set this to trigger Once, or Once per bar close, in the
// // TradingView alert configuration screen. You can use this for soft stops or to look for entries.

// float atrFlipLongSource = atrFlipInput == 'Close' ? close : atrFlipInput == 'Wick' ? high : na
// float atrFlipShortSource = atrFlipInput == 'Close' ? close : atrFlipInput == 'Wick' ? low : na

// bool alertCrossAtrShortStop = atrFlipLongSource > trailAtrShortPlot[1] and atrFlipLongSource[1] <= trailAtrShortPlot[2] ? true : false
// bool alertCrossAtrLongStop = atrFlipShortSource < trailAtrLongPlot[1] and atrFlipShortSource[1] >= trailAtrLongPlot[2] ? true : false

// // bool alertCrossAtr = alertCrossAtrShortStop or alertCrossAtrLongStop
// // alertcondition(alertCrossAtr, title='Price crossed ATR (long or short)', message='Price crossed the trailing ATR')  // This is the old alert, which you can uncomment if you prefer it
// alertcondition(alertCrossAtrShortStop, title='Long: Price crossed ATR up', message='Price crossed the trailing ATR short stop (bullish)')
// alertcondition(alertCrossAtrLongStop, title='Short: Price crossed ATR down', message='Price crossed trailing ATR long stop (bearish)')

//----------------------------------------------------------------------------

// antal dagars HÖGSTA/LÄGSTA

// Antal dagar för extremer
length5 = 20

// Offset för att fördröja linjerna med 2 dagar
offset5 = 1

// Hämta högsta och lägsta stängningspriset för de senaste 100 dagarna med offset
highestClose = request.security(syminfo.tickerid, "D", ta.highest(close, length5), lookahead=barmerge.lookahead_on) - offset5
lowestClose = request.security(syminfo.tickerid, "D", ta.lowest(close, length5), lookahead=barmerge.lookahead_on) + offset5

// Köp- och säljsignaler
buySignal55 = ta.crossover(close, highestClose)
sellSignal55 = ta.crossunder(close, lowestClose)


// Rita köp- och säljsignaler på grafen som små trianglar
plotshape(series=buySignal55, title="20 dagars högsta KÖP", color=color.rgb(0, 255, 8), style=shape.triangledown, size=size.tiny, location=location.top)
plotshape(series=sellSignal55, title="20 dagars högsta SÄLJ", color=color.rgb(255, 0, 0), style=shape.triangledown, size=size.tiny, location=location.top)

///////////////////////////////////////////////////////////////////////






// Funktion för att avgöra om en tidsram är grön eller röd
isGreenColor(timeframe) =>
    close > open and request.security(syminfo.tickerid, timeframe, close > open)

isRedColor(timeframe) =>
    close < open and request.security(syminfo.tickerid, timeframe, close < open)

// Villkor för köpssignal
buyCondition = isGreenColor("1W") and isGreenColor("1D") and isGreenColor("60")

// Villkor för säljsignal
sellCondition = isRedColor("1W") and isRedColor("1D") and isRedColor("60")

// Lagringsvariabler för signaler
var bool buySignal88 = na
var bool sellSignal88 = na

// Uppdatera signalvariabler
buySignal88 := buyCondition or (na(buySignal88[1]) ? buySignal88[1] : na)
sellSignal88 := sellCondition or (na(sellSignal88[1]) ? sellSignal88[1] : na)

// Rita köpssignal
plotshape(series=buySignal88, color=color.rgb(0, 255, 8), style=shape.triangledown, title="Buy Signal", location=location.top, size=size.tiny)

// // Rita gamla köpssignaler som cirklar
// plotshape(series=buySignal88 and not buyCondition, color=color.green, style=shape.labelup, title="Old Buy Signal", location=location.belowbar, size=size.tiny)

// Rita säljsignal
plotshape(series=sellSignal88, color=color.rgb(255, 0, 0), style=shape.triangledown, title="Sell Signal", location=location.top, size=size.tiny)

// // Rita gamla säljsignaler som cirklar
// plotshape(series=sellSignal88 and not sellCondition, color=color.red, style=shape.labeldown, title="Old Sell Signal", location=location.abovebar, size=size.tiny)








// //===================== SIGNAL TABLE (paste at end) =====================

// // -- dimensioner & tabell (måste deklareras före table.new)
// var int COLS = 4
// var int ROWS = 60

// // skapa tabell en gång
// var table sigT = table.new(position.top_right, COLS, ROWS,
//      frame_color=color.new(color.gray, 80), border_width=1, border_color=color.new(color.gray,80))

// // hjälpfunktion: lägg en rad
// f_add_row(_r, _name, _side, _on, _note) =>
//     _buyCol  = color.new(color.green, 70)
//     _sellCol = color.new(color.red,   70)
//     _sideCol = _side == "BUY" ? _buyCol : _sellCol
//     _nowTxt  = _on ? "ON" : "-"
//     _nowBg   = _on ? _sideCol : na
//     table.cell(sigT, 0, _r, _name,  text_color=color.white, bgcolor=color.new(color.black,0))
//     table.cell(sigT, 1, _r, _side,  text_color=color.white, bgcolor=_sideCol)
//     table.cell(sigT, 2, _r, _nowTxt,text_color=color.white, bgcolor=_nowBg)
//     table.cell(sigT, 3, _r, _note,  text_color=color.new(color.white,30))
//     _r + 1

// // rita/uppdatera tabellen endast på sista baren
// if barstate.islast
//     // rensa hela ytan (0-indexerad rektangel)
//     table.clear(sigT, 0, 0, COLS - 1, ROWS - 1)

//     // header
//     table.cell(sigT, 0, 0, "Indicator", text_color=color.white, bgcolor=color.new(color.black,0))
//     table.cell(sigT, 1, 0, "Side",      text_color=color.white, bgcolor=color.new(color.black,0))
//     table.cell(sigT, 2, 0, "Now",       text_color=color.white, bgcolor=color.new(color.black,0))
//     table.cell(sigT, 3, 0, "Note",      text_color=color.white, bgcolor=color.new(color.black,0))

//     // radräknare och summering
//     row = 1
//     buyCnt  = 0
//     sellCnt = 0

//     // ======== LÄGG IN DINA SIGNALER (säker na-hantering) =========
//     // CVOL (USI:CVOL) – SELL
//     row := f_add_row(row, "CVOL z>1.5", "SELL",  na(S_sell_signal_1) ? false : S_sell_signal_1, "USI:CVOL"),     sellCnt += (na(S_sell_signal_1)?0:(S_sell_signal_1?1:0))
//     row := f_add_row(row, "CVOL z>2.5", "SELL",  na(S_sell_signal_2) ? false : S_sell_signal_2, "USI:CVOL"),     sellCnt += (na(S_sell_signal_2)?0:(S_sell_signal_2?1:0))
//     row := f_add_row(row, "CVOL z>3.0", "SELL",  na(S_sell_signal_3) ? false : S_sell_signal_3, "USI:CVOL"),     sellCnt += (na(S_sell_signal_3)?0:(S_sell_signal_3?1:0))

//     // PLCE short volume (FINRA) – BUY
//     row := f_add_row(row, "PLCE SV z>3 (50L)", "BUY", na(A_buy_signal_2)?false:A_buy_signal_2, "FINRA:PLCE"),    buyCnt  += (na(A_buy_signal_2)?0:(A_buy_signal_2?1:0))
//     row := f_add_row(row, "PLCE SV z>3 (20L)", "BUY", na(A_buy_signal_3)?false:A_buy_signal_3, "FINRA:PLCE"),    buyCnt  += (na(A_buy_signal_3)?0:(A_buy_signal_3?1:0))

//     // Breadth
//     row := f_add_row(row, "R3TW & MMTW > 20", "BUY", na(buySignalCondition)?false:buySignalCondition, ""),        buyCnt  += (na(buySignalCondition)?0:(buySignalCondition?1:0))
//     row := f_add_row(row, "CUM HI-LO < 2",    "SELL",na(bgcolorCondition)?false:bgcolorCondition, "Risk-off"),    sellCnt += (na(bgcolorCondition)?0:(bgcolorCondition?1:0))

//     // Korrelationer
//     row := f_add_row(row, "VVIX+VIX+GLD corr", "SELL", na(sellSignalCondition)?false:sellSignalCondition, ""),    sellCnt += (na(sellSignalCondition)?0:(sellSignalCondition?1:0))
//     row := f_add_row(row, "VIX & SPX corr",    "SELL", na(sellSignalCondition1)?false:sellSignalCondition1, ""),  sellCnt += (na(sellSignalCondition1)?0:(sellSignalCondition1?1:0))

//     // BREDD (MMFD/NDTW/MMFI)
//     row := f_add_row(row, "BREDD Buy",  "BUY",  na(buySignal1)?false:buySignal1, ""),                             buyCnt  += (na(buySignal1)?0:(buySignal1?1:0))
//     row := f_add_row(row, "BREDD Sell", "SELL", na(sellSignal1)?false:sellSignal1, ""),                           sellCnt += (na(sellSignal1)?0:(sellSignal1?1:0))

//     // Z-Score “avg cross”
//     row := f_add_row(row, "Z cross↑ avg<-1",  "BUY",  na(conditionbuy_z)?false:conditionbuy_z, ""),               buyCnt  += (na(conditionbuy_z)?0:(conditionbuy_z?1:0))
//     row := f_add_row(row, "Z cross↓ avg>1.4", "SELL", na(conditionsell_z)?false:conditionsell_z, ""),             sellCnt += (na(conditionsell_z)?0:(conditionsell_z?1:0))

//     // Z-Score (±1.5)
//     row := f_add_row(row, "Z(1.5) BUY",  "BUY",  na(conditionbuy_z2)?false:conditionbuy_z2, ""),                  buyCnt  += (na(conditionbuy_z2)?0:(conditionbuy_z2?1:0))
//     row := f_add_row(row, "Z(1.5) SELL", "SELL", na(conditionsell_z2)?false:conditionsell_z2, ""),                sellCnt += (na(conditionsell_z2)?0:(conditionsell_z2?1:0))

//     // Z-extremer / momentum
//     row := f_add_row(row, "Z < -3",        "BUY",  na(normalBuySignal)?false:normalBuySignal, ""),                buyCnt  += (na(normalBuySignal)?0:(normalBuySignal?1:0))
//     row := f_add_row(row, "Z < -3.5",      "BUY",  na(verynormalBuySignal)?false:verynormalBuySignal, ""),        buyCnt  += (na(verynormalBuySignal)?0:(verynormalBuySignal?1:0))
//     row := f_add_row(row, "Z cross↓ 2.5",  "SELL", na(sellSignal4)?false:sellSignal4, ""),                        sellCnt += (na(sellSignal4)?0:(sellSignal4?1:0))
//     row := f_add_row(row, "Z > 3",         "SELL", na(normalSellSignal)?false:normalSellSignal, ""),              sellCnt += (na(normalSellSignal)?0:(normalSellSignal?1:0))
//     row := f_add_row(row, "Z > 3.5",       "SELL", na(verynormalSellSignal)?false:verynormalSellSignal, ""),      sellCnt += (na(verynormalSellSignal)?0:(verynormalSellSignal?1:0))
//     row := f_add_row(row, "Z mom cross↑2", "SELL", na(buySignal2)?false:buySignal2, "OB warn"),                   sellCnt += (na(buySignal2)?0:(buySignal2?1:0))
//     row := f_add_row(row, "Z mom cross↓-2","SELL", na(sellSignal2)?false:sellSignal2, "OS warn"),                 sellCnt += (na(sellSignal2)?0:(sellSignal2?1:0))

//     // 20-d breakout/breakdown
//     row := f_add_row(row, "20D High Break", "BUY",  na(buySignal55)?false:buySignal55, ""),                       buyCnt  += (na(buySignal55)?0:(buySignal55?1:0))
//     row := f_add_row(row, "20D Low Break",  "SELL", na(sellSignal55)?false:sellSignal55, ""),                     sellCnt += (na(sellSignal55)?0:(sellSignal55?1:0))

//     // MTF färg-sync (W/D/60)
//     row := f_add_row(row, "TF Sync BUY",  "BUY",  na(buySignal88)?false:buySignal88, ""),                         buyCnt  += (na(buySignal88)?0:(buySignal88?1:0))
//     row := f_add_row(row, "TF Sync SELL", "SELL", na(sellSignal88)?false:sellSignal88, ""),                       sellCnt += (na(sellSignal88)?0:(sellSignal88?1:0))

//     // PUT Volume extremes (PLCE)
//     row := f_add_row(row, "PUT Volume extremes", "SELL", na(pvlce)?false:(pvlce > threshold), "PLCE>thr"),        sellCnt += (na(pvlce)?0:((pvlce>threshold)?1:0))

//     // Yield curve (10Y-2Y)
//     row := f_add_row(row, "Yield 10Y-2Y BUY",  "BUY",  na(buySignal)?false:buySignal, "FRR2_10"),                buyCnt  += (na(buySignal)?0:(buySignal?1:0))
//     row := f_add_row(row, "Yield 10Y-2Y SELL", "SELL", na(sellSignal)?false:sellSignal, "FRR2_10"),              sellCnt += (na(sellSignal)?0:(sellSignal?1:0))

//     // om inget triggade
//     if row == 1
//         table.cell(sigT, 0, 1, "No signals", text_color=color.silver)
//         table.cell(sigT, 1, 1, "-",          text_color=color.silver)

//     // summeringsrad
//     sumRow = math.min(row + 1, ROWS - 1)
//     table.cell(sigT, 0, sumRow, "TOTAL", text_color=color.white, bgcolor=color.new(color.black,0))
//     table.cell(sigT, 1, sumRow, "BUY",   text_color=color.white, bgcolor=color.new(color.green,70))
//     table.cell(sigT, 2, sumRow, str.tostring(buyCnt),  text_color=color.white, bgcolor=color.new(color.green,70))
//     table.cell(sigT, 3, sumRow, "", text_color=color.white)
//     sumRow += 1
//     table.cell(sigT, 1, sumRow, "SELL",  text_color=color.white, bgcolor=color.new(color.red,70))
//     table.cell(sigT, 2, sumRow, str.tostring(sellCnt), text_color=color.white, bgcolor=color.new(color.red,70))







// // =====================================================================
// // ====================== SIGNAL TABLE (NO EXTRA SECURITY CALLS) ========
// // Definiera tabellens dimensioner
// var int COLS = 4
// var int ROWS = 60
// var table sigT = table.new(position.top_right, COLS, ROWS,
//      frame_color=color.new(color.gray,80), border_width=1, border_color=color.new(color.gray,80))

// // Visa/dölj GLOBAL-del i tabellen (påverkar inte plots)
// showGlobalTbl = input.bool(true, "Show GLOBAL section in table")

// // Hjälp: gör text för bars-ago med historikspårning
// var float[] signal_history = array.new_float(0) // Array för debug (valfritt)
// f_barsago_txt(_cond) =>
//     _n = ta.barssince(nz(_cond, false))
//     na(_n) ? "-" : str.tostring(_n)

// // Funktion för att lägga till en rad i tabellen med historik
// f_add_row(_r, _name, _side, _onCond, _barsCond) =>
//     _buyCol  = color.new(color.green, 70)
//     _sellCol = color.new(color.red,   70)
//     _sideCol = _side == "BUY" ? _buyCol : _sellCol

//     // Normalisera villkor till strikta booleska värden
//     _onSafe   = nz(_onCond,   false)
//     _barsSafe = nz(_barsCond, false)

//     _nowTxt = _onSafe ? "ON" : "-"
//     _nowBg  = _onSafe ? _sideCol : na

//     // Spåra historik för _barsCond (valfritt)
//     if _barsSafe
//         array.push(signal_history, time)

//     table.cell(sigT, 0, _r, _name,  text_color=color.white, bgcolor=color.new(color.black,0))
//     table.cell(sigT, 1, _r, _side,  text_color=color.white, bgcolor=_sideCol)
//     table.cell(sigT, 2, _r, _nowTxt, text_color=color.white, bgcolor=_nowBg)
//     table.cell(sigT, 3, _r, f_barsago_txt(_barsSafe), text_color=color.new(color.white,30))
//     _r + 1

// // Kör endast på sista bekräftade stapeln
// if barstate.islast
//     // Rensa tabellen
//     table.clear(sigT, 0, 0, COLS - 1, ROWS - 1)

//     // Rubriker
//     table.cell(sigT, 0, 0, "Indicator", text_color=color.white, bgcolor=color.new(color.black,0))
//     table.cell(sigT, 1, 0, "Side",      text_color=color.white, bgcolor=color.new(color.black,0))
//     table.cell(sigT, 2, 0, "Now",       text_color=color.white, bgcolor=color.new(color.black,0))
//     table.cell(sigT, 3, 0, "Bars ago",  text_color=color.white, bgcolor=color.new(color.black,0))
    
//     // Räknare för rader och signaler
//     row = 1
//     buyCnt  = 0
//     sellCnt = 0

//     // ===================== GLOBALA SIGNALER =====================
//     if showGlobalTbl
//         // USI:CVOL – trianglar ÖVER => SELL
//         row := f_add_row(row, "CVOL z>1.5", "SELL",  na(S_sell_signal_1)?false:S_sell_signal_1, nz(S_sell_signal_1, false))
//         sellCnt += na(S_sell_signal_1)?0:(S_sell_signal_1?1:0)

//         row := f_add_row(row, "CVOL z>2.5", "SELL",  na(S_sell_signal_2)?false:S_sell_signal_2, nz(S_sell_signal_2, false))
//         sellCnt += na(S_sell_signal_2)?0:(S_sell_signal_2?1:0)

//         row := f_add_row(row, "CVOL z>3.0", "SELL",  na(S_sell_signal_3)?false:S_sell_signal_3, nz(S_sell_signal_3, false))
//         sellCnt += na(S_sell_signal_3)?0:(S_sell_signal_3?1:0)

//         // PLCE short volume – trianglar UNDER => BUY
//         row := f_add_row(row, "PLCE SV z>3 (50L)", "BUY", na(A_buy_signal_2)?false:A_buy_signal_2, nz(A_buy_signal_2, false))
//         buyCnt += na(A_buy_signal_2)?0:(A_buy_signal_2?1:0)

//         row := f_add_row(row, "PLCE SV z>3 (20L)", "BUY", na(A_buy_signal_3)?false:A_buy_signal_3, nz(A_buy_signal_3, false))
//         buyCnt += na(A_buy_signal_3)?0:(A_buy_signal_3?1:0)

//         // R3TW & MMTW – UNDER => BUY
//         row := f_add_row(row, "R3TW & MMTW > 20", "BUY", na(buySignalCondition)?false:buySignalCondition, nz(buySignalCondition, false))
//         buyCnt += na(buySignalCondition)?0:(buySignalCondition?1:0)

//         // CUM HI-LO – ÖVER => SELL
//         row := f_add_row(row, "CUM HI-LO < 2", "SELL", na(bgcolorCondition)?false:bgcolorCondition, nz(bgcolorCondition, false))
//         sellCnt += na(bgcolorCondition)?0:(bgcolorCondition?1:0)

//         // VVIX/VIX/GLD – ÖVER => SELL
//         row := f_add_row(row, "VVIX+VIX+GLD corr", "SELL", na(sellSignalCondition)?false:sellSignalCondition, nz(sellSignalCondition, false))
//         sellCnt += na(sellSignalCondition)?0:(sellSignalCondition?1:0)

//         // VIX & SPX – ÖVER => SELL
//         row := f_add_row(row, "VIX & SPX corr", "SELL", na(sellSignalCondition1)?false:sellSignalCondition1, nz(sellSignalCondition1, false))
//         sellCnt += na(sellSignalCondition1)?0:(sellSignalCondition1?1:0)

//         // PLCE extremes – UNDER => BUY
//         row := f_add_row(row, "PUT Volume extremes", "BUY", na(pvlce)?false:(pvlce > threshold), nz((pvlce > threshold), false))
//         buyCnt += na(pvlce)?0:((pvlce>threshold)?1:0)

//         // Yield curve
//         row := f_add_row(row, "Yield 10Y-2Y BUY",  "BUY",  na(buySignal)?false:buySignal, nz(buySignal, false))
//         buyCnt += na(buySignal)?0:(buySignal?1:0)

//         row := f_add_row(row, "Yield 10Y-2Y SELL", "SELL", na(sellSignal)?false:sellSignal, nz(sellSignal, false))
//         sellCnt += na(sellSignal)?0:(sellSignal?1:0)

//     // ===================== LOKALA (CHART) SIGNALER =====================
//     // BREDD
//     row := f_add_row(row, "BREDD Buy",  "BUY",  na(buySignal1)?false:buySignal1, nz(buySignal1, false))
//     buyCnt += na(buySignal1)?0:(buySignal1?1:0)

//     row := f_add_row(row, "BREDD Sell", "SELL", na(sellSignal1)?false:sellSignal1, nz(sellSignal1, false))
//     sellCnt += na(sellSignal1)?0:(sellSignal1?1:0)

//     // Z-cross vs avg
//     row := f_add_row(row, "Z cross↑ avg<-1",  "BUY",  na(conditionbuy_z)?false:conditionbuy_z, nz(conditionbuy_z, false))
//     buyCnt += na(conditionbuy_z)?0:(conditionbuy_z?1:0)

//     row := f_add_row(row, "Z cross↓ avg>1.4", "SELL", na(conditionsell_z)?false:conditionsell_z, nz(conditionsell_z, false))
//     sellCnt += na(conditionsell_z)?0:(conditionsell_z?1:0)

//     // Z(±1.5)
//     row := f_add_row(row, "Z(1.5) BUY",  "BUY",  na(conditionbuy_z2)?false:conditionbuy_z2, nz(conditionbuy_z2, false))
//     buyCnt += na(conditionbuy_z2)?0:(conditionbuy_z2?1:0)

//     row := f_add_row(row, "Z(1.5) SELL", "SELL", na(conditionsell_z2)?false:conditionsell_z2, nz(conditionsell_z2, false))
//     sellCnt += na(conditionsell_z2)?0:(conditionsell_z2?1:0)

//     // Z-extremer
//     row := f_add_row(row, "Z < -3",   "BUY",  na(normalBuySignal)?false:normalBuySignal, nz(normalBuySignal, false))
//     buyCnt += na(normalBuySignal)?0:(normalBuySignal?1:0)

//     row := f_add_row(row, "Z < -3.5", "BUY",  na(verynormalBuySignal)?false:verynormalBuySignal, nz(verynormalBuySignal, false))
//     buyCnt += na(verynormalBuySignal)?0:(verynormalBuySignal?1:0)

//     row := f_add_row(row, "Z cross↓ 2.5", "SELL", na(sellSignal4)?false:sellSignal4, nz(sellSignal4, false))
//     sellCnt += na(sellSignal4)?0:(sellSignal4?1:0)

//     row := f_add_row(row, "Z > 3",    "SELL", na(normalSellSignal)?false:normalSellSignal, nz(normalSellSignal, false))
//     sellCnt += na(normalSellSignal)?0:(normalSellSignal?1:0)

//     row := f_add_row(row, "Z > 3.5",  "SELL", na(verynormalSellSignal)?false:verynormalSellSignal, nz(verynormalSellSignal, false))
//     sellCnt += na(verynormalSellSignal)?0:(verynormalSellSignal?1:0)

//     // Z-momentum (båda plot på TOP => SELL & SELL)
//     row := f_add_row(row, "Z mom cross↑2",  "SELL", na(buySignal2)?false:buySignal2, nz(buySignal2, false))
//     sellCnt += na(buySignal2)?0:(buySignal2?1:0)

//     row := f_add_row(row, "Z mom cross↓-2", "SELL", na(sellSignal2)?false:sellSignal2, nz(sellSignal2, false))
//     sellCnt += na(sellSignal2)?0:(sellSignal2?1:0)

//     // 20D breakouts (dina plots på TOP)
//     row := f_add_row(row, "20D High Break", "SELL", na(buySignal55)?false:buySignal55, nz(buySignal55, false))
//     sellCnt += na(buySignal55)?0:(buySignal55?1:0)

//     row := f_add_row(row, "20D Low Break",  "SELL", na(sellSignal55)?false:sellSignal55, nz(sellSignal55, false))
//     sellCnt += na(sellSignal55)?0:(sellSignal55?1:0)

//     // MTF Sync (dina plots på TOP)
//     row := f_add_row(row, "TF Sync BUY",  "SELL", na(buySignal88)?false:buySignal88, nz(buySignal88, false))
//     sellCnt += na(buySignal88)?0:(buySignal88?1:0)

//     row := f_add_row(row, "TF Sync SELL", "SELL", na(sellSignal88)?false:sellSignal88, nz(sellSignal88, false))
//     sellCnt += na(sellSignal88)?0:(sellSignal88?1:0)

//     // Fallback när inget triggar
//     if row == 1
//         table.cell(sigT, 0, 1, "No signals", text_color=color.silver)
//         table.cell(sigT, 1, 1, "-",          text_color=color.silver)

//     // Summering
//     sumRow = math.min(row + 1, ROWS - 1)
//     table.cell(sigT, 0, sumRow, "TOTAL", text_color=color.white, bgcolor=color.new(color.black,0))
//     table.cell(sigT, 1, sumRow, "BUY",   text_color=color.white, bgcolor=color.new(color.green,70))
//     table.cell(sigT, 2, sumRow, str.tostring(buyCnt),  text_color=color.white, bgcolor=color.new(color.green,70))
//     table.cell(sigT, 3, sumRow, "", text_color=color.white)
//     sumRow += 1
//     table.cell(sigT, 1, sumRow, "SELL",  text_color=color.white, bgcolor=color.new(color.red,70))
//     table.cell(sigT, 2, sumRow, str.tostring(sellCnt), text_color=color.white, bgcolor=color.new(color.red,70))


// // =====================================================================
// // ====================== SIGNAL TABLE (NO EXTRA SECURITY CALLS) ========
// var int COLS = 4
// var int ROWS = 60
// var table sigT = table.new(position.top_right, COLS, ROWS,
//      frame_color=color.new(color.gray,80), border_width=1, border_color=color.new(color.gray,80))

// // Visa/dölj GLOBAL-del i tabellen (påverkar inte plots)
// showGlobalTbl = input.bool(true, "Show GLOBAL section in table")

// // ---- Bars-ago: leta bakåt inom fast fönster (säkerställer siffra)
// barsAgoLookback = input.int(500, "Bars-ago lookback", minval=1)

// // Leta senaste true utan att gå utanför historikbufferten
// // --- SAFE helpers (no historical indexing) ---
// f_last_true_ago(_cond) =>
//     // bars since _cond was true on this chart; na if never true
//     ta.barssince(nz(_cond, false))

// f_barsago_txt(_cond) =>
//     _n = f_last_true_ago(_cond)
//     na(_n) ? "-" : str.tostring(_n)


// // Lägg en rad
// f_add_row(_r, _name, _side, _onCond, _barsCond) =>
//     _buyCol  = color.new(color.green, 70)
//     _sellCol = color.new(color.red,   70)
//     _sideCol = _side == "BUY" ? _buyCol : _sellCol

//     // normalize conditions till strikta bools
//     _onSafe   = nz(_onCond,   false)
//     _barsSafe = nz(_barsCond, false)

//     _nowTxt = _onSafe ? "ON" : "-"
//     _nowBg  = _onSafe ? _sideCol : na

//     table.cell(sigT, 0, _r, _name,  text_color=color.white, bgcolor=color.new(color.black,0))
//     table.cell(sigT, 1, _r, _side,  text_color=color.white, bgcolor=_sideCol)
//     table.cell(sigT, 2, _r, _nowTxt,text_color=color.white, bgcolor=_nowBg)
//     table.cell(sigT, 3, _r, f_barsago_txt(_barsSafe), text_color=color.new(color.white,30))
//     _r + 1

// if barstate.islast
//     // Rensa
//     table.clear(sigT, 0, 0, COLS - 1, ROWS - 1)

//     // Header
//     table.cell(sigT, 0, 0, "Indicator", text_color=color.white, bgcolor=color.new(color.black,0))
//     table.cell(sigT, 1, 0, "Side",      text_color=color.white, bgcolor=color.new(color.black,0))
//     table.cell(sigT, 2, 0, "Now",       text_color=color.white, bgcolor=color.new(color.black,0))
//     table.cell(sigT, 3, 0, "Bars ago",  text_color=color.white, bgcolor=color.new(color.black,0))
    
//     // Räknare
//     row = 1
//     buyCnt  = 0
//     sellCnt = 0

//     // ===================== GLOBALA SIGNALER =====================
//     if showGlobalTbl
//         // USI:CVOL – trianglar ÖVER => SELL
//         row := f_add_row(row, "CVOL z>1.5", "SELL",  na(S_sell_signal_1)?false:S_sell_signal_1, S_sell_signal_1)
//         sellCnt += na(S_sell_signal_1)?0:(S_sell_signal_1?1:0)

//         row := f_add_row(row, "CVOL z>2.5", "SELL",  na(S_sell_signal_2)?false:S_sell_signal_2, S_sell_signal_2)
//         sellCnt += na(S_sell_signal_2)?0:(S_sell_signal_2?1:0)

//         row := f_add_row(row, "CVOL z>3.0", "SELL",  na(S_sell_signal_3)?false:S_sell_signal_3, S_sell_signal_3)
//         sellCnt += na(S_sell_signal_3)?0:(S_sell_signal_3?1:0)

//         // PLCE short volume – trianglar UNDER => BUY
//         row := f_add_row(row, "PLCE SV z>3 (50L)", "BUY", na(A_buy_signal_2)?false:A_buy_signal_2, A_buy_signal_2)
//         buyCnt += na(A_buy_signal_2)?0:(A_buy_signal_2?1:0)

//         row := f_add_row(row, "PLCE SV z>3 (20L)", "BUY", na(A_buy_signal_3)?false:A_buy_signal_3, A_buy_signal_3)
//         buyCnt += na(A_buy_signal_3)?0:(A_buy_signal_3?1:0)

//         // R3TW & MMTW – UNDER => BUY
//         row := f_add_row(row, "R3TW & MMTW > 20", "BUY", na(buySignalCondition)?false:buySignalCondition, buySignalCondition)
//         buyCnt += na(buySignalCondition)?0:(buySignalCondition?1:0)

//         // CUM HI-LO – ÖVER => SELL
//         row := f_add_row(row, "CUM HI-LO < 2", "SELL", na(bgcolorCondition)?false:bgcolorCondition, bgcolorCondition)
//         sellCnt += na(bgcolorCondition)?0:(bgcolorCondition?1:0)

//         // VVIX/VIX/GLD – ÖVER => SELL
//         row := f_add_row(row, "VVIX+VIX+GLD corr", "SELL", na(sellSignalCondition)?false:sellSignalCondition, sellSignalCondition)
//         sellCnt += na(sellSignalCondition)?0:(sellSignalCondition?1:0)

//         // VIX & SPX – ÖVER => SELL
//         row := f_add_row(row, "VIX & SPX corr", "SELL", na(sellSignalCondition1)?false:sellSignalCondition1, sellSignalCondition1)
//         sellCnt += na(sellSignalCondition1)?0:(sellSignalCondition1?1:0)

//         // PLCE extremes – UNDER => BUY
//         row := f_add_row(row, "PUT Volume extremes", "BUY", na(pvlce)?false:(pvlce > threshold), (pvlce > threshold))
//         buyCnt += na(pvlce)?0:((pvlce>threshold)?1:0)

//         // Yield curve
//         row := f_add_row(row, "Yield 10Y-2Y BUY",  "BUY",  na(buySignal)?false:buySignal,  buySignal)
//         buyCnt += na(buySignal)?0:(buySignal?1:0)

//         row := f_add_row(row, "Yield 10Y-2Y SELL", "SELL", na(sellSignal)?false:sellSignal, sellSignal)
//         sellCnt += na(sellSignal)?0:(sellSignal?1:0)

//     // ===================== LOKALA (CHART) SIGNALER =====================
//     // BREDD
//     row := f_add_row(row, "BREDD Buy",  "BUY",  na(buySignal1)?false:buySignal1, buySignal1)
//     buyCnt += na(buySignal1)?0:(buySignal1?1:0)

//     row := f_add_row(row, "BREDD Sell", "SELL", na(sellSignal1)?false:sellSignal1, sellSignal1)
//     sellCnt += na(sellSignal1)?0:(sellSignal1?1:0)

//     // Z-cross vs avg
//     row := f_add_row(row, "Z cross↑ avg<-1",  "BUY",  na(conditionbuy_z)?false:conditionbuy_z, conditionbuy_z)
//     buyCnt += na(conditionbuy_z)?0:(conditionbuy_z?1:0)

//     row := f_add_row(row, "Z cross↓ avg>1.4", "SELL", na(conditionsell_z)?false:conditionsell_z, conditionsell_z)
//     sellCnt += na(conditionsell_z)?0:(conditionsell_z?1:0)

//     // Z(±1.5)
//     row := f_add_row(row, "Z(1.5) BUY",  "BUY",  na(conditionbuy_z2)?false:conditionbuy_z2, conditionbuy_z2)
//     buyCnt += na(conditionbuy_z2)?0:(conditionbuy_z2?1:0)

//     row := f_add_row(row, "Z(1.5) SELL", "SELL", na(conditionsell_z2)?false:conditionsell_z2, conditionsell_z2)
//     sellCnt += na(conditionsell_z2)?0:(conditionsell_z2?1:0)

//     // Z-extremer
//     row := f_add_row(row, "Z < -3",   "BUY",  na(normalBuySignal)?false:normalBuySignal, normalBuySignal)
//     buyCnt += na(normalBuySignal)?0:(normalBuySignal?1:0)

//     row := f_add_row(row, "Z < -3.5","BUY",  na(verynormalBuySignal)?false:verynormalBuySignal, verynormalBuySignal)
//     buyCnt += na(verynormalBuySignal)?0:(verynormalBuySignal?1:0)

//     row := f_add_row(row, "Z cross↓ 2.5","SELL", na(sellSignal4)?false:sellSignal4, sellSignal4)
//     sellCnt += na(sellSignal4)?0:(sellSignal4?1:0)

//     row := f_add_row(row, "Z > 3",    "SELL", na(normalSellSignal)?false:normalSellSignal, normalSellSignal)
//     sellCnt += na(normalSellSignal)?0:(normalSellSignal?1:0)

//     row := f_add_row(row, "Z > 3.5",  "SELL", na(verynormalSellSignal)?false:verynormalSellSignal, verynormalSellSignal)
//     sellCnt += na(verynormalSellSignal)?0:(verynormalSellSignal?1:0)

//     // Z-momentum (båda plot på TOP => SELL & SELL)
//     row := f_add_row(row, "Z mom cross↑2",  "SELL", na(buySignal2)?false:buySignal2,  buySignal2)
//     sellCnt += na(buySignal2)?0:(buySignal2?1:0)

//     row := f_add_row(row, "Z mom cross↓-2","SELL", na(sellSignal2)?false:sellSignal2, sellSignal2)
//     sellCnt += na(sellSignal2)?0:(sellSignal2?1:0)

//     // 20D breakouts (dina plots på TOP)
//     row := f_add_row(row, "20D High Break", "SELL", na(buySignal55)?false:buySignal55, buySignal55)
//     sellCnt += na(buySignal55)?0:(buySignal55?1:0)

//     row := f_add_row(row, "20D Low Break",  "SELL", na(sellSignal55)?false:sellSignal55, sellSignal55)
//     sellCnt += na(sellSignal55)?0:(sellSignal55?1:0)

//     // MTF Sync (dina plots på TOP)
//     row := f_add_row(row, "TF Sync BUY",  "SELL", na(buySignal88)?false:buySignal88,  buySignal88)
//     sellCnt += na(buySignal88)?0:(buySignal88?1:0)

//     row := f_add_row(row, "TF Sync SELL", "SELL", na(sellSignal88)?false:sellSignal88, sellSignal88)
//     sellCnt += na(sellSignal88)?0:(sellSignal88?1:0)

//     // Fallback när inget triggar
//     if row == 1
//         table.cell(sigT, 0, 1, "No signals", text_color=color.silver)
//         table.cell(sigT, 1, 1, "-",          text_color=color.silver)

//     // Summering
//     sumRow = math.min(row + 1, ROWS - 1)
//     table.cell(sigT, 0, sumRow, "TOTAL", text_color=color.white, bgcolor=color.new(color.black,0))
//     table.cell(sigT, 1, sumRow, "BUY",   text_color=color.white, bgcolor=color.new(color.green,70))
//     table.cell(sigT, 2, sumRow, str.tostring(buyCnt),  text_color=color.white, bgcolor=color.new(color.green,70))
//     table.cell(sigT, 3, sumRow, "", text_color=color.white)
//     sumRow += 1
//     table.cell(sigT, 1, sumRow, "SELL",  text_color=color.white, bgcolor=color.new(color.red,70))
//     table.cell(sigT, 2, sumRow, str.tostring(sellCnt), text_color=color.white, bgcolor=color.new(color.red,70))

// =====================================================================
// ====================== SIGNAL TABLE (per-signal bars-ago) ============

// Visa/dölj GLOBAL-del i tabellen (påverkar inte plots)
showGlobalTbl  = input.bool(true, "Show GLOBAL section in table")
lookbackBars   = input.int(500, "Bars-ago window", minval=1, maxval=10000)

// ---- Hjälpare
f_last_ago(_cond) =>
    // antal bars sedan _cond sist var true (na om aldrig)
    _bi = ta.valuewhen(nz(_cond, false), bar_index, 0)
    na(_bi) ? na : (bar_index - _bi)

f_fmt_ago(_ago) =>
    na(_ago) ? ">" + str.tostring(lookbackBars) :
      (_ago > lookbackBars ? ">" + str.tostring(lookbackBars) : str.tostring(_ago))

// ---- Skapa “bars-ago”-variabler för samtliga signaler (definiera dem EFTER att alla conditions skapats)
ago_S_sell_signal_1 = f_last_ago(S_sell_signal_1)
ago_S_sell_signal_2 = f_last_ago(S_sell_signal_2)
ago_S_sell_signal_3 = f_last_ago(S_sell_signal_3)

ago_A_buy_signal_2  = f_last_ago(A_buy_signal_2)
ago_A_buy_signal_3  = f_last_ago(A_buy_signal_3)

ago_buySignalCondition = f_last_ago(buySignalCondition)
ago_bgcolorCondition   = f_last_ago(bgcolorCondition)
ago_sellSignalCondition = f_last_ago(sellSignalCondition)
ago_sellSignalCondition1 = f_last_ago(sellSignalCondition1)

cond_pvlce_over = pvlce > threshold
ago_pvlce_over  = f_last_ago(cond_pvlce_over)

ago_buySignal   = f_last_ago(buySignal)
ago_sellSignal  = f_last_ago(sellSignal)

ago_breddBuy    = f_last_ago(buySignal1)
ago_breddSell   = f_last_ago(sellSignal1)

ago_zAvgBuy     = f_last_ago(conditionbuy_z)
ago_zAvgSell    = f_last_ago(conditionsell_z)

ago_z15_Buy     = f_last_ago(conditionbuy_z2)
ago_z15_Sell    = f_last_ago(conditionsell_z2)

ago_z_lt3_Buy   = f_last_ago(normalBuySignal)
ago_z_lt35_Buy  = f_last_ago(verynormalBuySignal)
ago_z_cross25_Sell = f_last_ago(sellSignal4)
ago_z_gt3_Sell  = f_last_ago(normalSellSignal)
ago_z_gt35_Sell = f_last_ago(verynormalSellSignal)

ago_zmom_up2_Sell   = f_last_ago(buySignal2)   // din “OB warn” överst
ago_zmom_dn2_Sell   = f_last_ago(sellSignal2)

ago_break20_Hi = f_last_ago(buySignal55)
ago_break20_Lo = f_last_ago(sellSignal55)

ago_tfSyncBuy  = f_last_ago(buySignal88)
ago_tfSyncSell = f_last_ago(sellSignal88)

// ---- Tabell
var int   COLS = 4
var int   ROWS = 60
var table sigT = table.new(position.top_right, COLS, ROWS,
     frame_color=color.new(color.gray,80), border_width=1, border_color=color.new(color.gray,80))

f_add_row(_r, _name, _side, _onCond, _agoInt) =>
    _buyCol  = color.new(color.green, 70)
    _sellCol = color.new(color.red,   70)
    _sideCol = _side == "BUY" ? _buyCol : _sellCol

    _onSafe  = nz(_onCond, false)
    _nowTxt  = _onSafe ? "ON" : "-"
    _nowBg   = _onSafe ? _sideCol : na

    table.cell(sigT, 0, _r, _name,  text_color=color.white, bgcolor=color.new(color.black,0))
    table.cell(sigT, 1, _r, _side,  text_color=color.white, bgcolor=_sideCol)
    table.cell(sigT, 2, _r, _nowTxt,text_color=color.white, bgcolor=_nowBg)
    table.cell(sigT, 3, _r, f_fmt_ago(_agoInt), text_color=color.new(color.white,30))
    _r + 1

if barstate.islast
    // Rensa & header
    table.clear(sigT, 0, 0, COLS - 1, ROWS - 1)
    table.cell(sigT, 0, 0, "Indicator", text_color=color.white, bgcolor=color.new(color.black,0))
    table.cell(sigT, 1, 0, "Side",      text_color=color.white, bgcolor=color.new(color.black,0))
    table.cell(sigT, 2, 0, "Now",       text_color=color.white, bgcolor=color.new(color.black,0))
    table.cell(sigT, 3, 0, "Bars ago",  text_color=color.white, bgcolor=color.new(color.black,0))

    row = 1
    buyCnt  = 0
    sellCnt = 0

    // ===================== GLOBALA SIGNALER =====================
    if showGlobalTbl
        row := f_add_row(row, "CVOL z>1.5", "SELL", S_sell_signal_1, ago_S_sell_signal_1)
        sellCnt += S_sell_signal_1 ? 1 : 0
        row := f_add_row(row, "CVOL z>2.5", "SELL", S_sell_signal_2, ago_S_sell_signal_2)
        sellCnt += S_sell_signal_2 ? 1 : 0
        row := f_add_row(row, "CVOL z>3.0", "SELL", S_sell_signal_3, ago_S_sell_signal_3)
        sellCnt += S_sell_signal_3 ? 1 : 0

        row := f_add_row(row, "PLCE SV z>3 (50L)", "BUY",  A_buy_signal_2, ago_A_buy_signal_2)
        buyCnt += A_buy_signal_2 ? 1 : 0
        row := f_add_row(row, "PLCE SV z>3 (20L)", "BUY",  A_buy_signal_3, ago_A_buy_signal_3)
        buyCnt += A_buy_signal_3 ? 1 : 0

        row := f_add_row(row, "R3TW & MMTW > 20", "BUY",  buySignalCondition, ago_buySignalCondition)
        buyCnt += buySignalCondition ? 1 : 0
        row := f_add_row(row, "CUM HI-LO < 2",    "SELL", bgcolorCondition,   ago_bgcolorCondition)
        sellCnt += bgcolorCondition ? 1 : 0

        row := f_add_row(row, "VVIX+VIX+GLD corr","SELL", sellSignalCondition,  ago_sellSignalCondition)
        sellCnt += sellSignalCondition ? 1 : 0
        row := f_add_row(row, "VIX & SPX corr",   "SELL", sellSignalCondition1, ago_sellSignalCondition1)
        sellCnt += sellSignalCondition1 ? 1 : 0

        row := f_add_row(row, "PUT Volume extremes","BUY", cond_pvlce_over, ago_pvlce_over)
        buyCnt += cond_pvlce_over ? 1 : 0

        row := f_add_row(row, "Yield 10Y-2Y BUY", "BUY",  buySignal,  ago_buySignal)
        buyCnt += buySignal ? 1 : 0
        row := f_add_row(row, "Yield 10Y-2Y SELL","SELL", sellSignal, ago_sellSignal)
        sellCnt += sellSignal ? 1 : 0

    // ===================== LOKALA (CHART) SIGNALER =====================
    row := f_add_row(row, "BREDD Buy",  "BUY",  buySignal1,  ago_breddBuy)
    buyCnt += buySignal1 ? 1 : 0
    row := f_add_row(row, "BREDD Sell", "SELL", sellSignal1, ago_breddSell)
    sellCnt += sellSignal1 ? 1 : 0

    row := f_add_row(row, "Z cross↑ avg<-1",  "BUY",  conditionbuy_z,  ago_zAvgBuy)
    buyCnt += conditionbuy_z ? 1 : 0
    row := f_add_row(row, "Z cross↓ avg>1.4", "SELL", conditionsell_z, ago_zAvgSell)
    sellCnt += conditionsell_z ? 1 : 0

    row := f_add_row(row, "Z(1.5) BUY",  "BUY",  conditionbuy_z2,  ago_z15_Buy)
    buyCnt += conditionbuy_z2 ? 1 : 0
    row := f_add_row(row, "Z(1.5) SELL", "SELL", conditionsell_z2, ago_z15_Sell)
    sellCnt += conditionsell_z2 ? 1 : 0

    row := f_add_row(row, "Z < -3",     "BUY",  normalBuySignal,     ago_z_lt3_Buy)
    buyCnt += normalBuySignal ? 1 : 0
    row := f_add_row(row, "Z < -3.5",   "BUY",  verynormalBuySignal,  ago_z_lt35_Buy)
    buyCnt += verynormalBuySignal ? 1 : 0
    row := f_add_row(row, "Z cross↓ 2.5","SELL", sellSignal4,         ago_z_cross25_Sell)
    sellCnt += sellSignal4 ? 1 : 0
    row := f_add_row(row, "Z > 3",      "SELL", normalSellSignal,     ago_z_gt3_Sell)
    sellCnt += normalSellSignal ? 1 : 0
    row := f_add_row(row, "Z > 3.5",    "SELL", verynormalSellSignal,  ago_z_gt35_Sell)
    sellCnt += verynormalSellSignal ? 1 : 0

    row := f_add_row(row, "Z mom cross↑2","SELL", buySignal2, ago_zmom_up2_Sell)
    sellCnt += buySignal2 ? 1 : 0
    row := f_add_row(row, "Z mom cross↓-2","SELL", sellSignal2, ago_zmom_dn2_Sell)
    sellCnt += sellSignal2 ? 1 : 0

    row := f_add_row(row, "20D High Break","SELL", buySignal55,  ago_break20_Hi)
    sellCnt += buySignal55 ? 1 : 0
    row := f_add_row(row, "20D Low Break", "SELL", sellSignal55, ago_break20_Lo)
    sellCnt += sellSignal55 ? 1 : 0

    row := f_add_row(row, "TF Sync BUY", "SELL", buySignal88,  ago_tfSyncBuy)
    sellCnt += buySignal88 ? 1 : 0
    row := f_add_row(row, "TF Sync SELL","SELL", sellSignal88, ago_tfSyncSell)
    sellCnt += sellSignal88 ? 1 : 0

    // Fallback när inget triggade
    if row == 1
        table.cell(sigT, 0, 1, "No signals", text_color=color.silver)
        table.cell(sigT, 1, 1, "-",          text_color=color.silver)

    // Summering
    sumRow = math.min(row + 1, ROWS - 1)
    table.cell(sigT, 0, sumRow, "TOTAL", text_color=color.white, bgcolor=color.new(color.black,0))
    table.cell(sigT, 1, sumRow, "BUY",   text_color=color.white, bgcolor=color.new(color.green,70))
    table.cell(sigT, 2, sumRow, str.tostring(buyCnt),  text_color=color.white, bgcolor=color.new(color.green,70))
    table.cell(sigT, 3, sumRow, "", text_color=color.white)
    sumRow += 1
    table.cell(sigT, 1, sumRow, "SELL",  text_color=color.white, bgcolor=color.new(color.red,70))
    table.cell(sigT, 2, sumRow, str.tostring(sellCnt), text_color=color.white, bgcolor=color.new(color.red,70))
