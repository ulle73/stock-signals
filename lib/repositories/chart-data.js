import { query } from '../db.js';
import {
  getChartStartDate,
  normalizeChartPeriod,
  normalizeChartTicker,
} from '../chart/chart-periods.js';
import {
  buildBreadthContext,
  buildEarningsContext,
  buildRelativeStrengthContext,
  buildVolatilityContext,
  normalizeGexDexSnapshots,
} from '../chart/chart-context.js';
import { normalizeChartRows } from '../chart/normalize-chart-data.js';
import { getYield2y10yChartRows } from './yield-2y-10y-indicator.js';

const DEFAULT_MAX_ROWS = 1500;
const HARD_MAX_ROWS = 3000;

function normalizeMaxRows(value) {
  const requested = Number(value);
  if (!Number.isFinite(requested)) return DEFAULT_MAX_ROWS;
  return Math.max(50, Math.min(Math.trunc(requested), HARD_MAX_ROWS));
}

async function optionalRows(label, loader) {
  try {
    return await loader();
  } catch (error) {
    console.warn(`Optional ${label} chart layer unavailable:`, error?.message ?? error);
    return [];
  }
}

function getOptionalTfSyncRows({ ticker, startDate, latestDate }) {
  return optionalRows('TF Sync', async () => {
    const result = await query(
      `select
         date::text as date,
         tf_sync_buy_signal,
         tf_sync_sell_signal,
         tf_sync_buy_active,
         tf_sync_sell_active,
         tf_sync_signal
       from tf_sync_indicator_daily
       where ticker = $1
         and ($2::date is null or date >= $2::date)
         and date <= $3::date
       order by date asc`,
      [ticker, startDate, latestDate]
    );
    return result.rows;
  });
}

function getOptionalCvolRows({ startDate, latestDate }) {
  return optionalRows('CVOL', async () => {
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
  });
}

function getOptionalYieldRows({ startDate, latestDate }) {
  return optionalRows('2Y + 10Y', () => getYield2y10yChartRows({ startDate, latestDate }));
}

function getOptionalGexDexRows({ ticker, startDate }) {
  return optionalRows('GEX/DEX', async () => {
    const result = await query(
      `select
         source_timestamp::text as source_timestamp,
         source_status,
         data_quality,
         stale,
         call_wall::text as call_wall,
         put_wall::text as put_wall,
         gamma_flip::text as gamma_flip,
         net_gex::text as net_gex,
         net_dex::text as net_dex,
         dealer_positioning,
         market_regime,
         dex_resistance::text as dex_resistance,
         dex_support::text as dex_support,
         key_levels
       from gex_dex_source_snapshots
       where ticker = $1
         and ($2::date is null or source_timestamp::date >= $2::date)
         and source_timestamp <= now()
       order by source_timestamp asc`,
      [ticker, startDate]
    );
    return result.rows;
  });
}

function getOptionalRelativeStrengthRows(ticker) {
  return optionalRows('relative strength', async () => {
    const result = await query(
      `select
         date::text as date,
         rs_21d_vs_spy::text as rs_21d_vs_spy,
         rs_63d_vs_spy::text as rs_63d_vs_spy,
         rs_126d_vs_spy::text as rs_126d_vs_spy,
         rs_percentile_21d::text as rs_percentile_21d,
         rs_percentile_63d::text as rs_percentile_63d,
         rs_percentile_126d::text as rs_percentile_126d
       from stock_relative_strength_daily
       where ticker = $1
       order by date desc
       limit 6`,
      [ticker]
    );
    return result.rows;
  });
}

