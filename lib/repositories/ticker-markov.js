import { query } from '../db.js';
import { chunkArray } from '../utils/chunk.js';
import { formatIndicatorValueForStorage } from '../utils/rolling-indicators.js';

const TICKER_MARKOV_BATCH_SIZE = 100;
const TICKER_MARKOV_FIELDS = [
  'ticker',
  'date',
  'markov_state',
  'twenty_day_return',
  'bull_probability',
  'sideways_probability',
  'bear_probability',
  'markov_total',
  'markov_stickiness',
  'sample_size',
  'signal',
  'rank_bull',
  'rank_sell',
];
const NUMERIC_FIELDS = new Set([
  'twenty_day_return',
  'bull_probability',
  'sideways_probability',
  'bear_probability',
  'markov_total',
  'markov_stickiness',
]);

function formatFieldValue(row, field) {
  if (NUMERIC_FIELDS.has(field)) {
    return formatIndicatorValueForStorage(row[field]);
  }

  return row[field] ?? null;
}

export function buildTickerMarkovUpsertStatements(rows, batchSize = TICKER_MARKOV_BATCH_SIZE) {
  return chunkArray(rows, batchSize).map((batch) => {
    const params = [];
    const values = batch.map((row, index) => {
      const base = index * TICKER_MARKOV_FIELDS.length;
      params.push(...TICKER_MARKOV_FIELDS.map((field) => formatFieldValue(row, field)));
      return `(${TICKER_MARKOV_FIELDS.map((_, fieldIndex) => `$${base + fieldIndex + 1}`).join(', ')}, now())`;
    });

    return {
      sql: `insert into ticker_markov_daily (
        ${TICKER_MARKOV_FIELDS.join(', ')}, updated_at
      ) values ${values.join(', ')}
      on conflict (ticker, date) do update set
        ${TICKER_MARKOV_FIELDS.filter((field) => !['ticker', 'date'].includes(field)).map((field) => `${field} = excluded.${field}`).join(',\n        ')},
        updated_at = now()`,
      params,
    };
  });
}

export async function upsertTickerMarkovRows(rows) {
  if (!rows.length) {
    return 0;
  }

  const statements = buildTickerMarkovUpsertStatements(rows);
  for (const statement of statements) {
    await query(statement.sql, statement.params);
  }

  return rows.length;
}

export async function getLatestTickerMarkovRows({ limit = 50, signal = null, side = 'bull' } = {}) {
  const safeLimit = Math.max(1, Math.min(Number(limit) || 50, 500));
  const whereParts = ['date = (select date from latest_date)'];
  const params = [safeLimit];

  if (signal) {
    params.push(signal);
    whereParts.push(`signal = $${params.length}`);
  }

  const orderBy = side === 'sell'
    ? 'rank_sell asc nulls last, markov_total asc nulls last, ticker asc'
    : 'rank_bull asc nulls last, markov_total desc nulls last, ticker asc';

  const result = await query(
    `with latest_date as (
       select max(date) as date
       from ticker_markov_daily
     )
     select
       ticker,
       date::text as date,
       markov_state,
       twenty_day_return::text as twenty_day_return,
       bull_probability::text as bull_probability,
       sideways_probability::text as sideways_probability,
       bear_probability::text as bear_probability,
       markov_total::text as markov_total,
       markov_stickiness::text as markov_stickiness,
       sample_size,
       signal,
       rank_bull,
       rank_sell
     from ticker_markov_daily
     where ${whereParts.join('\n       and ')}
     order by ${orderBy}
     limit $1`,
    params
  );

  return result.rows;
}
