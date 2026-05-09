import { query } from '../db.js';
import { chunkArray } from '../utils/chunk.js';
import { formatIndicatorValueForStorage } from '../utils/rolling-indicators.js';

const R3TW_MMTW_BATCH_SIZE = 200;

export function buildR3twMmtw20dmaBreadthIndicatorUpsertStatements(rows, batchSize = R3TW_MMTW_BATCH_SIZE) {
  return chunkArray(rows, batchSize).map((batch) => {
    const params = [];
    const values = batch.map((row, index) => {
      const base = index * 7;
      params.push(
        row.date,
        formatIndicatorValueForStorage(row.r3tw_value),
        formatIndicatorValueForStorage(row.mmtw_value),
        row.r3tw_cross_up_20,
        row.mmtw_cross_up_20,
        row.r3tw_mmtw_buy_signal,
        row.r3tw_mmtw_signal
      );

      return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7}, now())`;
    });

    return {
      sql: `insert into r3tw_mmtw_20dma_breadth_indicator_daily (
        date, r3tw_value, mmtw_value, r3tw_cross_up_20, mmtw_cross_up_20,
        r3tw_mmtw_buy_signal, r3tw_mmtw_signal, updated_at
      ) values ${values.join(', ')}
      on conflict (date) do update set
        r3tw_value = excluded.r3tw_value,
        mmtw_value = excluded.mmtw_value,
        r3tw_cross_up_20 = excluded.r3tw_cross_up_20,
        mmtw_cross_up_20 = excluded.mmtw_cross_up_20,
        r3tw_mmtw_buy_signal = excluded.r3tw_mmtw_buy_signal,
        r3tw_mmtw_signal = excluded.r3tw_mmtw_signal,
        updated_at = now()`,
      params,
    };
  });
}

export async function getR3twMmtwBreadthSourceRows() {
  const result = await query(
    `select
       date::text as date,
       series_key,
       value::text as value
     from external_breadth_daily
     where series_key in ('R3TW', 'MMTW')
     order by date asc, series_key asc`
  );

  return result.rows;
}

export async function upsertR3twMmtw20dmaBreadthIndicatorRows(rows) {
  if (!rows.length) {
    return 0;
  }

  const statements = buildR3twMmtw20dmaBreadthIndicatorUpsertStatements(rows);

  for (const statement of statements) {
    await query(statement.sql, statement.params);
  }

  return rows.length;
}
