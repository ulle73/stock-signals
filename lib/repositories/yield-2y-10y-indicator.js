import { query } from '../db.js';
import { chunkArray } from '../utils/chunk.js';

const BATCH_SIZE = 250;
const SOURCE_SERIES = Object.freeze(['DGS2', 'DGS10', 'FEDFUNDS']);

function storageValue(value) {
  return value === null || value === undefined || !Number.isFinite(Number(value))
    ? null
    : Number(value);
}

export function buildYield2y10yUpsertStatements(rows, batchSize = BATCH_SIZE) {
  return chunkArray(rows, batchSize).map((batch) => {
    const params = [];
    const values = batch.map((row, index) => {
      const base = index * 14;
      params.push(
        row.date,
        storageValue(row.two_year),
        storageValue(row.ten_year),
        storageValue(row.effr),
        storageValue(row.smooth_effr_5),
        storageValue(row.prev_effr),
        storageValue(row.prev_smooth_effr_5),
        storageValue(row.frr_2_10),
        Boolean(row.is_long),
        Boolean(row.is_short),
        Boolean(row.is_inverted),
        Boolean(row.buy_signal),
        Boolean(row.sell_signal),
        row.signal ?? 'none'
      );
      return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7}, $${base + 8}, $${base + 9}, $${base + 10}, $${base + 11}, $${base + 12}, $${base + 13}, $${base + 14}, now())`;
    });

    return {
      sql: `insert into yield_2y_10y_indicator_daily (
        date, two_year, ten_year, effr, smooth_effr_5, prev_effr, prev_smooth_effr_5,
        frr_2_10, is_long, is_short, is_inverted, buy_signal, sell_signal, signal, updated_at
      ) values ${values.join(', ')}
      on conflict (date) do update set
        two_year = excluded.two_year,
        ten_year = excluded.ten_year,
        effr = excluded.effr,
        smooth_effr_5 = excluded.smooth_effr_5,
        prev_effr = excluded.prev_effr,
        prev_smooth_effr_5 = excluded.prev_smooth_effr_5,
        frr_2_10 = excluded.frr_2_10,
        is_long = excluded.is_long,
        is_short = excluded.is_short,
        is_inverted = excluded.is_inverted,
        buy_signal = excluded.buy_signal,
        sell_signal = excluded.sell_signal,
        signal = excluded.signal,
        updated_at = now()`,
      params,
    };
  });
}

export async function getYield2y10ySourceRows() {
  const result = await query(
    `select series_id, date::text as date, value::text as value
     from market_series_daily
     where series_id = any($1::text[])
     order by date asc, series_id asc`,
    [SOURCE_SERIES]
  );
  return result.rows;
}

export async function upsertYield2y10yIndicatorRows(rows) {
  if (!rows.length) return 0;
  for (const statement of buildYield2y10yUpsertStatements(rows)) {
    await query(statement.sql, statement.params);
  }
  return rows.length;
}

export async function getYield2y10yChartRows({ startDate, latestDate }) {
  const result = await query(
    `select
       date::text as date,
       two_year::text as yield_2y,
       ten_year::text as yield_10y,
       effr::text as yield_effr,
       frr_2_10::text as yield_frr_2_10,
       buy_signal as yield_2y_10y_buy_signal,
       sell_signal as yield_2y_10y_sell_signal,
       signal as yield_2y_10y_signal
     from yield_2y_10y_indicator_daily
     where ($1::date is null or date >= $1::date)
       and date <= $2::date
     order by date asc`,
    [startDate, latestDate]
  );
  return result.rows;
}
