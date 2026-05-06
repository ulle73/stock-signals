import { query } from '../db.js';

export async function upsertMarketSeries(seriesId, rows) {
  if (!rows.length) return 0;

  let count = 0;

  for (const row of rows) {
    await query(
      `insert into market_series_daily (
        series_id, date, value, source, updated_at
      ) values ($1, $2, $3, 'fred', now())
      on conflict (series_id, date) do update set
        value = excluded.value,
        updated_at = now()`,
      [seriesId, row.date, row.value]
    );
    count += 1;
  }

  return count;
}
