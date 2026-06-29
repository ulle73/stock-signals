import { query } from '../db.js';
import { chunkArray } from '../utils/chunk.js';
import { formatIndicatorValueForStorage } from '../utils/rolling-indicators.js';

const DEFAULT_QUERY_CLIENT = { query };
const RELATIVE_STRENGTH_BATCH_SIZE = 200;

function buildSelectedTickerCte({ ticker = null, tickerLimit = null } = {}) {
  if (ticker) {
    return {
      sql: `selected_tickers as (
        select ticker
        from sp500_constituents
        where is_active = true and ticker = $1
      )`,
      params: [ticker],
    };
  }

  if (tickerLimit) {
    return {
      sql: `selected_tickers as (
        select ticker
        from sp500_constituents
        where is_active = true
        order by ticker asc
        limit $1
      )`,
      params: [tickerLimit],
    };
  }

  return {
    sql: `selected_tickers as (
      select ticker
      from sp500_constituents
      where is_active = true
    )`,
    params: [],
  };
}

export function buildRelativeStrengthUpsertStatements(rows, batchSize = RELATIVE_STRENGTH_BATCH_SIZE) {
  return chunkArray(rows, batchSize).map((batch) => {
    const params = [];
    const values = batch.map((row, index) => {
      const base = index * 12;
      params.push(
        row.ticker,
        row.date,
        row.benchmark_ticker ?? 'SPY',
        formatIndicatorValueForStorage(row.rs_21d_vs_spy),
        formatIndicatorValueForStorage(row.rs_63d_vs_spy),
        formatIndicatorValueForStorage(row.rs_126d_vs_spy),
        row.rs_rank_21d,
        row.rs_rank_63d,
        row.rs_rank_126d,
        formatIndicatorValueForStorage(row.rs_percentile_21d),
        formatIndicatorValueForStorage(row.rs_percentile_63d),
        formatIndicatorValueForStorage(row.rs_percentile_126d)
      );

      return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7}, $${base + 8}, $${base + 9}, $${base + 10}, $${base + 11}, $${base + 12}, now(), now())`;
    });

    return {
      sql: `insert into stock_relative_strength_daily (
        ticker, date, benchmark_ticker, rs_21d_vs_spy, rs_63d_vs_spy, rs_126d_vs_spy,
        rs_rank_21d, rs_rank_63d, rs_rank_126d,
        rs_percentile_21d, rs_percentile_63d, rs_percentile_126d,
        created_at, updated_at
      ) values ${values.join(', ')}
      on conflict (ticker, date) do update set
        benchmark_ticker = excluded.benchmark_ticker,
        rs_21d_vs_spy = excluded.rs_21d_vs_spy,
        rs_63d_vs_spy = excluded.rs_63d_vs_spy,
        rs_126d_vs_spy = excluded.rs_126d_vs_spy,
        rs_rank_21d = excluded.rs_rank_21d,
        rs_rank_63d = excluded.rs_rank_63d,
        rs_rank_126d = excluded.rs_rank_126d,
        rs_percentile_21d = excluded.rs_percentile_21d,
        rs_percentile_63d = excluded.rs_percentile_63d,
        rs_percentile_126d = excluded.rs_percentile_126d,
        updated_at = now()`,
      params,
    };
  });
}

export async function getRelativeStrengthSourceRows(
  {
    ticker = null,
    tickerLimit = null,
    benchmarkTicker = 'SPY',
  } = {},
  queryClient = DEFAULT_QUERY_CLIENT
) {
  const selectedTickers = buildSelectedTickerCte({ ticker, tickerLimit });

  const [priceResult, benchmarkResult] = await Promise.all([
    queryClient.query(
      `with ${selectedTickers.sql}
       select
         p.ticker,
         p.date::text as date,
         p.close::text as close,
         p.adj_close::text as adj_close
       from stock_daily_prices p
       inner join selected_tickers t on t.ticker = p.ticker
       where coalesce(p.adj_close, p.close) is not null
       order by p.ticker asc, p.date asc`,
      selectedTickers.params
    ),
    queryClient.query(
      `select
         ticker,
         date::text as date,
         close::text as close,
         adj_close::text as adj_close
       from benchmark_daily_prices
       where ticker = $1
         and coalesce(adj_close, close) is not null
       order by date asc`,
      [benchmarkTicker]
    ),
  ]);

  return {
    priceRows: priceResult.rows,
    benchmarkRows: benchmarkResult.rows,
  };
}

export async function upsertRelativeStrengthRows(rows, queryClient = DEFAULT_QUERY_CLIENT) {
  if (!rows.length) {
    return 0;
  }

  const statements = buildRelativeStrengthUpsertStatements(rows);
  for (const statement of statements) {
    await queryClient.query(statement.sql, statement.params);
  }

  return rows.length;
}

export async function getRelativeStrengthRows({ ticker = null, limit = 200 } = {}, queryClient = DEFAULT_QUERY_CLIENT) {
  const params = [];
  let whereClause = '';

  if (ticker) {
    params.push(ticker);
    whereClause = `where ticker = $1`;
  }

  params.push(limit);

  const result = await queryClient.query(
    `select
       ticker,
       date::text as date,
       benchmark_ticker,
       rs_21d_vs_spy::text as rs_21d_vs_spy,
       rs_63d_vs_spy::text as rs_63d_vs_spy,
       rs_126d_vs_spy::text as rs_126d_vs_spy,
       rs_rank_21d,
       rs_rank_63d,
       rs_rank_126d,
       rs_percentile_21d::text as rs_percentile_21d,
       rs_percentile_63d::text as rs_percentile_63d,
       rs_percentile_126d::text as rs_percentile_126d
     from stock_relative_strength_daily
     ${whereClause}
     order by date asc, ticker asc
     limit $${params.length}`,
    params
  );

  return result.rows;
}
