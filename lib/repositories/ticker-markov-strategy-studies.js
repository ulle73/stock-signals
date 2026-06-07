import { query } from '../db.js';
import { chunkArray } from '../utils/chunk.js';
import { formatIndicatorValueForStorage } from '../utils/rolling-indicators.js';

const DAILY_BATCH_SIZE = 100;
const DAILY_FIELDS = [
  'strategy_name',
  'date',
  'rebalance_date',
  'rebalance_frequency',
  'holding_days',
  'side',
  'ticker_count',
  'tickers',
  'gross_return',
  'spread_cost',
  'portfolio_return',
  'cumulative_return',
  'spy_return',
  'spy_cumulative_return',
  'spy_drawdown',
  'equal_weight_return',
  'equal_weight_cumulative_return',
  'equal_weight_drawdown',
  'excess_vs_spy',
  'excess_vs_equal_weight',
  'drawdown',
];
const SUMMARY_FIELDS = [
  'strategy_name',
  'rebalance_frequency',
  'holding_days',
  'side',
  'spread_bps',
  'start_date',
  'end_date',
  'trading_days',
  'total_return',
  'spy_total_return',
  'spy_max_drawdown',
  'equal_weight_total_return',
  'equal_weight_max_drawdown',
  'excess_vs_spy',
  'excess_vs_equal_weight',
  'max_drawdown',
  'return_over_max_drawdown',
  'excess_vs_spy_over_max_drawdown',
  'excess_vs_equal_weight_over_max_drawdown',
  'win_rate',
  'avg_daily_return',
  'volatility_daily',
  'avg_ticker_count',
];
const NUMERIC_FIELDS = new Set([
  'gross_return',
  'spread_cost',
  'portfolio_return',
  'cumulative_return',
  'spy_return',
  'spy_cumulative_return',
  'spy_drawdown',
  'equal_weight_return',
  'equal_weight_cumulative_return',
  'equal_weight_drawdown',
  'excess_vs_spy',
  'excess_vs_equal_weight',
  'drawdown',
  'spread_bps',
  'total_return',
  'spy_total_return',
  'spy_max_drawdown',
  'equal_weight_total_return',
  'equal_weight_max_drawdown',
  'max_drawdown',
  'return_over_max_drawdown',
  'excess_vs_spy_over_max_drawdown',
  'excess_vs_equal_weight_over_max_drawdown',
  'win_rate',
  'avg_daily_return',
  'volatility_daily',
  'avg_ticker_count',
]);

function formatFieldValue(row, field) {
  if (field === 'tickers') {
    return JSON.stringify(row[field] ?? []);
  }

  if (NUMERIC_FIELDS.has(field)) {
    return formatIndicatorValueForStorage(row[field]);
  }

  return row[field] ?? null;
}

function placeholders(base, fieldCount) {
  return `(${Array.from({ length: fieldCount }, (_, index) => `$${base + index + 1}`).join(', ')}, now())`;
}

export function buildTickerMarkovStrategyDailyUpsertStatements(rows, batchSize = DAILY_BATCH_SIZE) {
  return chunkArray(rows, batchSize).map((batch) => {
    const params = [];
    const values = batch.map((row, index) => {
      const base = index * DAILY_FIELDS.length;
      params.push(...DAILY_FIELDS.map((field) => formatFieldValue(row, field)));
      return placeholders(base, DAILY_FIELDS.length);
    });

    return {
      sql: `insert into ticker_markov_strategy_daily (
        ${DAILY_FIELDS.join(', ')}, updated_at
      ) values ${values.join(', ')}
      on conflict (strategy_name, date) do update set
        ${DAILY_FIELDS.filter((field) => !['strategy_name', 'date'].includes(field)).map((field) => `${field} = excluded.${field}`).join(',\n        ')},
        updated_at = now()`,
      params,
    };
  });
}

export function buildTickerMarkovStrategySummaryUpsertStatements(rows) {
  if (!rows.length) return [];

  const params = [];
  const values = rows.map((row, index) => {
    const base = index * SUMMARY_FIELDS.length;
    params.push(...SUMMARY_FIELDS.map((field) => formatFieldValue(row, field)));
    return placeholders(base, SUMMARY_FIELDS.length);
  });

  return [{
    sql: `insert into ticker_markov_strategy_summary (
      ${SUMMARY_FIELDS.join(', ')}, updated_at
    ) values ${values.join(', ')}
    on conflict (strategy_name) do update set
      ${SUMMARY_FIELDS.filter((field) => field !== 'strategy_name').map((field) => `${field} = excluded.${field}`).join(',\n      ')},
      updated_at = now()`,
    params,
  }];
}

