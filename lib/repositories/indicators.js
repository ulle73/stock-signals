import { query } from '../db.js';
import { chunkArray } from '../utils/chunk.js';
import { formatIndicatorValueForStorage } from '../utils/rolling-indicators.js';

const INDICATOR_BATCH_SIZE = 100;
const INDICATOR_VALUE_FIELDS = [
  'indicator_price',
  'daily_return_pct',
  'avg_volume20',
  'relative_volume20',
  'pct_from_52w_high',
  'pct_from_52w_low',
  'sma5',
  'sma10',
  'sma20',
  'sma50',
  'sma200',
];

export function buildStockDailyIndicatorUpsertStatements(rows, batchSize = INDICATOR_BATCH_SIZE) {
  return chunkArray(rows, batchSize).map((batch) => {
    const params = [];
    const values = batch.map((row, index) => {
      const base = index * (INDICATOR_VALUE_FIELDS.length + 2);
      params.push(
        row.ticker,
        row.date,
        ...INDICATOR_VALUE_FIELDS.map((field) => formatIndicatorValueForStorage(row[field]))
      );

      return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7}, $${base + 8}, 'adj_close_or_close', $${base + 9}, $${base + 10}, $${base + 11}, $${base + 12}, $${base + 13}, now())`;
    });

    return {
      sql: `insert into stock_daily_indicators (
        ticker, date, indicator_price, daily_return_pct, avg_volume20, relative_volume20,
        pct_from_52w_high, pct_from_52w_low, price_basis, sma5, sma10, sma20, sma50, sma200, updated_at
      ) values ${values.join(', ')}
      on conflict (ticker, date) do update set
        indicator_price = excluded.indicator_price,
        daily_return_pct = excluded.daily_return_pct,
        avg_volume20 = excluded.avg_volume20,
        relative_volume20 = excluded.relative_volume20,
        pct_from_52w_high = excluded.pct_from_52w_high,
        pct_from_52w_low = excluded.pct_from_52w_low,
        price_basis = excluded.price_basis,
        sma5 = excluded.sma5,
        sma10 = excluded.sma10,
        sma20 = excluded.sma20,
        sma50 = excluded.sma50,
        sma200 = excluded.sma200,
        updated_at = now()`,
      params,
    };
  });
}

export async function getPriceHistoryForIndicators({ ticker = null, tickerLimit = null } = {}) {
  if (ticker) {
    const result = await query(
      `select ticker, date::text as date, close::text as close, adj_close::text as adj_close, volume::text as volume
       from stock_daily_prices
       where ticker = $1 and coalesce(adj_close, close) is not null
       order by date asc`,
      [ticker]
    );
    return result.rows;
  }

  if (tickerLimit) {
    const result = await query(
      `with selected_tickers as (
         select ticker
         from stock_daily_prices
         group by ticker
         order by ticker asc
         limit $1
       )
       select p.ticker, p.date::text as date, p.close::text as close, p.adj_close::text as adj_close, p.volume::text as volume
       from stock_daily_prices p
       inner join selected_tickers t on t.ticker = p.ticker
       where coalesce(p.adj_close, p.close) is not null
       order by p.ticker asc, p.date asc`,
      [tickerLimit]
    );
    return result.rows;
  }

  const result = await query(
    `select ticker, date::text as date, close::text as close, adj_close::text as adj_close, volume::text as volume
     from stock_daily_prices
     where coalesce(adj_close, close) is not null
     order by ticker asc, date asc`
  );

  return result.rows;
}

export async function upsertStockDailyIndicators(rows) {
  if (!rows.length) return 0;

  const statements = buildStockDailyIndicatorUpsertStatements(rows);

  for (const statement of statements) {
    await query(statement.sql, statement.params);
  }

  return rows.length;
}

export async function getLatestIndicatorDateForTicker(ticker) {
  const result = await query(
    `select max(date)::text as latest_date
     from stock_daily_indicators
     where ticker = $1`,
    [ticker]
  );

  return result.rows[0]?.latest_date ?? null;
}

export async function getStoredIndicatorRow(ticker, date) {
  const result = await query(
    `select
       ticker,
       date::text as date,
       indicator_price::text as indicator_price,
       daily_return_pct::text as daily_return_pct,
       avg_volume20::text as avg_volume20,
       relative_volume20::text as relative_volume20,
       pct_from_52w_high::text as pct_from_52w_high,
       pct_from_52w_low::text as pct_from_52w_low,
       price_basis,
       sma5::text as sma5,
       sma10::text as sma10,
       sma20::text as sma20,
       sma50::text as sma50,
       sma200::text as sma200
     from stock_daily_indicators
     where ticker = $1 and date = $2
     limit 1`,
    [ticker, date]
  );

  return result.rows[0] ?? null;
}

export async function getIndicatorValidationWindow(ticker, date, lookback = 200) {
  const result = await query(
    `with recent as (
       select ticker, date::text as date, close::text as close, adj_close::text as adj_close, volume::text as volume
       from stock_daily_prices
       where ticker = $1 and date <= $2 and coalesce(adj_close, close) is not null
       order by date desc
       limit $3
     )
     select *
     from recent
     order by date asc`,
    [ticker, date, lookback]
  );

  return result.rows;
}
