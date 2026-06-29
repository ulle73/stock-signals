import { query } from '../db.js';
import { buildYahooQuotePageUrl } from '../sources/yahoo-earnings.js';
import { chunkArray } from '../utils/chunk.js';

const DEFAULT_QUERY_CLIENT = { query };
const STOCK_EARNINGS_CALENDAR_BATCH_SIZE = 100;
const STOCK_EARNINGS_CALENDAR_FIELDS = [
  'date',
  'ticker',
  'yahoo_ticker',
  'company_name',
  'earnings_date',
  'confirmed',
  'source',
  'source_status',
  'source_url',
  'details',
];

function formatFieldValue(row, field) {
  if (field === 'details') {
    return JSON.stringify(row.details ?? {});
  }

  return row[field] ?? null;
}

export function buildStockEarningsCalendarRow({
  snapshotDate,
  constituent,
  earningsData,
}) {
  return {
    date: snapshotDate,
    ticker: constituent.ticker,
    yahoo_ticker: constituent.yahoo_ticker,
    company_name: constituent.company_name ?? null,
    earnings_date: earningsData.earnings_date ?? null,
    confirmed: earningsData.confirmed ?? null,
    source: earningsData.source ?? 'yahoo_quote_page',
    source_status: earningsData.source_status ?? 'error',
    source_url: earningsData.source_url ?? buildYahooQuotePageUrl(constituent.yahoo_ticker),
    details: earningsData.details ?? {},
  };
}

export function buildStockEarningsCalendarErrorRow(snapshotDate, constituent, error) {
  return {
    date: snapshotDate,
    ticker: constituent.ticker,
    yahoo_ticker: constituent.yahoo_ticker,
    company_name: constituent.company_name ?? null,
    earnings_date: null,
    confirmed: null,
    source: 'yahoo_quote_page',
    source_status: 'error',
    source_url: buildYahooQuotePageUrl(constituent.yahoo_ticker),
    details: {
      error_message: error.message,
    },
  };
}

export function buildStockEarningsCalendarUpsertStatements(
  rows,
  batchSize = STOCK_EARNINGS_CALENDAR_BATCH_SIZE
) {
  return chunkArray(rows, batchSize).map((batch) => {
    const params = [];
    const values = batch.map((row, index) => {
      const base = index * STOCK_EARNINGS_CALENDAR_FIELDS.length;
      params.push(...STOCK_EARNINGS_CALENDAR_FIELDS.map((field) => formatFieldValue(row, field)));

      const placeholders = STOCK_EARNINGS_CALENDAR_FIELDS.map((field, fieldIndex) => {
        const parameter = `$${base + fieldIndex + 1}`;
        return field === 'details' ? `${parameter}::jsonb` : parameter;
      });

      return `(${placeholders.join(', ')}, now(), now())`;
    });

    return {
      sql: `insert into stock_earnings_calendar_daily (
        ${STOCK_EARNINGS_CALENDAR_FIELDS.join(', ')}, created_at, updated_at
      ) values ${values.join(', ')}
      on conflict (date, ticker) do update set
        ${STOCK_EARNINGS_CALENDAR_FIELDS.filter((field) => !['date', 'ticker'].includes(field)).map((field) => `${field} = excluded.${field}`).join(',\n        ')},
        updated_at = now()`,
      params,
    };
  });
}

export async function upsertStockEarningsCalendarRows(rows, queryClient = DEFAULT_QUERY_CLIENT) {
  if (!rows.length) {
    return 0;
  }

  const statements = buildStockEarningsCalendarUpsertStatements(rows);
  for (const statement of statements) {
    await queryClient.query(statement.sql, statement.params);
  }

  return rows.length;
}

export async function getStockEarningsCalendarRows(
  {
    date = null,
    ticker = null,
    limit = 100000,
  } = {},
  queryClient = DEFAULT_QUERY_CLIENT
) {
  const filters = [];
  const params = [];

  if (date !== null) {
    params.push(date);
    filters.push(`date = $${params.length}::date`);
  }

  if (ticker !== null) {
    params.push(ticker);
    filters.push(`ticker = $${params.length}`);
  }

  params.push(limit);

  const whereClause = filters.length
    ? `where ${filters.join(' and ')}`
    : '';

  const result = await queryClient.query(
    `select
       date::text as date,
       ticker,
       yahoo_ticker,
       company_name,
       earnings_date::text as earnings_date,
       confirmed,
       source,
       source_status,
       source_url,
       details
     from stock_earnings_calendar_daily
     ${whereClause}
     order by ticker asc, date asc
     limit $${params.length}`,
    params
  );

  return result.rows;
}
