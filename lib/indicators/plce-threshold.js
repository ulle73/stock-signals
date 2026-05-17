import { normalizeNumber, toNumber } from './statistics.js';

const THRESHOLD = 3_000_000;

function buildLookup(rowsOrMap) {
  if (rowsOrMap instanceof Map) {
    return rowsOrMap;
  }

  return new Map((rowsOrMap ?? []).map((row) => [row.date, row]));
}

export function buildPlceThresholdIndicatorRows(priceRows, plceRowsOrMap) {
  const lookup = buildLookup(plceRowsOrMap);

  return priceRows.map((row) => {
    const plceRow = lookup.get(row.date);
    const plceValue = toNumber(plceRow?.plce_short_volume);
    const plce_threshold_buy_signal = plceValue !== null && plceValue > THRESHOLD;

    return {
      ticker: row.ticker,
      date: row.date,
      plce_threshold_value: plceValue === null ? null : normalizeNumber(plceValue),
      plce_threshold_buy_signal,
      plce_threshold_signal: plce_threshold_buy_signal ? 'buy' : 'none',
    };
  });
}
