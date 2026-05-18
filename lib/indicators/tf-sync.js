import { normalizeNumber, sortRowsByDate, toNumber } from './statistics.js';

function startOfIsoWeek(dateString) {
  const date = new Date(`${dateString}T00:00:00.000Z`);
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() - (day - 1));
  return date.toISOString().slice(0, 10);
}

function isGreen(open, close) {
  return open !== null && close !== null && close > open;
}

function isRed(open, close) {
  return open !== null && close !== null && close < open;
}

function normalizeTextTimestamp(value) {
  return value || null;
}

function signalLabel({ buySignal, sellSignal, buyActive, sellActive }) {
  if (buySignal) return 'buy';
  if (sellSignal) return 'sell';
  if (buyActive) return 'buy_active';
  if (sellActive) return 'sell_active';
  return 'none';
}

function buildTickerRows(rows) {
  let currentWeekKey = null;
  let weeklyOpen = null;
  let buyActive = false;
  let sellActive = false;
  const output = [];

  for (const row of sortRowsByDate(rows)) {
    const weekKey = startOfIsoWeek(row.date);
    const dailyOpen = toNumber(row.daily_open);
    const dailyClose = toNumber(row.daily_close);
    const intradayOpen = toNumber(row.intraday_open);
    const intradayClose = toNumber(row.intraday_close);
    const hasIntraday = Boolean(row.intraday_60m_candle_at);

    if (weekKey !== currentWeekKey) {
      currentWeekKey = weekKey;
      weeklyOpen = dailyOpen;
    }

    const weeklyClose = dailyClose;
    const tf_sync_daily_green = isGreen(dailyOpen, dailyClose);
    const tf_sync_daily_red = isRed(dailyOpen, dailyClose);
    const tf_sync_weekly_green = isGreen(weeklyOpen, weeklyClose);
    const tf_sync_weekly_red = isRed(weeklyOpen, weeklyClose);
    const tf_sync_intraday_green = isGreen(intradayOpen, intradayClose);
    const tf_sync_intraday_red = isRed(intradayOpen, intradayClose);
    const tf_sync_buy_condition =
      tf_sync_daily_green && tf_sync_weekly_green && tf_sync_intraday_green;
    const tf_sync_sell_condition =
      tf_sync_daily_red && tf_sync_weekly_red && tf_sync_intraday_red;

    let tf_sync_buy_signal = false;
    let tf_sync_sell_signal = false;

    if (tf_sync_buy_condition && !buyActive) {
      tf_sync_buy_signal = true;
      buyActive = true;
      sellActive = false;
    } else if (tf_sync_sell_condition && !sellActive) {
      tf_sync_sell_signal = true;
      buyActive = false;
      sellActive = true;
    }

    if (!hasIntraday) {
      continue;
    }

    output.push({
      ticker: row.ticker,
      date: row.date,
      intraday_60m_candle_at: normalizeTextTimestamp(row.intraday_60m_candle_at),
      tf_sync_weekly_open: normalizeNumber(weeklyOpen),
      tf_sync_weekly_close: normalizeNumber(weeklyClose),
      tf_sync_daily_green,
      tf_sync_daily_red,
      tf_sync_weekly_green,
      tf_sync_weekly_red,
      tf_sync_intraday_green,
      tf_sync_intraday_red,
      tf_sync_buy_condition,
      tf_sync_sell_condition,
      tf_sync_buy_signal,
      tf_sync_sell_signal,
      tf_sync_buy_active: buyActive,
      tf_sync_sell_active: sellActive,
      tf_sync_signal: signalLabel({
        buySignal: tf_sync_buy_signal,
        sellSignal: tf_sync_sell_signal,
        buyActive,
        sellActive,
      }),
    });
  }

  return output;
}

export function buildTfSyncIndicatorRows(rows) {
  const grouped = new Map();

  for (const row of rows) {
    const bucket = grouped.get(row.ticker) ?? [];
    bucket.push(row);
    grouped.set(row.ticker, bucket);
  }

  const output = [];
  for (const tickerRows of grouped.values()) {
    output.push(...buildTickerRows(tickerRows));
  }

  return output;
}
