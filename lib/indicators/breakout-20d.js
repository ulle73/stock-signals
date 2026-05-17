import { normalizeNumber, sortRowsByDate, toNumber } from './statistics.js';

const LOOKBACK = 20;
const OFFSET = 1;

function getSourcePrice(row) {
  return toNumber(row.adj_close ?? row.close);
}

function resolveSignal({ buySignal, sellSignal }) {
  if (buySignal) return 'buy';
  if (sellSignal) return 'sell';
  return 'none';
}

export function buildBreakout20dIndicatorRows(rows) {
  const sortedRows = sortRowsByDate(rows);
  const priceHistory = [];
  let previousPrice = null;
  let previousHighBreak = null;
  let previousLowBreak = null;

  return sortedRows.map((row) => {
    const sourcePrice = getSourcePrice(row);
    priceHistory.push(sourcePrice);

    const breakout_20d_high = priceHistory.length >= LOOKBACK
      ? normalizeNumber(Math.max(...priceHistory.slice(-LOOKBACK)) - OFFSET)
      : null;
    const breakout_20d_low = priceHistory.length >= LOOKBACK
      ? normalizeNumber(Math.min(...priceHistory.slice(-LOOKBACK)) + OFFSET)
      : null;
    const breakout_20d_buy_signal =
      previousPrice !== null &&
      previousHighBreak !== null &&
      breakout_20d_high !== null &&
      previousPrice <= previousHighBreak &&
      sourcePrice > breakout_20d_high;
    const breakout_20d_sell_signal =
      previousPrice !== null &&
      previousLowBreak !== null &&
      breakout_20d_low !== null &&
      previousPrice >= previousLowBreak &&
      sourcePrice < breakout_20d_low;

    const result = {
      ticker: row.ticker,
      date: row.date,
      breakout_20d_high,
      breakout_20d_low,
      breakout_20d_buy_signal,
      breakout_20d_sell_signal,
      breakout_20d_signal: resolveSignal({
        buySignal: breakout_20d_buy_signal,
        sellSignal: breakout_20d_sell_signal,
      }),
    };

    previousPrice = sourcePrice;
    previousHighBreak = breakout_20d_high;
    previousLowBreak = breakout_20d_low;

    return result;
  });
}
