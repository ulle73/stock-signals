import { query } from '../db.js';
import { chunkArray } from '../utils/chunk.js';

const DEFAULT_QUERY_CLIENT = { query };
const SIGNAL_EVENT_BATCH_SIZE = 100;
const SIGNAL_EVENT_STATUSES = new Set(['pending', 'sent', 'expired', 'cancelled']);
const STATUS_TIMESTAMP_FIELDS = new Map([
  ['sent', 'sent_at'],
  ['expired', 'expired_at'],
  ['cancelled', 'cancelled_at'],
]);

function normalizeSignalEventStatus(status) {
  if (!SIGNAL_EVENT_STATUSES.has(status)) {
    throw new Error(`Unsupported signal event status: ${status}`);
  }

  return status;
}

export function buildSignalEventUpsertStatements(rows, batchSize = SIGNAL_EVENT_BATCH_SIZE) {
  return chunkArray(rows, batchSize).map((batch) => {
    const params = [];
    const values = batch.map((row, index) => {
      const base = index * 13;
      params.push(
        row.event_date,
        row.asset_key,
        row.ticker ?? null,
        row.signal_key,
        row.signal_name,
        row.signal_type,
        row.timeframe,
        row.direction ?? null,
        row.severity ?? null,
        row.category ?? null,
        row.channel_key ?? null,
        row.source_table,
        JSON.stringify(row.source_payload ?? {})
      );

      return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7}, $${base + 8}, $${base + 9}, $${base + 10}, $${base + 11}, $${base + 12}, $${base + 13}, now(), now())`;
    });

    return {
      sql: `insert into signal_events (
        event_date, asset_key, ticker, signal_key, signal_name, signal_type, timeframe,
        direction, severity, category, channel_key, source_table, source_payload, created_at, updated_at
      ) values ${values.join(', ')}
      on conflict (event_date, asset_key, signal_key) do update set
        ticker = excluded.ticker,
        signal_name = excluded.signal_name,
        signal_type = excluded.signal_type,
        timeframe = excluded.timeframe,
        direction = excluded.direction,
        severity = excluded.severity,
        category = excluded.category,
        channel_key = excluded.channel_key,
        source_table = excluded.source_table,
        source_payload = excluded.source_payload,
        updated_at = now()`,
      params,
    };
  });
}

export function buildSignalEventStatusUpdateStatement({ id, status, changed_at = null }) {
  const normalizedStatus = normalizeSignalEventStatus(status);
  const timestampField = STATUS_TIMESTAMP_FIELDS.get(normalizedStatus);

  if (timestampField) {
    return {
      sql: `update signal_events set
        status = $2,
        ${timestampField} = coalesce($3, now()),
        updated_at = now()
       where id = $1`,
      params: [id, normalizedStatus, changed_at],
    };
  }

  return {
    sql: `update signal_events set
      status = $2,
      updated_at = now()
     where id = $1`,
    params: [id, normalizedStatus],
  };
}

export async function upsertSignalEvents(rows, queryClient = DEFAULT_QUERY_CLIENT) {
  if (!rows.length) {
    return 0;
  }

  const statements = buildSignalEventUpsertStatements(rows);
  for (const statement of statements) {
    await queryClient.query(statement.sql, statement.params);
  }

  return rows.length;
}

export async function getSignalEvents(
  {
    status = null,
    signal_key = null,
    asset_key = null,
    limit = 100,
  } = {},
  queryClient = DEFAULT_QUERY_CLIENT
) {
  const filters = [];
  const params = [];

  if (status !== null) {
    params.push(normalizeSignalEventStatus(status));
    filters.push(`status = $${params.length}`);
  }

  if (signal_key !== null) {
    params.push(signal_key);
    filters.push(`signal_key = $${params.length}`);
  }

  if (asset_key !== null) {
    params.push(asset_key);
    filters.push(`asset_key = $${params.length}`);
  }

  params.push(limit);

  const whereClause = filters.length
    ? `where ${filters.join(' and ')}`
    : '';

  const result = await queryClient.query(
    `select
       id,
       event_date::text as event_date,
       asset_key,
       ticker,
       signal_key,
       signal_name,
       signal_type,
       timeframe,
       direction,
       severity,
       category,
       channel_key,
       status,
       source_table,
       source_payload,
       sent_at,
       expired_at,
       cancelled_at
     from signal_events
     ${whereClause}
     order by event_date asc, id asc
     limit $${params.length}`,
    params
  );

  return result.rows;
}

export async function getPendingSignalEvents(limit = 100, queryClient = DEFAULT_QUERY_CLIENT) {
  return getSignalEvents({ status: 'pending', limit }, queryClient);
}

export async function updateSignalEventStatus(row, queryClient = DEFAULT_QUERY_CLIENT) {
  const statement = buildSignalEventStatusUpdateStatement(row);
  const result = await queryClient.query(statement.sql, statement.params);
  return result.rowCount ?? 0;
}

export async function markSignalEventSent(id, sent_at = null, queryClient = DEFAULT_QUERY_CLIENT) {
  return updateSignalEventStatus({ id, status: 'sent', changed_at: sent_at }, queryClient);
}
