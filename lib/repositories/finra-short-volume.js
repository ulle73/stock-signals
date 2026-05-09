import { query } from '../db.js';
import { chunkArray } from '../utils/chunk.js';
import { formatIndicatorValueForStorage } from '../utils/rolling-indicators.js';

const FINRA_SHORT_VOLUME_BATCH_SIZE = 100;

export function buildFinraShortVolumeUpsertStatements(rows, batchSize = FINRA_SHORT_VOLUME_BATCH_SIZE) {
  return chunkArray(rows, batchSize).map((batch) => {
    const params = [];
    const values = batch.map((row, index) => {
      const base = index * 8;
      params.push(
        row.date,
        row.symbol,
        formatIndicatorValueForStorage(row.short_volume),
        formatIndicatorValueForStorage(row.short_exempt_volume),
        formatIndicatorValueForStorage(row.total_volume),
        row.market,
        row.source,
        row.source_url
      );

      return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7}, $${base + 8}, now())`;
    });

    return {
      sql: `insert into finra_daily_short_volume (
        date, symbol, short_volume, short_exempt_volume, total_volume, market, source, source_url, updated_at
      ) values ${values.join(', ')}
      on conflict (date, symbol) do update set
        short_volume = excluded.short_volume,
        short_exempt_volume = excluded.short_exempt_volume,
        total_volume = excluded.total_volume,
        market = excluded.market,
        source = excluded.source,
        source_url = excluded.source_url,
        updated_at = now()`,
      params,
    };
  });
}

export async function upsertFinraShortVolumeRows(rows) {
  if (!rows.length) {
    return 0;
  }

  const statements = buildFinraShortVolumeUpsertStatements(rows);

  for (const statement of statements) {
    await query(statement.sql, statement.params);
  }

  return rows.length;
}

export async function getLatestFinraShortVolumeDate(symbol = 'PLCE') {
  const result = await query(
    `select max(date)::text as latest_date
     from finra_daily_short_volume
     where symbol = $1`,
    [symbol]
  );

  return result.rows[0]?.latest_date ?? null;
}

export async function getFinraShortVolumeRows(symbol = 'PLCE') {
  const result = await query(
    `select
       date::text as date,
       symbol,
       short_volume::text as short_volume,
       short_exempt_volume::text as short_exempt_volume,
       total_volume::text as total_volume,
       market
     from finra_daily_short_volume
     where symbol = $1
     order by date asc`,
    [symbol]
  );

  return result.rows;
}
