const MOVING_AVERAGE_KEYS = Object.freeze(['sma5', 'sma10', 'sma20', 'sma50', 'sma200']);
const RYD_OBV_SIGNAL_VALUES = new Set(['buy', 'sell', 'none']);
const TF_SYNC_SIGNAL_VALUES = new Set(['buy', 'sell', 'buy_active', 'sell_active', 'none']);
const BUY_NONE_SIGNAL_VALUES = new Set(['buy', 'none']);
const CVOL_SIGNAL_VALUES = new Set(['none', 'sell_z20_gt_1_5', 'sell_z15_gt_2_5', 'sell_z10_gt_3', 'multiple_sell_signals']);
const YIELD_SIGNAL_VALUES = new Set(['none', 'buy', 'sell', 'inverted']);
const RYD_OBV_KEYS = Object.freeze(['ryd_obv', 'ryd_obv_zscore_80', 'ryd_obv_buy_signal', 'ryd_obv_sell_signal', 'ryd_obv_signal']);
const TF_SYNC_KEYS = Object.freeze(['tf_sync_buy_signal', 'tf_sync_sell_signal', 'tf_sync_buy_active', 'tf_sync_sell_active', 'tf_sync_signal']);
const PLCE_KEYS = Object.freeze(['plce_threshold_value', 'plce_threshold_buy_signal', 'plce_threshold_signal']);
const CVOL_KEYS = Object.freeze(['cvol_calls', 'cvol_sell_signal_1', 'cvol_sell_signal_2', 'cvol_sell_signal_3', 'cvol_signal']);
const YIELD_KEYS = Object.freeze(['yield_2y', 'yield_10y', 'yield_effr', 'yield_frr_2_10', 'yield_2y_10y_buy_signal', 'yield_2y_10y_sell_signal', 'yield_2y_10y_signal']);

function finiteNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function round(value, digits = 6) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function isValidDailyDate(value) {
  const match = String(value ?? '').match(/^(?<year>\d{4})-(?<month>\d{2})-(?<day>\d{2})$/);
  if (!match?.groups) return false;
  const year = Number(match.groups.year);
  const month = Number(match.groups.month);
  const day = Number(match.groups.day);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function adjustmentFactor(rawClose, adjustedClose) {
  if (rawClose === null || adjustedClose === null || rawClose === 0) return 1;
  const factor = adjustedClose / rawClose;
  return Number.isFinite(factor) && factor > 0 ? factor : 1;
}

function normalizedBoolean(value) {
  return value === true || value === 1 || value === '1' || value === 'true';
}

function normalizedSignal(value, allowedValues) {
  const signal = String(value ?? 'none').trim().toLowerCase();
  return allowedValues.has(signal) ? signal : 'none';
}

function normalizedBar(row) {
  if (!isValidDailyDate(row.date)) return null;
  const rawOpen = finiteNumber(row.open);
  const rawHigh = finiteNumber(row.high);
  const rawLow = finiteNumber(row.low);
  const rawClose = finiteNumber(row.close);
  const adjustedClose = finiteNumber(row.adj_close);
  if ([rawOpen, rawHigh, rawLow, rawClose].some((value) => value === null)) return null;

  const factor = adjustmentFactor(rawClose, adjustedClose);
  const bar = {
    time: String(row.date),
    open: round(rawOpen * factor),
    high: round(rawHigh * factor),
    low: round(rawLow * factor),
    close: round(adjustedClose ?? rawClose),
    volume: Math.max(0, finiteNumber(row.volume) ?? 0),
  };

  for (const key of MOVING_AVERAGE_KEYS) {
    const value = finiteNumber(row[key]);
    if (value !== null) bar[key] = round(value);
  }

  if (RYD_OBV_KEYS.some((key) => Object.hasOwn(row, key))) {
    const rawObv = finiteNumber(row.ryd_obv);
    const zscore = finiteNumber(row.ryd_obv_zscore_80);
    if (rawObv !== null) bar.ryd_obv = round(rawObv);
    if (zscore !== null) bar.ryd_obv_zscore_80 = round(zscore);
    bar.ryd_obv_buy_signal = normalizedBoolean(row.ryd_obv_buy_signal);
    bar.ryd_obv_sell_signal = normalizedBoolean(row.ryd_obv_sell_signal);
    bar.ryd_obv_signal = normalizedSignal(row.ryd_obv_signal, RYD_OBV_SIGNAL_VALUES);
  }

  if (TF_SYNC_KEYS.some((key) => Object.hasOwn(row, key))) {
    bar.tf_sync_buy_signal = normalizedBoolean(row.tf_sync_buy_signal);
    bar.tf_sync_sell_signal = normalizedBoolean(row.tf_sync_sell_signal);
    bar.tf_sync_buy_active = normalizedBoolean(row.tf_sync_buy_active);
    bar.tf_sync_sell_active = normalizedBoolean(row.tf_sync_sell_active);
    bar.tf_sync_signal = normalizedSignal(row.tf_sync_signal, TF_SYNC_SIGNAL_VALUES);
  }

  if (PLCE_KEYS.some((key) => Object.hasOwn(row, key))) {
    const value = finiteNumber(row.plce_threshold_value);
    if (value !== null) bar.plce_threshold_value = round(value);
    bar.plce_threshold_buy_signal = normalizedBoolean(row.plce_threshold_buy_signal);
    bar.plce_threshold_signal = normalizedSignal(row.plce_threshold_signal, BUY_NONE_SIGNAL_VALUES);
  }

  if (CVOL_KEYS.some((key) => Object.hasOwn(row, key))) {
    const calls = finiteNumber(row.cvol_calls);
    if (calls !== null) bar.cvol_calls = round(calls);
    bar.cvol_sell_signal_1 = normalizedBoolean(row.cvol_sell_signal_1);
    bar.cvol_sell_signal_2 = normalizedBoolean(row.cvol_sell_signal_2);
    bar.cvol_sell_signal_3 = normalizedBoolean(row.cvol_sell_signal_3);
    bar.cvol_signal = normalizedSignal(row.cvol_signal, CVOL_SIGNAL_VALUES);
  }

  if (YIELD_KEYS.some((key) => Object.hasOwn(row, key))) {
    for (const key of ['yield_2y', 'yield_10y', 'yield_effr', 'yield_frr_2_10']) {
      const value = finiteNumber(row[key]);
      if (value !== null) bar[key] = round(value);
    }
    bar.yield_2y_10y_buy_signal = normalizedBoolean(row.yield_2y_10y_buy_signal);
    bar.yield_2y_10y_sell_signal = normalizedBoolean(row.yield_2y_10y_sell_signal);
    bar.yield_2y_10y_signal = normalizedSignal(row.yield_2y_10y_signal, YIELD_SIGNAL_VALUES);
  }

  return bar;
}

export function normalizeChartRows({ ticker, company, period, rows = [] }) {
  const byDate = new Map();
  for (const row of rows) {
    const bar = normalizedBar(row);
    if (bar) byDate.set(bar.time, bar);
  }
  const bars = [...byDate.values()].sort((left, right) => left.time.localeCompare(right.time));
  const latest = bars.at(-1) ?? null;
  const previous = bars.at(-2) ?? null;
  const dailyChange = latest && previous ? round(latest.close - previous.close, 4) : null;
  const dailyChangePct = dailyChange !== null && previous.close !== 0 ? round((dailyChange / previous.close) * 100, 4) : null;
  return {
    ticker,
    companyName: company?.company_name ?? ticker,
    sector: company?.sector ?? null,
    currency: 'USD',
    period,
    latestDate: latest?.time ?? null,
    latestPrice: latest?.close ?? null,
    previousClose: previous?.close ?? null,
    dailyChange,
    dailyChangePct,
    bars,
  };
}
