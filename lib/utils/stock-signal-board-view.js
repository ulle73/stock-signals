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

function obvSignalPill(signal) {
  if (signal === 'buy') {
    return {
      key: 'ryd_obv_buy',
      label: 'RYD OBV buy',
      tone: 'positive',
    };
  }

  if (signal === 'sell') {
    return {
      key: 'ryd_obv_sell',
      label: 'RYD OBV sell',
      tone: 'danger',
    };
  }

  return null;
}

function volumeSignalPill(event, tone) {
  if (!event || event === 'normal') {
    return null;
  }

  return {
    key: `volume_${event}`,
    label: getVolumeEventLabel(event),
    tone: tone || 'neutral',
  };
}

function watchlistSignalPill(bias) {
  if (bias === 'long') {
    return {
      key: 'swing_watchlist_long',
      label: 'Swing watchlist long',
      tone: 'positive',
    };
  }

  if (bias === 'short') {
    return {
      key: 'swing_watchlist_short',
      label: 'Swing watchlist short',
      tone: 'danger',
    };
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
  const obv = obvSignalPill(row.latest_active_ryd_obv_signal);
  if (row.latest_active_indicator_date && obv) {
    return {
      date: row.latest_active_indicator_date,
      label: obv.label,
      tone: obv.tone,
      source: 'indicator',
    };
  }

  const volume = volumeSignalPill(
    row.latest_active_volume_event,
    row.latest_active_volume_event_tone
  );

  if (row.latest_active_indicator_date && volume) {
    return {
      date: row.latest_active_indicator_date,
      label: volume.label,
      tone: volume.tone,
      source: 'indicator',
    };
  }

  return null;
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

function signalRank(signal) {
  if (!signal.length) return 3;
  if (signal.some((item) => item.key.startsWith('ryd_obv_'))) return 0;
  if (signal.some((item) => item.key.startsWith('volume_'))) return 1;
  if (signal.some((item) => item.key.startsWith('swing_watchlist_'))) return 2;
  return 3;
}

function buildRowView(row) {
  const watchlist = currentWatchlist(row);
  const currentSignals = [
    obvSignalPill(row.ryd_obv_signal),
    volumeSignalPill(row.volume_event, row.volume_event_tone),
    watchlistSignalPill(watchlist?.bias),
  ].filter(Boolean);

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

export function buildStockSignalBoardViewModel(rows) {
  const normalizedRows = rows.map(buildRowView).sort(sortRows);

  return {
    summary: {
      totalTickers: normalizedRows.length,
      activeNowCount: normalizedRows.filter((row) => row.currentSignals.length > 0).length,
      obvActiveCount: normalizedRows.filter((row) => row.currentSignals.some((item) => item.key.startsWith('ryd_obv_'))).length,
      volumeActiveCount: normalizedRows.filter((row) => row.currentSignals.some((item) => item.key.startsWith('volume_'))).length,
      watchlistCount: normalizedRows.filter((row) => row.watchlist).length,
      latestIndicatorDate: rows.reduce((latest, row) => maxDate(latest, row.current_date), null),
      latestWatchlistDate: rows.reduce((latest, row) => maxDate(latest, row.board_watchlist_date), null),
    },
    rows: normalizedRows,
  };
}
