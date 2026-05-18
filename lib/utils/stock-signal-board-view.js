import { getVolumeEventLabel } from './volume-events.js';

function toNumber(value, digits = 2) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const number = Number(value);
  if (!Number.isFinite(number)) {
    return null;
  }

  const factor = 10 ** digits;
  return Math.round(number * factor) / factor;
}

function signalLabel(value) {
  if (value === 'buy') return 'Buy';
  if (value === 'sell') return 'Sell';
  if (value === 'active') return 'Active';
  if (value === 'buy_active') return 'Buy active';
  if (value === 'sell_active') return 'Sell active';
  return 'Neutral';
}

function signalPill(key, label, tone) {
  return { key, label, tone };
}

function rydObvSignalPill(signal) {
  if (signal === 'buy') {
    return signalPill('ryd_obv_buy', 'RYD OBV buy', 'positive');
  }

  if (signal === 'sell') {
    return signalPill('ryd_obv_sell', 'RYD OBV sell', 'danger');
  }

  return null;
}

function volumeSignalPill(event, tone) {
  if (!event || event === 'normal') {
    return null;
  }

  return signalPill(`volume_${event}`, getVolumeEventLabel(event), tone || 'neutral');
}

function priceZscoreSignalPill(signal) {
  if (signal === 'buy') {
    return signalPill('price_zscore_buy', 'Price z-score buy', 'positive');
  }

  if (signal === 'sell') {
    return signalPill('price_zscore_sell', 'Price z-score sell', 'danger');
  }

  return null;
}

function ibsRsiSignalPill(signal) {
  if (signal === 'buy') {
    return signalPill('ibs_rsi_buy', 'IBS + RSI buy', 'positive');
  }

  return null;
}

function macdVSignalPill(signal) {
  if (signal === 'buy') {
    return signalPill('macd_v_buy', 'MACD-V buy', 'positive');
  }

  if (signal === 'sell') {
    return signalPill('macd_v_sell', 'MACD-V sell', 'danger');
  }

  if (signal === 'active') {
    return signalPill('macd_v_active', 'MACD-V active', 'positive');
  }

  return null;
}

function breakoutSignalPill(signal) {
  if (signal === 'buy') {
    return signalPill('breakout_20d_buy', '20d breakout buy', 'positive');
  }

  if (signal === 'sell') {
    return signalPill('breakout_20d_sell', '20d breakout sell', 'danger');
  }

  return null;
}

function plceThresholdSignalPill(signal) {
  if (signal === 'buy') {
    return signalPill('plce_threshold_buy', 'PLCE threshold buy', 'positive');
  }

  return null;
}

function tfSyncSignalPill(signal) {
  if (signal === 'buy') {
    return signalPill('tf_sync_buy', 'TF Sync buy', 'positive');
  }

  if (signal === 'sell') {
    return signalPill('tf_sync_sell', 'TF Sync sell', 'danger');
  }

  if (signal === 'buy_active') {
    return signalPill('tf_sync_buy_active', 'TF Sync buy active', 'positive');
  }

  if (signal === 'sell_active') {
    return signalPill('tf_sync_sell_active', 'TF Sync sell active', 'danger');
  }

  return null;
}

function watchlistSignalPill(bias) {
  if (bias === 'long') {
    return signalPill('swing_watchlist_long', 'Swing watchlist long', 'positive');
  }

  if (bias === 'short') {
    return signalPill('swing_watchlist_short', 'Swing watchlist short', 'danger');
  }

  return null;
}

function rankTone(tone) {
  if (tone === 'danger') return 0;
  if (tone === 'warning') return 1;
  if (tone === 'caution') return 2;
  if (tone === 'positive') return 3;
  return 4;
}

function currentIndicatorPills(row) {
  return [
    rydObvSignalPill(row.ryd_obv_signal),
    volumeSignalPill(row.volume_event, row.volume_event_tone),
    priceZscoreSignalPill(row.price_zscore_signal),
    ibsRsiSignalPill(row.ibs_rsi_signal),
    macdVSignalPill(row.macd_v_signal),
    breakoutSignalPill(row.breakout_20d_signal),
    tfSyncSignalPill(row.tf_sync_signal),
    plceThresholdSignalPill(row.plce_threshold_signal),
  ].filter(Boolean);
}

function latestIndicatorPills(row) {
  return [
    rydObvSignalPill(row.latest_active_ryd_obv_signal),
    priceZscoreSignalPill(row.latest_active_price_zscore_signal),
    ibsRsiSignalPill(row.latest_active_ibs_rsi_signal),
    macdVSignalPill(row.latest_active_macd_v_signal),
    breakoutSignalPill(row.latest_active_breakout_20d_signal),
    tfSyncSignalPill(row.latest_active_tf_sync_signal),
    plceThresholdSignalPill(row.latest_active_plce_threshold_signal),
    volumeSignalPill(
      row.latest_active_volume_event,
      row.latest_active_volume_event_tone
    ),
  ].filter(Boolean);
}

