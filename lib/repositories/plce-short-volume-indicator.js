import { query } from '../db.js';
import { chunkArray } from '../utils/chunk.js';
import { formatIndicatorValueForStorage } from '../utils/rolling-indicators.js';

const PLCE_SHORT_VOLUME_INDICATOR_BATCH_SIZE = 200;

export function buildPlceShortVolumeIndicatorUpsertStatements(rows, batchSize = PLCE_SHORT_VOLUME_INDICATOR_BATCH_SIZE) {
  return chunkArray(rows, batchSize).map((batch) => {
    const params = [];
    const values = batch.map((row, index) => {
      const base = index * 12;
      params.push(
        row.date,
        formatIndicatorValueForStorage(row.plce_short_volume),
        formatIndicatorValueForStorage(row.plce_short_exempt_volume),
        formatIndicatorValueForStorage(row.plce_total_volume),
        row.plce_short_volume_market,
        formatIndicatorValueForStorage(row.plce_short_volume_zscore_50),
        formatIndicatorValueForStorage(row.plce_short_volume_zscore_20),
        row.plce_short_volume_price_condition,
        row.plce_short_volume_buy_signal_50,
        row.plce_short_volume_buy_signal_20,
        row.plce_short_volume_extreme_signal,
        row.plce_short_volume_signal
      );

      return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7}, $${base + 8}, $${base + 9}, $${base + 10}, $${base + 11}, $${base + 12}, now())`;
    });

    return {
      sql: `insert into plce_short_volume_indicator_daily (
        date, plce_short_volume, plce_short_exempt_volume, plce_total_volume,
        plce_short_volume_market, plce_short_volume_zscore_50, plce_short_volume_zscore_20,
        plce_short_volume_price_condition, plce_short_volume_buy_signal_50,
        plce_short_volume_buy_signal_20, plce_short_volume_extreme_signal,
        plce_short_volume_signal, updated_at
      ) values ${values.join(', ')}
      on conflict (date) do update set
        plce_short_volume = excluded.plce_short_volume,
        plce_short_exempt_volume = excluded.plce_short_exempt_volume,
        plce_total_volume = excluded.plce_total_volume,
        plce_short_volume_market = excluded.plce_short_volume_market,
        plce_short_volume_zscore_50 = excluded.plce_short_volume_zscore_50,
        plce_short_volume_zscore_20 = excluded.plce_short_volume_zscore_20,
        plce_short_volume_price_condition = excluded.plce_short_volume_price_condition,
        plce_short_volume_buy_signal_50 = excluded.plce_short_volume_buy_signal_50,
        plce_short_volume_buy_signal_20 = excluded.plce_short_volume_buy_signal_20,
        plce_short_volume_extreme_signal = excluded.plce_short_volume_extreme_signal,
        plce_short_volume_signal = excluded.plce_short_volume_signal,
        updated_at = now()`,
      params,
    };
  });
}

export async function getPlceShortVolumeSourceRows() {
  const result = await query(
    `select
       date::text as date,
       symbol,
       short_volume::text as short_volume,
       short_exempt_volume::text as short_exempt_volume,
       total_volume::text as total_volume,
       market
     from finra_daily_short_volume
     where symbol = 'PLCE'
     order by date asc`
  );

  return result.rows;
}

export async function upsertPlceShortVolumeIndicatorRows(rows) {
  if (!rows.length) {
    return 0;
  }

  const statements = buildPlceShortVolumeIndicatorUpsertStatements(rows);

  for (const statement of statements) {
    await query(statement.sql, statement.params);
  }

  return rows.length;
}
