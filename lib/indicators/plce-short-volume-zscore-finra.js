import { calculateRollingPopulationZscore, normalizeNumber, sortRowsByDate, toNumber } from './statistics.js';

function resolveSignal({
  plce_short_volume_buy_signal_50,
  plce_short_volume_buy_signal_20,
  plce_short_volume_extreme_signal,
}) {
  const signalCount = [
    plce_short_volume_buy_signal_50,
    plce_short_volume_buy_signal_20,
    plce_short_volume_extreme_signal,
  ].filter(Boolean).length;

  if (signalCount > 1) {
    return 'multiple_buy_signals';
  }

  if (plce_short_volume_buy_signal_50) {
    return 'buy_z50_gt_3';
  }

  if (plce_short_volume_buy_signal_20) {
    return 'buy_z20_gt_3';
  }

  if (plce_short_volume_extreme_signal) {
    return 'extreme_gt_3000000';
  }

  return 'none';
}

export function buildPlceShortVolumeIndicatorRows(rows) {
  const plceRows = sortRowsByDate(
    rows.filter((row) => !row.symbol || row.symbol === 'PLCE')
  );
  const shortVolumeHistory = [];

  return plceRows.map((row) => {
    const shortVolume = toNumber(row.short_volume);
    shortVolumeHistory.push(shortVolume);

    const plce_short_volume_zscore_50 = calculateRollingPopulationZscore(shortVolumeHistory, 50);
    const plce_short_volume_zscore_20 = calculateRollingPopulationZscore(shortVolumeHistory, 20);
    const plce_short_volume_price_condition = shortVolume > 1750000;
    const plce_short_volume_buy_signal_50 =
      plce_short_volume_zscore_50 !== null &&
      plce_short_volume_zscore_50 > 3 &&
      plce_short_volume_price_condition;
    const plce_short_volume_buy_signal_20 =
      plce_short_volume_zscore_20 !== null &&
      plce_short_volume_zscore_20 > 3 &&
      plce_short_volume_price_condition;
    const plce_short_volume_extreme_signal = shortVolume > 3000000;

    return {
      date: row.date,
      plce_short_volume: normalizeNumber(shortVolume),
      plce_short_exempt_volume: normalizeNumber(row.short_exempt_volume),
      plce_total_volume: normalizeNumber(row.total_volume),
      plce_short_volume_market: row.market ?? null,
      plce_short_volume_zscore_50,
      plce_short_volume_zscore_20,
      plce_short_volume_price_condition,
      plce_short_volume_buy_signal_50,
      plce_short_volume_buy_signal_20,
      plce_short_volume_extreme_signal,
      plce_short_volume_signal: resolveSignal({
        plce_short_volume_buy_signal_50,
        plce_short_volume_buy_signal_20,
        plce_short_volume_extreme_signal,
      }),
    };
  });
}
