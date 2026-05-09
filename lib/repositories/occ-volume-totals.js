import { query } from '../db.js';
import { chunkArray } from '../utils/chunk.js';
import { formatIndicatorValueForStorage } from '../utils/rolling-indicators.js';

const OCC_DAILY_VOLUME_BATCH_SIZE = 200;

export function buildOccDailyVolumeUpsertStatements(rows, batchSize = OCC_DAILY_VOLUME_BATCH_SIZE) {
  return chunkArray(rows, batchSize).map((batch) => {
    const params = [];
    const values = batch.map((row, index) => {
      const base = index * 9;
      params.push(
        row.report_date,
        row.exchange,
        formatIndicatorValueForStorage(row.calls),
        formatIndicatorValueForStorage(row.puts),
        formatIndicatorValueForStorage(row.ratio),
        formatIndicatorValueForStorage(row.volume),
        formatIndicatorValueForStorage(row.market_share),
        row.source,
        row.source_url
      );

      return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7}, $${base + 8}, $${base + 9}, now())`;
    });

    return {
      sql: `insert into occ_daily_volume_totals (
        report_date, exchange, calls, puts, ratio, volume, market_share, source, source_url, updated_at
      ) values ${values.join(', ')}
      on conflict (report_date, exchange) do update set
        calls = excluded.calls,
        puts = excluded.puts,
        ratio = excluded.ratio,
        volume = excluded.volume,
        market_share = excluded.market_share,
        source = excluded.source,
        source_url = excluded.source_url,
        updated_at = now()`,
      params,
    };
  });
}

export async function upsertOccDailyVolumeRows(rows) {
  if (!rows.length) {
    return 0;
  }

  const statements = buildOccDailyVolumeUpsertStatements(rows);

  for (const statement of statements) {
    await query(statement.sql, statement.params);
  }

  return rows.length;
}

export async function getLatestOccReportDate(exchange = 'Total') {
  const result = await query(
    `select max(report_date)::text as latest_date
     from occ_daily_volume_totals
     where exchange = $1`,
    [exchange]
  );

  return result.rows[0]?.latest_date ?? null;
}

export async function getOccTotalVolumeRows() {
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
