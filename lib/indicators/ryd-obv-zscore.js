import { calculateRollingPopulationZscore, normalizeNumber, sortRowsByDate, toNumber } from './statistics.js';

const LOOKBACK = 80;
const BUY_THRESHOLD = -2.7;
const SELL_THRESHOLD = 2.7;

function getSourcePrice(row) {
  return toNumber(row.adj_close ?? row.close);
}

export function buildRydObvIndicatorRows(rows) {
  const sortedRows = sortRowsByDate(rows);
  const obvHistory = [];
  let previousSourcePrice = null;
  let previousZscore = null;
  let currentObv = 0;

  return sortedRows.map((row, index) => {
    const sourcePrice = getSourcePrice(row);
    const volume = toNumber(row.volume) ?? 0;

    if (index === 0) {
      currentObv = 0;
    } else if (sourcePrice === previousSourcePrice) {
      currentObv = currentObv;
    } else if (sourcePrice < previousSourcePrice) {
      currentObv -= volume;
    } else {
      currentObv += volume;
    }

    obvHistory.push(currentObv);

    const ryd_obv_zscore_80 = calculateRollingPopulationZscore(obvHistory, LOOKBACK);
    const ryd_obv_buy_signal =
      previousZscore !== null &&
      ryd_obv_zscore_80 !== null &&
      previousZscore <= BUY_THRESHOLD &&
      ryd_obv_zscore_80 > BUY_THRESHOLD;
    const ryd_obv_sell_signal =
      previousZscore !== null &&
      ryd_obv_zscore_80 !== null &&
      previousZscore >= SELL_THRESHOLD &&
      ryd_obv_zscore_80 < SELL_THRESHOLD;

    const result = {
      ticker: row.ticker,
      date: row.date,
      ryd_obv: normalizeNumber(currentObv),
      ryd_obv_zscore_80,
      ryd_obv_buy_signal,
      ryd_obv_sell_signal,
      ryd_obv_signal: ryd_obv_buy_signal ? 'buy' : ryd_obv_sell_signal ? 'sell' : 'none',
    };

    previousSourcePrice = sourcePrice;
    previousZscore = ryd_obv_zscore_80;

    return result;
  });
}
