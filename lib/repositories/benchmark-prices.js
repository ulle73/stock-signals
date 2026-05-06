import { query } from '../db.js';
import { chunkArray } from '../utils/chunk.js';

const BENCHMARK_PRICE_BATCH_SIZE = 100;
const DEFAULT_QUERY_CLIENT = { query };

export function buildBenchmarkPriceUpsertStatements(rows, options = {}) {
  const { batchSize = BENCHMARK_PRICE_BATCH_SIZE } = options;

  return chunkArray(rows, batchSize).map((batch) => {
    const params = [];
    const values = batch.map((row, index) => {
      const base = index * 8;
      params.push(
        row.ticker,
        row.date,
        row.open,
        row.high,
        row.low,
        row.close,
        row.adj_close,
        row.volume
      );

      return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7}, $${base + 8}, 'yahoo', now())`;
    });

    return {
      sql: `insert into benchmark_daily_prices (
        ticker, date, open, high, low, close, adj_close, volume, source, updated_at
      ) values ${values.join(', ')}
      on conflict (ticker, date) do update set
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

export async function getLatestBenchmarkDates() {
  const result = await query(
    `select ticker, max(date)::text as latest_date
     from benchmark_daily_prices
     group by ticker`
  );

  return Object.fromEntries(
    result.rows.map((row) => [row.ticker, row.latest_date])
  );
}

export async function upsertBenchmarkDailyPrices(client, rows, options = {}) {
  if (!rows.length) return 0;

  const queryClient = client ?? DEFAULT_QUERY_CLIENT;
  const statements = buildBenchmarkPriceUpsertStatements(rows, options);

  for (const statement of statements) {
    await queryClient.query(statement.sql, statement.params);
  }

  return rows.length;
}
