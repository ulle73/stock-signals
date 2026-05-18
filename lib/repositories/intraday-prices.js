import { query } from '../db.js';
import { chunkArray } from '../utils/chunk.js';

const INTRADAY_PRICE_BATCH_SIZE = 100;
const DEFAULT_QUERY_CLIENT = { query };

export function buildStockIntraday60mPriceUpsertStatements(
  ticker,
  candles,
  batchSize = INTRADAY_PRICE_BATCH_SIZE
) {
  return chunkArray(candles, batchSize).map((batch) => {
    const params = [];
    const values = batch.map((candle, index) => {
      const base = index * 9;
      params.push(
        ticker,
        candle.candle_at,
        candle.session_date,
        candle.open,
        candle.high,
        candle.low,
        candle.close,
        candle.adj_close,
        candle.volume
      );

      return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7}, $${base + 8}, $${base + 9}, 'yahoo_60m', now())`;
    });

    return {
      sql: `insert into stock_intraday_prices_60m (
        ticker, candle_at, session_date, open, high, low, close, adj_close, volume, source, updated_at
      ) values ${values.join(', ')}
      on conflict (ticker, candle_at) do update set
        session_date = excluded.session_date,
        open = excluded.open,
        high = excluded.high,
        low = excluded.low,
        close = excluded.close,
        adj_close = excluded.adj_close,
        volume = excluded.volume,
        source = excluded.source,
        updated_at = now()`,
      params,
    };
  });
}

export async function upsertStockIntraday60mPrices(client, ticker, candles, batchSize = INTRADAY_PRICE_BATCH_SIZE) {
  if (!candles.length) return 0;

  const queryClient = client ?? DEFAULT_QUERY_CLIENT;
  const statements = buildStockIntraday60mPriceUpsertStatements(ticker, candles, batchSize);

  for (const statement of statements) {
    await queryClient.query(statement.sql, statement.params);
  }

  return candles.length;
}

export async function getIntraday60mBars(ticker, limit = null) {
  const params = [ticker];
  const limitClause = limit ? `limit $2` : '';

  if (limit) {
    params.push(limit);
  }

  const result = await query(
    `select
       ticker,
       candle_at::text as candle_at,
       session_date::text as session_date,
       open::text as open,
       high::text as high,
       low::text as low,
       close::text as close,
       adj_close::text as adj_close,
       volume::text as volume
     from stock_intraday_prices_60m
     where ticker = $1
     order by candle_at asc
     ${limitClause}`,
    params
  );

  return result.rows;
}
