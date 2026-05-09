import { query } from '../db.js';
import { chunkArray } from '../utils/chunk.js';
import { formatIndicatorValueForStorage } from '../utils/rolling-indicators.js';

const EXTERNAL_BREADTH_BATCH_SIZE = 100;

export const BARCHART_BREADTH_SERIES = [
  {
    seriesKey: 'R3TW',
    symbol: '$R3TW',
    sourceUrl: 'https://www.barchart.com/stocks/quotes/%24R3TW',
  },
  {
    seriesKey: 'MMTW',
    symbol: '$MMTW',
    sourceUrl: 'https://www.barchart.com/stocks/quotes/%24MMTW',
  },
];

export function buildExternalBreadthUpsertStatements(rows, batchSize = EXTERNAL_BREADTH_BATCH_SIZE) {
  return chunkArray(rows, batchSize).map((batch) => {
    const params = [];
    const values = batch.map((row, index) => {
      const base = index * 7;
      params.push(
        row.date,
        row.series_key,
        row.symbol,
        row.name,
        formatIndicatorValueForStorage(row.value),
        row.source,
        row.source_url
      );

      return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7}, now())`;
    });

    return {
      sql: `insert into external_breadth_daily (
        date, series_key, symbol, name, value, source, source_url, updated_at
      ) values ${values.join(', ')}
      on conflict (date, series_key) do update set
        symbol = excluded.symbol,
        name = excluded.name,
        value = excluded.value,
        source = excluded.source,
        source_url = excluded.source_url,
        updated_at = now()`,
      params,
    };
  });
}

export async function upsertExternalBreadthRows(rows) {
  if (!rows.length) {
    return 0;
  }

  const statements = buildExternalBreadthUpsertStatements(rows);

  for (const statement of statements) {
    await query(statement.sql, statement.params);
  }

  return rows.length;
}

export async function getExternalBreadthRows(seriesKeys = ['R3TW', 'MMTW']) {
  const result = await query(
    `select
       date::text as date,
       series_key,
       symbol,
       name,
       value::text as value
     from external_breadth_daily
     where series_key = any($1::text[])
     order by date asc, series_key asc`,
    [seriesKeys]
  );

  return result.rows;
}
