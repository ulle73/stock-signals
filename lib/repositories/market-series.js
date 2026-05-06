import { query } from '../db.js';
import { chunkArray } from '../utils/chunk.js';

const MARKET_SERIES_BATCH_SIZE = 500;

export function buildMarketSeriesUpsertStatements(seriesId, rows, batchSize = MARKET_SERIES_BATCH_SIZE) {
  return chunkArray(rows, batchSize).map((batch) => {
    const params = [];
    const values = batch.map((row, index) => {
      const base = index * 3;
      params.push(seriesId, row.date, row.value);
      return `($${base + 1}, $${base + 2}, $${base + 3}, 'fred', now())`;
    });

    return {
      sql: `insert into market_series_daily (
        series_id, date, value, source, updated_at
      ) values ${values.join(', ')}
      on conflict (series_id, date) do update set
        value = excluded.value,
        updated_at = now()`,
      params,
    };
  });
}

export async function getLatestMarketSeriesDates() {
  const result = await query(
    `select series_id, max(date)::text as latest_date
     from market_series_daily
     group by series_id`
  );

  return Object.fromEntries(
    result.rows.map((row) => [row.series_id, row.latest_date])
  );
}

export async function upsertMarketSeries(seriesId, rows) {
  if (!rows.length) return 0;

  const statements = buildMarketSeriesUpsertStatements(seriesId, rows);

  for (const statement of statements) {
    await query(statement.sql, statement.params);
  }

  return rows.length;
}
