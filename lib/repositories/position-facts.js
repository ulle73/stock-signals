import { query } from '../db.js';
import { FRED_SERIES_IDS } from '../utils/fred-series.js';
import { chunkArray } from '../utils/chunk.js';
import { formatIndicatorValueForStorage } from '../utils/rolling-indicators.js';

const POSITION_FACT_BATCH_SIZE = 100;
const NUMERIC_FIELDS = [
  'sp500',
  'sp500_200dma',
  'sp500_pct_from_200dma',
  'vix',
  'high_yield_spread',
  'yield_curve_spread',
  'fed_funds',
  'fed_funds_change',
  'unemployment_rate',
  'unemployment_rate_change',
  'cpi_index',
  'cpi_yoy',
  'cpi_yoy_change',
  'consumer_sentiment',
  'consumer_sentiment_change',
];
const OBSERVATION_DATE_FIELDS = [
  'sp500_observation_date',
  'vix_observation_date',
  'high_yield_observation_date',
  'yield_curve_observation_date',
  'fed_funds_observation_date',
  'unemployment_observation_date',
  'cpi_observation_date',
  'consumer_sentiment_observation_date',
];
const REGIME_FIELDS = [
  'sp500_trend_regime',
  'vix_regime',
  'credit_regime',
  'yield_curve_regime',
  'fed_policy_trend',
  'labor_trend',
  'inflation_trend',
  'sentiment_trend',
];

export function buildPositionFactUpsertStatements(rows, batchSize = POSITION_FACT_BATCH_SIZE) {
  return chunkArray(rows, batchSize).map((batch) => {
    const params = [];
    const values = batch.map((row, index) => {
      const base = index * 33;
      params.push(
        row.date,
        ...NUMERIC_FIELDS.map((field) => formatIndicatorValueForStorage(row[field])),
        ...OBSERVATION_DATE_FIELDS.map((field) => row[field]),
        ...REGIME_FIELDS.map((field) => row[field]),
        row.yield_curve_inverted
      );

      return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7}, $${base + 8}, $${base + 9}, $${base + 10}, $${base + 11}, $${base + 12}, $${base + 13}, $${base + 14}, $${base + 15}, $${base + 16}, $${base + 17}, $${base + 18}, $${base + 19}, $${base + 20}, $${base + 21}, $${base + 22}, $${base + 23}, $${base + 24}, $${base + 25}, $${base + 26}, $${base + 27}, $${base + 28}, $${base + 29}, $${base + 30}, $${base + 31}, $${base + 32}, $${base + 33}, now())`;
    });

    return {
      sql: `insert into position_facts_daily (
        date, sp500, sp500_200dma, sp500_pct_from_200dma, vix, high_yield_spread, yield_curve_spread,
        fed_funds, fed_funds_change, unemployment_rate, unemployment_rate_change, cpi_index, cpi_yoy,
        cpi_yoy_change, consumer_sentiment, consumer_sentiment_change, sp500_observation_date,
        vix_observation_date, high_yield_observation_date, yield_curve_observation_date,
        fed_funds_observation_date, unemployment_observation_date, cpi_observation_date,
        consumer_sentiment_observation_date, sp500_trend_regime, vix_regime, credit_regime,
        yield_curve_regime, fed_policy_trend, labor_trend, inflation_trend, sentiment_trend,
        yield_curve_inverted, updated_at
      ) values ${values.join(', ')}
      on conflict (date) do update set
        sp500 = excluded.sp500,
        sp500_200dma = excluded.sp500_200dma,
        sp500_pct_from_200dma = excluded.sp500_pct_from_200dma,
        vix = excluded.vix,
        high_yield_spread = excluded.high_yield_spread,
        yield_curve_spread = excluded.yield_curve_spread,
        fed_funds = excluded.fed_funds,
        fed_funds_change = excluded.fed_funds_change,
        unemployment_rate = excluded.unemployment_rate,
        unemployment_rate_change = excluded.unemployment_rate_change,
        cpi_index = excluded.cpi_index,
        cpi_yoy = excluded.cpi_yoy,
        cpi_yoy_change = excluded.cpi_yoy_change,
        consumer_sentiment = excluded.consumer_sentiment,
        consumer_sentiment_change = excluded.consumer_sentiment_change,
        sp500_observation_date = excluded.sp500_observation_date,
        vix_observation_date = excluded.vix_observation_date,
        high_yield_observation_date = excluded.high_yield_observation_date,
        yield_curve_observation_date = excluded.yield_curve_observation_date,
        fed_funds_observation_date = excluded.fed_funds_observation_date,
        unemployment_observation_date = excluded.unemployment_observation_date,
        cpi_observation_date = excluded.cpi_observation_date,
        consumer_sentiment_observation_date = excluded.consumer_sentiment_observation_date,
        sp500_trend_regime = excluded.sp500_trend_regime,
        vix_regime = excluded.vix_regime,
        credit_regime = excluded.credit_regime,
        yield_curve_regime = excluded.yield_curve_regime,
        fed_policy_trend = excluded.fed_policy_trend,
        labor_trend = excluded.labor_trend,
        inflation_trend = excluded.inflation_trend,
        sentiment_trend = excluded.sentiment_trend,
        yield_curve_inverted = excluded.yield_curve_inverted,
        updated_at = now()`,
      params,
    };
  });
}

export async function getPositionFactSourceRows(ticker = 'SPY') {
  const [benchmarkResult, seriesResult] = await Promise.all([
    query(
      `select date::text as date
       from benchmark_daily_prices
       where ticker = $1
       order by date asc`,
      [ticker]
    ),
    query(
      `select series_id, date::text as date, value::text as value
       from market_series_daily
       where series_id = any($1::text[])
       order by series_id asc, date asc`,
      [FRED_SERIES_IDS]
    ),
  ]);

  return {
    benchmarkRows: benchmarkResult.rows,
    marketSeriesRows: seriesResult.rows,
  };
}

export async function upsertPositionFacts(rows) {
  if (!rows.length) {
    return 0;
  }

  const statements = buildPositionFactUpsertStatements(rows);

  for (const statement of statements) {
    await query(statement.sql, statement.params);
  }

  return rows.length;
}
