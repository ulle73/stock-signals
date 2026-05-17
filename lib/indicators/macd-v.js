import { normalizeNumber, sortRowsByDate, toNumber } from './statistics.js';

const FAST_LENGTH = 12;
const SLOW_LENGTH = 26;
const ATR_LENGTH = 26;
const TRIGGER_LEVEL = 70;

function nextEma(previousEma, value, length) {
  if (value === null) {
    return previousEma;
  }

  if (previousEma === null) {
    return value;
  }

  const alpha = 2 / (length + 1);
  return (alpha * value) + ((1 - alpha) * previousEma);
}

function trueRange({ high, low, close }, previousClose) {
  if (high === null || low === null || close === null) {
    return null;
  }

  if (previousClose === null) {
    return normalizeNumber(high - low);
  }

  return normalizeNumber(Math.max(
    high - low,
    Math.abs(high - previousClose),
    Math.abs(low - previousClose)
  ));
}

function resolveSignal({ buySignal, sellSignal, active }) {
  if (buySignal) return 'buy';
  if (sellSignal) return 'sell';
  if (active) return 'active';
  return 'none';
}

export function buildMacdVIndicatorRows(rows) {
  const sortedRows = sortRowsByDate(rows);
  const trHistory = [];
  let previousClose = null;
  let previousFastEma = null;
  let previousSlowEma = null;
  let previousAtr = null;
  let previousMacdV = null;
  let macdVActive = false;

  return sortedRows.map((row) => {
    const close = toNumber(row.close);
    const high = toNumber(row.high);
    const low = toNumber(row.low);

    const fastEma = nextEma(previousFastEma, close, FAST_LENGTH);
    const slowEma = nextEma(previousSlowEma, close, SLOW_LENGTH);
    const tr = trueRange({ high, low, close }, previousClose);
    if (tr !== null) {
      trHistory.push(tr);
    }

    let atr = null;
    if (trHistory.length === ATR_LENGTH) {
      atr = normalizeNumber(trHistory.reduce((sum, value) => sum + value, 0) / ATR_LENGTH);
    } else if (trHistory.length > ATR_LENGTH && previousAtr !== null && tr !== null) {
      atr = normalizeNumber(((previousAtr * (ATR_LENGTH - 1)) + tr) / ATR_LENGTH);
    }

    const macd_v =
      fastEma !== null &&
      slowEma !== null &&
      atr !== null &&
      atr !== 0
        ? normalizeNumber((100 * (fastEma - slowEma)) / atr)
        : null;
    const crossedAboveTrigger =
      previousMacdV !== null &&
      macd_v !== null &&
      previousMacdV <= TRIGGER_LEVEL &&
      macd_v > TRIGGER_LEVEL;
    const macd_v_buy_signal =
      (macdVActive === false && macd_v !== null && macd_v > TRIGGER_LEVEL) ||
      crossedAboveTrigger;
    const macd_v_sell_signal =
      previousFastEma !== null &&
      previousSlowEma !== null &&
      fastEma !== null &&
      slowEma !== null &&
      previousFastEma >= previousSlowEma &&
      fastEma < slowEma;

    if (macd_v_buy_signal) {
      macdVActive = true;
    }
    if (macd_v_sell_signal) {
      macdVActive = false;
    }

    const result = {
      ticker: row.ticker,
      date: row.date,
      macd_v,
      macd_v_buy_signal,
      macd_v_sell_signal,
      macd_v_active: macdVActive,
      macd_v_signal: resolveSignal({
        buySignal: macd_v_buy_signal,
        sellSignal: macd_v_sell_signal,
        active: macdVActive,
      }),
    };

    previousClose = close;
    previousFastEma = fastEma;
    previousSlowEma = slowEma;
    previousAtr = atr;
    previousMacdV = macd_v;

    return result;
  });
}
