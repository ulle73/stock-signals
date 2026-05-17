import {
  calculateRollingPopulationZscore,
  normalizeNumber,
  sortRowsByDate,
  toNumber,
} from './statistics.js';

const LOOKBACK = 20;
const AVERAGE_LOOKBACK = 20;
const BUY_AVG_THRESHOLD = -1;
const SELL_AVG_THRESHOLD = 1.4;

function getSourcePrice(row) {
  return toNumber(row.adj_close ?? row.close);
}

function averageLast(values, length) {
  if (values.length < length) {
    return null;
  }

  const window = values.slice(-length);
  if (window.some((value) => value === null)) {
    return null;
  }

  return normalizeNumber(window.reduce((sum, value) => sum + value, 0) / length);
}

function resolveSignal({ buySignal, sellSignal }) {
  if (buySignal) return 'buy';
  if (sellSignal) return 'sell';
  return 'none';
}

export function buildPriceZscoreIndicatorRows(rows) {
  const sortedRows = sortRowsByDate(rows);
  const priceHistory = [];
  const zscoreHistory = [];
  let previousZscore = null;
  let previousAverage = null;

  return sortedRows.map((row) => {
    const sourcePrice = getSourcePrice(row);
    priceHistory.push(sourcePrice);

    const price_zscore_20 = calculateRollingPopulationZscore(priceHistory, LOOKBACK);
    if (price_zscore_20 !== null) {
      zscoreHistory.push(price_zscore_20);
    }

    const price_zscore_avg_20 = price_zscore_20 === null
      ? null
      : averageLast(zscoreHistory, AVERAGE_LOOKBACK);
    const price_zscore_buy_signal =
      previousZscore !== null &&
      previousAverage !== null &&
      price_zscore_20 !== null &&
      price_zscore_avg_20 !== null &&
      previousZscore <= previousAverage &&
      price_zscore_20 > price_zscore_avg_20 &&
      price_zscore_avg_20 < BUY_AVG_THRESHOLD;
    const price_zscore_sell_signal =
      previousZscore !== null &&
      previousAverage !== null &&
      price_zscore_20 !== null &&
      price_zscore_avg_20 !== null &&
      previousZscore >= previousAverage &&
      price_zscore_20 < price_zscore_avg_20 &&
      price_zscore_avg_20 > SELL_AVG_THRESHOLD;

    const result = {
      ticker: row.ticker,
      date: row.date,
      price_zscore_20,
      price_zscore_avg_20,
      price_zscore_buy_signal,
      price_zscore_sell_signal,
      price_zscore_signal: resolveSignal({
        buySignal: price_zscore_buy_signal,
        sellSignal: price_zscore_sell_signal,
      }),
    };

    previousZscore = price_zscore_20;
    previousAverage = price_zscore_avg_20;

    return result;
  });
}
