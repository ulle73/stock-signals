import { query } from '../db.js';

export async function getLatestFetchRun(jobName = 'fetch_daily') {
  const result = await query(
    `select id, status, started_at, finished_at, total_items, successful_items, failed_items, error_message
     from data_fetch_runs
     where job_name = $1
     order by started_at desc
     limit 1`,
    [jobName]
  );

  return result.rows[0] ?? null;
}

export async function getCoverageSummary() {
  const result = await query(
    `select
        (select count(*)::int from sp500_constituents where is_active = true) as active_ticker_count,
        (select count(distinct ticker)::int from stock_daily_prices) as priced_ticker_count,
        (select count(*)::int from stock_daily_prices) as total_price_rows,
        (select min(date)::text from stock_daily_prices) as earliest_price_date,
        (select max(date)::text from stock_daily_prices) as latest_price_date`
  );

  return result.rows[0];
}

export async function getLatestMarketSeriesRows(seriesIds = ['SP500', 'VIXCLS', 'BAMLH0A0HYM2']) {
  const result = await query(
    `with ranked as (
       select
         series_id,
         date::text as date,
         value::text as value,
         row_number() over (partition by series_id order by date desc) as row_number
       from market_series_daily
       where series_id = any($1::text[])
     )
     select series_id, date, value
     from ranked
     where row_number = 1`,
    [seriesIds]
  );

  return result.rows;
}

export async function getTickerSnapshot(ticker, priceLimit = 12) {
  const [companyResult, statsResult, pricesResult] = await Promise.all([
    query(
      `select ticker, yahoo_ticker, company_name, sector, industry
       from sp500_constituents
       where ticker = $1
       limit 1`,
      [ticker]
    ),
    query(
      `select count(*)::int as row_count, min(date)::text as first_date, max(date)::text as latest_date
       from stock_daily_prices
       where ticker = $1`,
      [ticker]
    ),
    query(
      `select
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
         i.sma200::text as sma200
       from stock_daily_prices p
       left join stock_daily_indicators i
         on i.ticker = p.ticker and i.date = p.date
       where p.ticker = $1
       order by p.date desc
       limit $2`,
      [ticker, priceLimit]
    ),
  ]);

  return {
    company: companyResult.rows[0] ?? null,
    stats: statsResult.rows[0] ?? {
      row_count: 0,
      first_date: null,
      latest_date: null,
    },
    prices: pricesResult.rows,
  };
}

export async function getDashboardSnapshot(ticker) {
  const [latestRun, coverage, marketSeries, tickerSnapshot] = await Promise.all([
    getLatestFetchRun(),
    getCoverageSummary(),
    getLatestMarketSeriesRows(),
    getTickerSnapshot(ticker),
  ]);

  return {
    latestRun,
    coverage,
    marketSeries,
    tickerSnapshot,
  };
}