function indicatorPillRank(pill) {
  if (pill.key.startsWith('ryd_obv_')) return 0;
  if (pill.key.startsWith('price_zscore_')) return 1;
  if (pill.key.startsWith('ibs_rsi_')) return 2;
  if (pill.key.startsWith('macd_v_')) return 3;
  if (pill.key.startsWith('breakout_20d_')) return 4;
  if (pill.key.startsWith('tf_sync_')) return 5;
  if (pill.key.startsWith('plce_threshold_')) return 6;
  if (pill.key.startsWith('volume_')) return 7;
  if (pill.key.startsWith('swing_watchlist_')) return 8;
  return 9;
}

function sortSignalsForDisplay(signals) {
  return [...signals].sort((left, right) => indicatorPillRank(left) - indicatorPillRank(right));
}

function resolveCurrentSignalTone(signals) {
  if (!signals.length) {
    return 'neutral';
  }

  return [...signals]
    .sort((left, right) => rankTone(left.tone) - rankTone(right.tone))[0]
    .tone;
}

function currentWatchlist(row) {
  if (!row.latest_watchlist_date || !row.board_watchlist_date) {
    return null;
  }

  if (row.latest_watchlist_date !== row.board_watchlist_date) {
    return null;
  }

  return {
    date: row.latest_watchlist_date,
    bias: row.latest_watchlist_bias ?? null,
    setup: row.latest_watchlist_setup ?? null,
    decision: row.latest_watchlist_decision ?? null,
    score: toNumber(row.latest_watchlist_score, 1),
    isActionable: row.latest_watchlist_is_actionable ?? false,
  };
}

function latestIndicatorSignal(row) {
  const signals = [];
  const stockIndicatorPills = sortSignalsForDisplay([
    rydObvSignalPill(row.latest_active_ryd_obv_signal),
    priceZscoreSignalPill(row.latest_active_price_zscore_signal),
    ibsRsiSignalPill(row.latest_active_ibs_rsi_signal),
    macdVSignalPill(row.latest_active_macd_v_signal),
    breakoutSignalPill(row.latest_active_breakout_20d_signal),
    plceThresholdSignalPill(row.latest_active_plce_threshold_signal),
    volumeSignalPill(
      row.latest_active_volume_event,
      row.latest_active_volume_event_tone
    ),
  ].filter(Boolean));
  const tfSyncPill = tfSyncSignalPill(row.latest_active_tf_sync_signal);

  if (row.latest_active_indicator_date && stockIndicatorPills[0]) {
    signals.push({
      date: row.latest_active_indicator_date,
      pill: stockIndicatorPills[0],
    });
  }

  if (row.latest_active_tf_sync_date && tfSyncPill) {
    signals.push({
      date: row.latest_active_tf_sync_date,
      pill: tfSyncPill,
    });
  }

  if (!signals.length) {
    return null;
  }

  signals.sort((left, right) => {
    const dateDiff = compareDateDesc(left.date, right.date);
    if (dateDiff !== 0) {
      return dateDiff;
    }

    return indicatorPillRank(left.pill) - indicatorPillRank(right.pill);
  });

  return {
    date: signals[0].date,
    label: signals[0].pill.label,
    tone: signals[0].pill.tone,
    source: 'indicator',
  };
}

function latestWatchlistSignal(watchlist) {
  if (!watchlist?.date) {
    return null;
  }

  const pill = watchlistSignalPill(watchlist.bias);
  if (!pill) {
    return null;
  }

  return {
    date: watchlist.date,
    label: pill.label,
    tone: pill.tone,
    source: 'watchlist',
  };
}

function compareDateDesc(left, right) {
  if (!left && !right) return 0;
  if (!left) return 1;
  if (!right) return -1;
  return right.localeCompare(left);
}

function maxDate(left, right) {
  if (!left) return right ?? null;
  if (!right) return left;
  return left >= right ? left : right;
}

function latestSignalForRow(row, watchlist) {
  const indicatorSignal = latestIndicatorSignal(row);
  const watchlistSignal = latestWatchlistSignal(watchlist);

  if (!indicatorSignal && !watchlistSignal) {
    return {
      date: null,
      label: 'Ingen aktiv signal ännu',
      tone: 'neutral',
      source: 'none',
    };
  }

  if (!indicatorSignal) {
    return watchlistSignal;
  }

  if (!watchlistSignal) {
    return indicatorSignal;
  }

  return indicatorSignal.date >= watchlistSignal.date
    ? indicatorSignal
    : watchlistSignal;
}

