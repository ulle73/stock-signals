import { calculateRollingPopulationZscore, normalizeNumber, sortRowsByDate, toNumber } from './statistics.js';

function resolveSignal({
  cvol_sell_signal_1,
  cvol_sell_signal_2,
  cvol_sell_signal_3,
}) {
  const signalCount = [cvol_sell_signal_1, cvol_sell_signal_2, cvol_sell_signal_3]
    .filter(Boolean)
    .length;

  if (signalCount > 1) {
    return 'multiple_sell_signals';
  }

  if (cvol_sell_signal_3) {
    return 'sell_z10_gt_3';
  }

  if (cvol_sell_signal_2) {
    return 'sell_z15_gt_2_5';
  }

  if (cvol_sell_signal_1) {
    return 'sell_z20_gt_1_5';
  }

  return 'none';
}

export function buildCvolCallVolumeIndicatorRows(rows) {
  const totalRows = sortRowsByDate(
    rows.filter((row) => !row.exchange || row.exchange === 'Total'),
    'report_date'
  );
  const callHistory = [];

  return totalRows.map((row) => {
    const currentCalls = toNumber(row.calls);
    callHistory.push(currentCalls);

    const cvol_zscore_20 = calculateRollingPopulationZscore(callHistory, 20);
    const cvol_zscore_15 = calculateRollingPopulationZscore(callHistory, 15);
    const cvol_zscore_10 = calculateRollingPopulationZscore(callHistory, 10);

    const previousCalls = callHistory.at(-2);
    const twoRowsAgoCalls = callHistory.at(-3);
    const cvol_price_condition =
      currentCalls > 30000000 &&
      toNumber(previousCalls) > 20000000 &&
      toNumber(twoRowsAgoCalls) > 10000000;

    const cvol_sell_signal_1 = cvol_zscore_20 !== null && cvol_zscore_20 > 1.5 && cvol_price_condition;
    const cvol_sell_signal_2 = cvol_zscore_15 !== null && cvol_zscore_15 > 2.5 && cvol_price_condition;
    const cvol_sell_signal_3 = cvol_zscore_10 !== null && cvol_zscore_10 > 3 && cvol_price_condition;

    return {
      date: row.report_date,
      cvol_calls: normalizeNumber(currentCalls),
      cvol_puts: normalizeNumber(row.puts),
      cvol_ratio: normalizeNumber(row.ratio),
      cvol_total_volume: normalizeNumber(row.volume),
      cvol_market_share: normalizeNumber(row.market_share),
      cvol_zscore_20,
      cvol_zscore_15,
      cvol_zscore_10,
      cvol_price_condition,
      cvol_sell_signal_1,
      cvol_sell_signal_2,
      cvol_sell_signal_3,
      cvol_signal: resolveSignal({
        cvol_sell_signal_1,
        cvol_sell_signal_2,
        cvol_sell_signal_3,
      }),
    };
  });
}