function getOptionalBreadthRows(sector) {
  if (!sector) return Promise.resolve({ sectorRows: [], marketRows: [] });
  return Promise.all([
    optionalRows('sector breadth', async () => {
      const result = await query(
        `select
           date::text as date,
           pct_above_sma20::text as pct_above_sma20,
           pct_above_sma50::text as pct_above_sma50,
           pct_above_sma200::text as pct_above_sma200,
           new_highs_52w,
           new_lows_52w
         from sector_breadth_daily
         where sector = $1 and is_valid_signal_date = true
         order by date desc
         limit 6`,
        [sector]
      );
      return result.rows;
    }),
    optionalRows('market breadth', async () => {
      const result = await query(
        `select
           date::text as date,
           pct_above_sma20::text as pct_above_sma20,
           pct_above_sma50::text as pct_above_sma50,
           pct_above_sma200::text as pct_above_sma200,
           new_highs_52w,
           new_lows_52w
         from market_breadth_daily
         where is_valid_signal_date = true
         order by date desc
         limit 6`
      );
      return result.rows;
    }),
  ]).then(([sectorRows, marketRows]) => ({ sectorRows, marketRows }));
}

function getOptionalVolatilityRows(ticker) {
  return optionalRows('stock volatility', async () => {
    const result = await query(
      `select *
       from (
         select
           date::text as date,
           open::text as open,
           high::text as high,
           low::text as low,
           close::text as close,
           adj_close::text as adj_close
         from stock_daily_prices
         where ticker = $1
         order by date desc
         limit 340
       ) volatility_rows
       order by date asc`,
      [ticker]
    );
    return result.rows;
  });
}

function getOptionalEarningsRows({ ticker, startDate, latestDate }) {
  return optionalRows('earnings', async () => {
    const result = await query(
      `select
         earnings_date::text as earnings_date,
         confirmed,
         source_status
       from stock_earnings_calendar_daily
       where ticker = $1
         and earnings_date is not null
         and ($2::date is null or earnings_date >= $2::date)
         and earnings_date <= $3::date + interval '180 days'
         and source_status <> 'error'
       order by earnings_date asc, date desc`,
      [ticker, startDate, latestDate]
    );
    return result.rows;
  });
}

function emptyContextPayload(payload) {
  return {
    ...payload,
    gexDexSnapshots: [],
    relativeStrengthContext: null,
    breadthContext: null,
    volatilityContext: null,
    earningsEvents: [],
    nextEarnings: null,
  };
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
    return emptyContextPayload(normalizeChartRows({ ticker: safeTicker, company, period: safePeriod, rows: [] }));
  }

  const startDate = getChartStartDate(safePeriod, latestDate);
  const [rowsResult, tfSyncRows, cvolRows, yieldRows, gexDexRows, relativeStrengthRows, breadthRows, volatilityRows, earningsRows] = await Promise.all([
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
    getOptionalTfSyncRows({ ticker: safeTicker, startDate, latestDate }),
    getOptionalCvolRows({ startDate, latestDate }),
    getOptionalYieldRows({ startDate, latestDate }),
    getOptionalGexDexRows({ ticker: safeTicker, startDate }),
    getOptionalRelativeStrengthRows(safeTicker),
    getOptionalBreadthRows(company.sector),
    getOptionalVolatilityRows(safeTicker),
    getOptionalEarningsRows({ ticker: safeTicker, startDate, latestDate }),
  ]);

  const tfSyncByDate = new Map(tfSyncRows.map((row) => [row.date, row]));
  const cvolByDate = new Map(cvolRows.map((row) => [row.date, row]));
  const yieldByDate = new Map(yieldRows.map((row) => [row.date, row]));
  const rows = rowsResult.rows.map((row) => ({
    ...row,
    ...(tfSyncByDate.get(row.date) ?? {}),
    ...(cvolByDate.get(row.date) ?? {}),
    ...(yieldByDate.get(row.date) ?? {}),
  }));

  const payload = normalizeChartRows({ ticker: safeTicker, company, period: safePeriod, rows });
  const earnings = buildEarningsContext(earningsRows, payload.bars.map((bar) => bar.time), payload.latestDate);

  return {
    ...payload,
    gexDexSnapshots: normalizeGexDexSnapshots(gexDexRows),
    relativeStrengthContext: buildRelativeStrengthContext(relativeStrengthRows),
    breadthContext: buildBreadthContext(breadthRows),
    volatilityContext: buildVolatilityContext(volatilityRows),
    earningsEvents: earnings.events,
    nextEarnings: earnings.nextEarnings,
  };
}
