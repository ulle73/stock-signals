import { query } from '../db.js';
import { chunkArray } from '../utils/chunk.js';

const PRICE_BATCH_SIZE = 100;

export function buildStockDailyPriceUpsertStatements(ticker, candles, batchSize = PRICE_BATCH_SIZE) {
  return chunkArray(candles, batchSize).map((batch) => {
    const params = [];
    const values = batch.map((candle, index) => {
      const base = index * 8;
      params.push(
        ticker,
        candle.date,
        candle.open,
        candle.high,
        candle.low,
        candle.close,
        candle.adj_close,
        candle.volume
      );

      return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7}, $${base + 8}, 'yahoo', now())`;
    });

    return {
      sql: `insert into stock_daily_prices (
        ticker, date, open, high, low, close, adj_close, volume, source, updated_at
      ) values ${values.join(', ')}
      on conflict (ticker, date) do update set
        open = excluded.open,
        high = excluded.high,
        low = excluded.low,
        close = excluded.close,
        adj_close = excluded.adj_close,
        volume = excluded.volume,
        updated_at = now()`,
      params,
    };
  });
}

export async function getLatestPriceDatesByTicker() {
  const result = await query(
    `select ticker, max(date)::text as latest_date
     from stock_daily_prices
     group by ticker`
  );

  return Object.fromEntries(
    result.rows.map((row) => [row.ticker, row.latest_date])
  );
}

export async function upsertStockDailyPrices(ticker, candles) {
  if (!candles.length) return 0;

  const statements = buildStockDailyPriceUpsertStatements(ticker, candles);

  for (const statement of statements) {
    await query(statement.sql, statement.params);
  }

  return candles.length;
}