export async function getTickerMarkovStudySourceRows() {
  const [priceResult, markovResult, tradingSignalResult, marketResult] = await Promise.all([
    query(
      `select ticker, date::text as date, open::text as open, close::text as close, adj_close::text as adj_close
       from stock_daily_prices
       where open is not null
       order by ticker asc, date asc`
    ),
    query(
      `select
         ticker,
         date::text as date,
         markov_total::text as markov_total,
         sample_size,
         signal,
         rank_bull,
         rank_sell
       from ticker_markov_daily
       order by date asc, ticker asc`
    ),
    query(
      `select date::text as date, setup, historical_edge_direction
       from trading_signal_daily
       order by date asc`
    ),
    query(
      `select date::text as date, spx_close::text as spx_close
       from market_signal_daily
       where spx_close is not null
       order by date asc`
    ),
  ]);

  return {
    priceRows: priceResult.rows,
    markovRows: markovResult.rows,
    tradingSignalRows: tradingSignalResult.rows,
    marketRows: marketResult.rows,
  };
}

export async function replaceTickerMarkovStrategyStudyRows({ dailyRows, summaries }) {
  await query('truncate table ticker_markov_strategy_daily');
  await query('truncate table ticker_markov_strategy_summary');

  for (const statement of buildTickerMarkovStrategyDailyUpsertStatements(dailyRows)) {
    await query(statement.sql, statement.params);
  }

  for (const statement of buildTickerMarkovStrategySummaryUpsertStatements(summaries)) {
    await query(statement.sql, statement.params);
  }

  return {
    dailyRows: dailyRows.length,
    summaries: summaries.length,
  };
}

export async function getTickerMarkovStrategySummaries() {
  const result = await query(
    `select
       strategy_name,
       rebalance_frequency,
       holding_days,
       side,
       spread_bps::text as spread_bps,
       start_date::text as start_date,
       end_date::text as end_date,
       trading_days,
       total_return::text as total_return,
       spy_total_return::text as spy_total_return,
       spy_max_drawdown::text as spy_max_drawdown,
       equal_weight_total_return::text as equal_weight_total_return,
       equal_weight_max_drawdown::text as equal_weight_max_drawdown,
       excess_vs_spy::text as excess_vs_spy,
       excess_vs_equal_weight::text as excess_vs_equal_weight,
       max_drawdown::text as max_drawdown,
       return_over_max_drawdown::text as return_over_max_drawdown,
       excess_vs_spy_over_max_drawdown::text as excess_vs_spy_over_max_drawdown,
       excess_vs_equal_weight_over_max_drawdown::text as excess_vs_equal_weight_over_max_drawdown,
       win_rate::text as win_rate,
       avg_daily_return::text as avg_daily_return,
       volatility_daily::text as volatility_daily,
       avg_ticker_count::text as avg_ticker_count
     from ticker_markov_strategy_summary
     order by return_over_max_drawdown desc nulls last`
  );

  return result.rows;
}

export async function getLatestTickerMarkovExecutionInputs({ strategyName } = {}) {
  const latestDateResult = await query(
    `select max(date)::text as signal_date
     from ticker_markov_daily`
  );
  const signalDate = latestDateResult.rows[0]?.signal_date ?? null;

  if (!signalDate) {
    return null;
  }

  const [markovResult, tradingSignalResult, priceResult, strategyDailyResult] = await Promise.all([
    query(
      `select
         ticker,
         date::text as date,
         markov_total::text as markov_total,
         sample_size,
         signal,
         rank_bull,
         rank_sell
       from ticker_markov_daily
       where date = $1
       order by ticker asc`,
      [signalDate]
    ),
    query(
      `select
         date::text as date,
         setup,
         historical_edge_direction
       from trading_signal_daily
       where date = $1
       limit 1`,
      [signalDate]
    ),
    query(
      `select
         ticker,
         date::text as date,
         close::text as close,
         adj_close::text as adj_close
       from stock_daily_prices
       where date = $1`,
      [signalDate]
    ),
    strategyName
      ? query(
        `select
           strategy_name,
           date::text as date,
           rebalance_date::text as rebalance_date,
           side,
           ticker_count,
           tickers
         from ticker_markov_strategy_daily
         where strategy_name = $1
           and date = $2
         limit 1`,
        [strategyName, signalDate]
      )
      : Promise.resolve({ rows: [] }),
  ]);

  return {
    signalDate,
    markovRows: markovResult.rows,
    tradingSignalRow: tradingSignalResult.rows[0] ?? null,
    priceRows: priceResult.rows,
    strategyDailyRow: strategyDailyResult.rows[0] ?? null,
  };
}
