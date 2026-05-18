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
         i.sma200::text as sma200,
         i.relative_volume20::text as relative_volume20,
         i.volume_z20::text as volume_z20,
         i.trend_20d_pct::text as trend_20d_pct,
         i.range_pct::text as range_pct,
         i.body_pct::text as body_pct,
         i.volume_event,
         i.volume_event_tone
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

const SIGNAL_SELECT = `
  date::text as date,
  spx_close::text as spx_close,
  spx_3d_change::text as spx_3d_change,
  spx_14d_change::text as spx_14d_change,
  pct_above_50::text as pct_above_50,
  pct_above_50_3d_change::text as pct_above_50_3d_change,
  pct_above_50_14d_change::text as pct_above_50_14d_change,
  pct_above_200::text as pct_above_200,
  pct_above_200_14d_change::text as pct_above_200_14d_change,
  ad_line::text as ad_line,
  ad_line_14d_change::text as ad_line_14d_change,
  new_highs,
  new_lows,
  vix::text as vix,
  market_regime_score::text as market_regime_score,
  signal,
  divergence_status,
  short_divergence_status
`;

export async function getLatestMarketSignalSnapshot() {
  const result = await query(
    `select ${SIGNAL_SELECT}
     from market_signal_daily
     order by date desc
     limit 1`
  );

  return result.rows[0] ?? null;
}

export async function getRecentMarketSignalSnapshots(limit = 10) {
  const result = await query(
    `select ${SIGNAL_SELECT}
     from market_signal_daily
     order by date desc
     limit $1`,
    [limit]
  );

  return result.rows;
}

export async function getLatestBacktestSummaries(limit = 8) {
  const result = await query(
    `with ranked as (
       select
         br.id,
         br.strategy_id,
         br.status,
         br.cagr::text as cagr,
         br.max_drawdown::text as max_drawdown,
         br.time_in_market_pct::text as time_in_market_pct,
         br.finished_at,
         sd.code,
         sd.name,
         row_number() over (partition by br.strategy_id order by br.started_at desc) as row_number
       from backtest_runs br
       join strategy_definitions sd
         on sd.id = br.strategy_id
       where br.status = 'success'
     )
     select
       id,
       strategy_id,
       status,
       cagr,
       max_drawdown,
       time_in_market_pct,
       finished_at,
       code,
       name
     from ranked
     where row_number = 1
     order by finished_at desc, code asc
     limit $1`,
    [limit]
  );

  return result.rows;
}

const POSITION_STATUS_SELECT = `
  ps.date::text as date,
  ps.signal,
  ps.decision,
  ps.target_equity_weight_pct::text as target_equity_weight_pct,
  ps.raw_signal,
  ps.raw_decision,
  ps.raw_target_equity_weight_pct::text as raw_target_equity_weight_pct,
  ps.market_signal,
  ps.market_regime_score::text as market_regime_score,
  ps.caution_count,
  ps.hard_risk_off_count,
  ps.reason_summary,
  ps.persistence_direction,
  ps.persistence_streak_days,
  ps.persistence_required_days,
  pf.sp500_trend_regime,
  pf.vix_regime,
  pf.credit_regime,
  pf.yield_curve_regime,
  pf.fed_policy_trend,
  pf.labor_trend,
  pf.inflation_trend,
  pf.sentiment_trend
`;

export async function getLatestPositionStatusSnapshot() {
  const [currentResult, previousResult, latestChangeResult] = await Promise.all([
    query(
      `select ${POSITION_STATUS_SELECT}
       from position_signal_daily ps
       join position_facts_daily pf
         on pf.date = ps.date
       order by ps.date desc
       limit 1`
    ),
    query(
      `select
         date::text as date,
         target_equity_weight_pct::text as target_equity_weight_pct
       from position_signal_daily
       order by date desc
       offset 1
       limit 1`
    ),
    query(
      `with changes as (
         select
           date::text as date,
           lag(target_equity_weight_pct) over (order by date)::text as previous_equity_weight_pct,
           target_equity_weight_pct::text as new_equity_weight_pct,
           decision
         from position_signal_daily
       )
       select
         date,
         previous_equity_weight_pct,
         new_equity_weight_pct,
         decision
       from changes
       where previous_equity_weight_pct is not null
         and previous_equity_weight_pct is distinct from new_equity_weight_pct
       order by date desc
       limit 1`
    ),
  ]);

  return {
    current: currentResult.rows[0] ?? null,
    previous: previousResult.rows[0] ?? null,
    latestChange: latestChangeResult.rows[0] ?? null,
  };
}

export async function getDashboardSnapshot(ticker) {
  const [latestRun, coverage, marketSeries, tickerSnapshot, latestSignal, recentSignals, backtests, positionStatus] = await Promise.all([
    getLatestFetchRun(),
    getCoverageSummary(),
    getLatestMarketSeriesRows(),
    getTickerSnapshot(ticker),
    getLatestMarketSignalSnapshot(),
    getRecentMarketSignalSnapshots(10),
    getLatestBacktestSummaries(),
    getLatestPositionStatusSnapshot(),
  ]);

  return {
    latestRun,
    coverage,
    marketSeries,
    tickerSnapshot,
    latestSignal,
    recentSignals,
    backtests,
    positionStatus,
  };
}
