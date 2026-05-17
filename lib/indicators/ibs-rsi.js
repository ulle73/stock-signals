import { normalizeNumber, sortRowsByDate, toNumber } from './statistics.js';

const RSI_LENGTH = 14;
const IBS_THRESHOLD = 20;
const RSI_THRESHOLD = 30;

function calculateIbsValue(row) {
  const high = toNumber(row.high);
  const low = toNumber(row.low);
  const close = toNumber(row.close);

  if (high === null || low === null || close === null) {
    return null;
  }

  const range = high - low;
  if (!Number.isFinite(range) || range <= 0) {
    return null;
  }

  return normalizeNumber(((close - low) / range) * 100);
}

function calculateRsi14(rows) {
  const gains = [];
  const losses = [];
  let previousClose = null;
  let averageGain = null;
  let averageLoss = null;

  return rows.map((row, index) => {
    const close = toNumber(row.close);
    if (close === null) {
      previousClose = null;
      return null;
    }

    if (previousClose === null) {
      previousClose = close;
      return null;
    }

    const change = close - previousClose;
    gains.push(change > 0 ? change : 0);
    losses.push(change < 0 ? Math.abs(change) : 0);
    previousClose = close;

    if (index < RSI_LENGTH) {
      return null;
    }

    if (averageGain === null || averageLoss === null) {
      averageGain = gains.slice(-RSI_LENGTH).reduce((sum, value) => sum + value, 0) / RSI_LENGTH;
      averageLoss = losses.slice(-RSI_LENGTH).reduce((sum, value) => sum + value, 0) / RSI_LENGTH;
    } else {
      averageGain = ((averageGain * (RSI_LENGTH - 1)) + gains.at(-1)) / RSI_LENGTH;
      averageLoss = ((averageLoss * (RSI_LENGTH - 1)) + losses.at(-1)) / RSI_LENGTH;
    }

    if (averageGain === 0 && averageLoss === 0) {
      return 50;
    }

    if (averageLoss === 0) {
      return 100;
    }

    if (averageGain === 0) {
      return 0;
    }

    const relativeStrength = averageGain / averageLoss;
    return normalizeNumber(100 - (100 / (1 + relativeStrength)));
  });
}

export function buildIbsRsiIndicatorRows(rows) {
  const sortedRows = sortRowsByDate(rows);
  const rsiSeries = calculateRsi14(sortedRows);

  return sortedRows.map((row, index) => {
    const ibs_value = calculateIbsValue(row);
    const rsi14 = rsiSeries[index];
    const ibs_rsi_buy_signal =
      ibs_value !== null &&
      rsi14 !== null &&
      ibs_value < IBS_THRESHOLD &&
      rsi14 < RSI_THRESHOLD;

    return {
      ticker: row.ticker,
      date: row.date,
      ibs_value,
      rsi14,
      ibs_rsi_buy_signal,
      ibs_rsi_signal: ibs_rsi_buy_signal ? 'buy' : 'none',
    };
  });
}