function signalRank(signalList) {
  if (!signalList.length) return 3;
  return indicatorPillRank(signalList[0]);
}

function metric(label, value) {
  return { label, value };
}

function detailItem(key, label, signal, tone, metrics) {
  return {
    key,
    label,
    signalLabel: signalLabel(signal),
    tone,
    isActive: signal !== 'none' && signal !== 'normal' && signal !== null,
    metrics: metrics.filter((item) => item.value !== null && item.value !== undefined),
  };
}

function detailToneFromSignal(signal) {
  if (signal === 'sell' || signal === 'sell_active') return 'danger';
  if (signal === 'buy' || signal === 'active' || signal === 'buy_active') return 'positive';
  return 'neutral';
}

function volumeDetailItem(row) {
  return {
    key: 'volume',
    label: 'Volume event',
    signalLabel: row.volume_event && row.volume_event !== 'normal'
      ? getVolumeEventLabel(row.volume_event)
      : 'Normal',
    tone: row.volume_event && row.volume_event !== 'normal'
      ? row.volume_event_tone || 'neutral'
      : 'neutral',
    isActive: row.volume_event && row.volume_event !== 'normal',
    metrics: [
      metric('RVOL20', toNumber(row.relative_volume20)),
      metric('Vol z20', toNumber(row.volume_z20)),
    ].filter((item) => item.value !== null && item.value !== undefined),
  };
}

function watchlistDetailItem(watchlist) {
  const signal = watchlist?.bias === 'long'
    ? 'buy'
    : watchlist?.bias === 'short'
      ? 'sell'
      : 'none';

  return {
    key: 'watchlist',
    label: 'Watchlist',
    signalLabel: watchlist
      ? watchlist.bias === 'long'
        ? 'Long'
        : 'Short'
      : 'Inte med',
    tone: watchlist?.bias === 'long'
      ? 'positive'
      : watchlist?.bias === 'short'
        ? 'danger'
        : 'neutral',
    isActive: signal !== 'none',
    metrics: [
      metric('Setup', watchlist?.setup ?? null),
      metric('Beslut', watchlist?.decision ?? null),
      metric('Score', watchlist?.score ?? null),
    ].filter((item) => item.value !== null && item.value !== undefined),
  };
}

function buildIndicatorDetails(row, watchlist) {
  return [
    {
      key: 'ryd_obv',
      label: 'RYD OBV',
      signalLabel: signalLabel(row.ryd_obv_signal),
      tone: detailToneFromSignal(row.ryd_obv_signal),
      isActive: row.ryd_obv_signal !== 'none',
      metrics: [
        metric('OBV', toNumber(row.ryd_obv, 0)),
        metric('Z80', toNumber(row.ryd_obv_zscore_80)),
      ].filter((item) => item.value !== null && item.value !== undefined),
    },
    volumeDetailItem(row),
    detailItem(
      'price_zscore',
      'Price z-score',
      row.price_zscore_signal,
      detailToneFromSignal(row.price_zscore_signal),
      [
        metric('Z20', toNumber(row.price_zscore_20)),
        metric('Snitt 20', toNumber(row.price_zscore_avg_20)),
      ]
    ),
    detailItem(
      'ibs_rsi',
      'IBS + RSI',
      row.ibs_rsi_signal,
      detailToneFromSignal(row.ibs_rsi_signal),
      [
        metric('IBS', toNumber(row.ibs_value)),
        metric('RSI14', toNumber(row.rsi14)),
      ]
    ),
    detailItem(
      'macd_v',
      'MACD-V',
      row.macd_v_signal,
      detailToneFromSignal(row.macd_v_signal),
      [
        metric('MACD-V', toNumber(row.macd_v)),
        metric('State', row.macd_v_signal === 'none' ? 'Neutral' : signalLabel(row.macd_v_signal)),
      ]
    ),
    detailItem(
      'breakout_20d',
      '20d breakout',
      row.breakout_20d_signal,
      detailToneFromSignal(row.breakout_20d_signal),
      [
        metric('High 20', toNumber(row.breakout_20d_high)),
        metric('Low 20', toNumber(row.breakout_20d_low)),
      ]
    ),
    detailItem(
      'tf_sync',
      'TF Sync',
      row.tf_sync_signal,
      detailToneFromSignal(row.tf_sync_signal),
      [
        metric('Vecko-open', toNumber(row.tf_sync_weekly_open)),
        metric('Vecko-close', toNumber(row.tf_sync_weekly_close)),
        metric('1D', row.tf_sync_daily_green === null || row.tf_sync_daily_green === undefined ? null : row.tf_sync_daily_green ? 'Grön' : row.tf_sync_daily_red ? 'Röd' : 'Neutral'),
        metric('1W', row.tf_sync_weekly_green === null || row.tf_sync_weekly_green === undefined ? null : row.tf_sync_weekly_green ? 'Grön' : row.tf_sync_weekly_red ? 'Röd' : 'Neutral'),
        metric('60m', row.tf_sync_intraday_green === null || row.tf_sync_intraday_green === undefined ? null : row.tf_sync_intraday_green ? 'Grön' : row.tf_sync_intraday_red ? 'Röd' : 'Neutral'),
        metric('Senaste 60m', row.tf_sync_intraday_60m_candle_at ?? null),
      ]
    ),
    detailItem(
      'plce_threshold',
      'PLCE threshold',
      row.plce_threshold_signal,
      detailToneFromSignal(row.plce_threshold_signal),
      [
        metric('Threshold', toNumber(row.plce_threshold_value, 0)),
      ]
    ),
    watchlistDetailItem(watchlist),
  ];
}

