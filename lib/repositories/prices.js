import { query } from '../db.js';

export async function upsertStockDailyPrices(ticker, candles) {
  if (!candles.length) return 0;

  let count = 0;

  for (const candle of candles) {
    await query(
      `insert into stock_daily_prices (
        ticker, date, open, high, low, close, adj_close, volume, source, updated_at
      ) values ($1, $2, $3, $4, $5, $6, $7, $8, 'yahoo', now())
      on conflict (ticker, date) do update set
        open = excluded.open,
        high = excluded.high,
        low = excluded.low,
        close = excluded.close,
        adj_close = excluded.adj_close,
        volume = excluded.volume,
        updated_at = now()`,
      [
        ticker,
        candle.date,
        candle.open,
        candle.high,
        candle.low,
        candle.close,
        candle.adj_close,
        candle.volume,
      ]
    );
    count += 1;
  }

  return count;
}
