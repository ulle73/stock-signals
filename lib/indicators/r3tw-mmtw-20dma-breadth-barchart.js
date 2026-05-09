import { normalizeNumber, sortRowsByDate, toNumber } from './statistics.js';

function groupRowsByDate(rows) {
  const grouped = new Map();

  for (const row of sortRowsByDate(rows)) {
    const bucket = grouped.get(row.date) ?? { date: row.date };
    bucket[row.series_key] = row;
    grouped.set(row.date, bucket);
  }

  return [...grouped.values()].filter((row) => row.R3TW && row.MMTW);
}

export function buildR3twMmtw20dmaBreadthIndicatorRows(rows) {
  const dailyRows = groupRowsByDate(rows);
  let previous = null;

  return dailyRows.map((row) => {
    const r3twValue = toNumber(row.R3TW.value);
    const mmtwValue = toNumber(row.MMTW.value);
    const r3twCross = previous !== null && previous.r3twValue <= 20 && r3twValue > 20;
    const mmtwCross = previous !== null && previous.mmtwValue <= 20 && mmtwValue > 20;
    const buySignal = r3twCross && mmtwCross;

    previous = {
      r3twValue,
      mmtwValue,
    };

    return {
      date: row.date,
      r3tw_value: normalizeNumber(r3twValue),
      mmtw_value: normalizeNumber(mmtwValue),
      r3tw_cross_up_20: r3twCross,
      mmtw_cross_up_20: mmtwCross,
      r3tw_mmtw_buy_signal: buySignal,
      r3tw_mmtw_signal: buySignal ? 'buy_both_cross_above_20' : 'none',
    };
  });
}
