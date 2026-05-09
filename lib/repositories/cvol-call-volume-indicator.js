import { query } from '../db.js';
import { chunkArray } from '../utils/chunk.js';
import { formatIndicatorValueForStorage } from '../utils/rolling-indicators.js';

const CVOL_INDICATOR_BATCH_SIZE = 200;

export function buildCvolCallVolumeIndicatorUpsertStatements(rows, batchSize = CVOL_INDICATOR_BATCH_SIZE) {
  return chunkArray(rows, batchSize).map((batch) => {
    const params = [];
    const values = batch.map((row, index) => {
      const base = index * 14;
      params.push(
        row.date,
        formatIndicatorValueForStorage(row.cvol_calls),
        formatIndicatorValueForStorage(row.cvol_puts),
        formatIndicatorValueForStorage(row.cvol_ratio),
        formatIndicatorValueForStorage(row.cvol_total_volume),
        formatIndicatorValueForStorage(row.cvol_market_share),
        formatIndicatorValueForStorage(row.cvol_zscore_20),
        formatIndicatorValueForStorage(row.cvol_zscore_15),
        formatIndicatorValueForStorage(row.cvol_zscore_10),
        row.cvol_price_condition,
        row.cvol_sell_signal_1,
        row.cvol_sell_signal_2,
        row.cvol_sell_signal_3,
        row.cvol_signal
      );

      return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7}, $${base + 8}, $${base + 9}, $${base + 10}, $${base + 11}, $${base + 12}, $${base + 13}, $${base + 14}, now())`;
    });

    return {
      sql: `insert into cvol_call_volume_indicator_daily (
        date, cvol_calls, cvol_puts, cvol_ratio, cvol_total_volume, cvol_market_share,
        cvol_zscore_20, cvol_zscore_15, cvol_zscore_10, cvol_price_condition,
        cvol_sell_signal_1, cvol_sell_signal_2, cvol_sell_signal_3, cvol_signal, updated_at
      ) values ${values.join(', ')}
      on conflict (date) do update set
        cvol_calls = excluded.cvol_calls,
        cvol_puts = excluded.cvol_puts,
        cvol_ratio = excluded.cvol_ratio,
        cvol_total_volume = excluded.cvol_total_volume,
        cvol_market_share = excluded.cvol_market_share,
        cvol_zscore_20 = excluded.cvol_zscore_20,
        cvol_zscore_15 = excluded.cvol_zscore_15,
        cvol_zscore_10 = excluded.cvol_zscore_10,
        cvol_price_condition = excluded.cvol_price_condition,
        cvol_sell_signal_1 = excluded.cvol_sell_signal_1,
        cvol_sell_signal_2 = excluded.cvol_sell_signal_2,
        cvol_sell_signal_3 = excluded.cvol_sell_signal_3,
        cvol_signal = excluded.cvol_signal,
        updated_at = now()`,
      params,
    };
  });
}

export async function getCvolCallVolumeSourceRows() {
  const result = await query(
    `select
       report_date::text as report_date,
       exchange,
       calls::text as calls,
       puts::text as puts,
       ratio::text as ratio,
       volume::text as volume,
       market_share::text as market_share
     from occ_daily_volume_totals
     where exchange = 'Total'
     order by report_date asc`
  );

  return result.rows;
}

export async function upsertCvolCallVolumeIndicatorRows(rows) {
  if (!rows.length) {
    return 0;
  }

  const statements = buildCvolCallVolumeIndicatorUpsertStatements(rows);

  for (const statement of statements) {
    await query(statement.sql, statement.params);
  }

  return rows.length;
}
