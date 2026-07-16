import { query } from '../db.js';
import {
  getChartStartDate,
  normalizeChartPeriod,
  normalizeChartTicker,
} from '../chart/chart-periods.js';
import { normalizeChartRows } from '../chart/normalize-chart-data.js';
import { getYield2y10yChartRows } from './yield-2y-10y-indicator.js';

const DEFAULT_MAX_ROWS = 1500;
const HARD_MAX_ROWS = 3000;

function normalizeMaxRows(value) {
  const requested = Number(value);
  if (!Number.isFinite(requested)) return DEFAULT_MAX_ROWS;
  return Math.max(50, Math.min(Math.trunc(requested), HARD_MAX_ROWS));
}

async function getOptionalCvolRows({ startDate, latestDate }) {
  try {
    const result = await query(
      `select
         date::text as date,
         cvol_calls::text as cvol_calls,
         cvol_sell_signal_1,
         cvol_sell_signal_2,
         cvol_sell_signal_3,
         cvol_signal
       from cvol_call_volume_indicator_daily
       where ($1::date is null or date >= $1::date)
         and date <= $2::date
       order by date asc`,
      [startDate, latestDate]
    );
    return result.rows;
  } catch (error) {
    console.warn('Optional CVOL chart layer unavailable:', error?.message ?? error);
    return [];
  }
}

async function getOptionalYieldRows({ startDate, latestDate }) {
  try {
    return await getYield2y10yChartRows({ startDate, latestDate });
  } catch (error) {
    console.warn('Optional 2Y + 10Y chart layer unavailable:', error?.message ?? error);
    return [];
  }
}

export async function getChartData({ ticker, period = '1Y', maxRows = DEFAULT_MAX_ROWS }) {
  const safeTicker = normalizeChartTicker(ticker);
  if (!safeTicker) throw new Error('INVALID_TICKER');

  const safePeriod = normalizeChartPeriod(period);
  const safeMaxRows = normalizeMaxRows(maxRows);

  const [companyResult, latestResult] = await Promise.all([
    query(
      `select ticker, company_name, sector
       from sp500_constituents
       where ticker = $1 and is_active = true
       limit 1`,
      [safeTicker]
    ),
    query(
      `select max(date)::text as latest_date
       from stock_daily_prices
       where ticker = $1`,
      [safeTicker]
    ),
  ]);

  const company = companyResult.rows[0] ?? null;
  const latestDate = latestResult.rows[0]?.latest_date ?? null;
  if (!company || !latestDate) {
    return normalizeChartRows({ ticker: safeTicker, company, period: safePeriod, rows: [] });
  }

  const startDate = getChartStartDate(safePeriod, latestDate);
  const [rowsResult, cvolRows, yieldRows] = await Promise.all([
    query(
      `select *
       from (
         select
           p.date::text as date,
           p.open::text as open,
           p.high::text as high,
           p.low::text as low,
           p.close::text as close,
           p.adj_close::text as adj_close,
           p.volume::text as volume,
           i.sma5::text as sma5,
           i.sma10::text as sma10,
           i.sma20::text as sma20,
           i.sma50::text as sma50,
           i.sma200::text as sma200,
           i.ryd_obv::text as ryd_obv,
           i.ryd_obv_zscore_80::text as ryd_obv_zscore_80,
           i.ryd_obv_buy_signal as ryd_obv_buy_signal,
           i.ryd_obv_sell_signal as ryd_obv_sell_signal,
           i.ryd_obv_signal as ryd_obv_signal,
           i.tf_sync_buy_signal as tf_sync_buy_signal,
           i.tf_sync_sell_signal as tf_sync_sell_signal,
           i.tf_sync_buy_active as tf_sync_buy_active,
           i.tf_sync_sell_active as tf_sync_sell_active,
           i.tf_sync_signal as tf_sync_signal,
           i.plce_threshold_value::text as plce_threshold_value,
           i.plce_threshold_buy_signal as plce_threshold_buy_signal,
           i.plce_threshold_signal as plce_threshold_signal
         from stock_daily_prices p
         left join stock_daily_indicators i
           on i.ticker = p.ticker and i.date = p.date
         where p.ticker = $1
           and ($2::date is null or p.date >= $2::date)
         order by p.date desc
         limit $3
       ) chart_rows
       order by date asc`,
      [safeTicker, startDate, safeMaxRows]
    ),
    getOptionalCvolRows({ startDate, latestDate }),
    getOptionalYieldRows({ startDate, latestDate }),
  ]);

  const cvolByDate = new Map(cvolRows.map((row) => [row.date, row]));
  const yieldByDate = new Map(yieldRows.map((row) => [row.date, row]));
  const rows = rowsResult.rows.map((row) => ({
    ...row,
    ...(cvolByDate.get(row.date) ?? {}),
    ...(yieldByDate.get(row.date) ?? {}),
  }));

  return normalizeChartRows({ ticker: safeTicker, company, period: safePeriod, rows });
}
