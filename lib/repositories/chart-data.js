import { query } from '../db.js';
import {
  getChartStartDate,
  normalizeChartPeriod,
  normalizeChartTicker,
} from '../chart/chart-periods.js';
import { normalizeChartRows } from '../chart/normalize-chart-data.js';

const DEFAULT_MAX_ROWS = 1500;
const HARD_MAX_ROWS = 3000;

function normalizeMaxRows(value) {
  const requested = Number(value);
  if (!Number.isFinite(requested)) return DEFAULT_MAX_ROWS;
  return Math.max(50, Math.min(Math.trunc(requested), HARD_MAX_ROWS));
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
  const rowsResult = await query(
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
  );

  return normalizeChartRows({
    ticker: safeTicker,
    company,
    period: safePeriod,
    rows: rowsResult.rows,
  });
}