function buildRowView(row) {
  const watchlist = currentWatchlist(row);
  const currentSignals = sortSignalsForDisplay([
    ...currentIndicatorPills(row),
    watchlistSignalPill(watchlist?.bias),
  ].filter(Boolean));
  const indicatorDetails = buildIndicatorDetails(row, watchlist);

  return {
    ticker: row.ticker,
    companyName: row.company_name ?? row.ticker,
    sector: row.sector ?? null,
    currentDate: row.current_date ?? null,
    currentPrice: toNumber(row.indicator_price),
    dailyReturnPct: toNumber(row.daily_return_pct),
    relativeVolume20: toNumber(row.relative_volume20),
    currentSignalTone: resolveCurrentSignalTone(currentSignals),
    currentSignals,
    activeIndicatorCount: currentIndicatorPills(row).length,
    indicatorDetails,
    latestSignal: latestSignalForRow(row, watchlist),
    watchlist,
  };
}

function sortRows(left, right) {
  const leftActive = left.currentSignals.length > 0;
  const rightActive = right.currentSignals.length > 0;

  if (leftActive !== rightActive) {
    return leftActive ? -1 : 1;
  }

  const rankDiff = signalRank(left.currentSignals) - signalRank(right.currentSignals);
  if (rankDiff !== 0) {
    return rankDiff;
  }

  const latestSignalDateDiff = compareDateDesc(left.latestSignal.date, right.latestSignal.date);
  if (latestSignalDateDiff !== 0) {
    return latestSignalDateDiff;
  }

  return left.ticker.localeCompare(right.ticker);
}

function buildSummary(normalizedRows, rawRows) {
  return {
    totalTickers: normalizedRows.length,
    activeNowCount: normalizedRows.filter((row) => row.currentSignals.length > 0).length,
    obvActiveCount: normalizedRows.filter((row) => row.currentSignals.some((item) => item.key.startsWith('ryd_obv_'))).length,
    volumeActiveCount: normalizedRows.filter((row) => row.currentSignals.some((item) => item.key.startsWith('volume_'))).length,
    priceZscoreActiveCount: normalizedRows.filter((row) => row.currentSignals.some((item) => item.key.startsWith('price_zscore_'))).length,
    ibsRsiActiveCount: normalizedRows.filter((row) => row.currentSignals.some((item) => item.key.startsWith('ibs_rsi_'))).length,
    macdVActiveCount: normalizedRows.filter((row) => row.currentSignals.some((item) => item.key.startsWith('macd_v_'))).length,
    breakoutActiveCount: normalizedRows.filter((row) => row.currentSignals.some((item) => item.key.startsWith('breakout_20d_'))).length,
    tfSyncActiveCount: normalizedRows.filter((row) => row.currentSignals.some((item) => item.key.startsWith('tf_sync_'))).length,
    plceActiveCount: normalizedRows.filter((row) => row.currentSignals.some((item) => item.key.startsWith('plce_threshold_'))).length,
    watchlistCount: normalizedRows.filter((row) => row.watchlist).length,
    latestIndicatorDate: rawRows.reduce((latest, row) => maxDate(latest, row.current_date), null),
    latestWatchlistDate: rawRows.reduce((latest, row) => maxDate(latest, row.board_watchlist_date), null),
  };
}

export function buildStockSignalBoardViewModel(rows, options = {}) {
  const normalizedRows = rows.map(buildRowView).sort(sortRows);
  const summary = options.summary ?? buildSummary(normalizedRows, rows);

  return {
    summary,
    pagination: options.pagination ?? null,
    rows: normalizedRows,
  };
}
