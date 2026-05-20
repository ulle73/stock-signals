import { query } from '../db.js';
import { chunkArray } from '../utils/chunk.js';

const DEFAULT_QUERY_CLIENT = { query };
const SNAPSHOT_BATCH_SIZE = 100;

export function buildBrokerStateSnapshotInsertStatements(rows, batchSize = SNAPSHOT_BATCH_SIZE) {
  return chunkArray(rows, batchSize).map((batch) => {
    const params = [];
    const values = batch.map((row, index) => {
      const base = index * 7;
      params.push(
        row.broker,
        row.snapshot_type,
        row.symbol ?? null,
        row.broker_object_id ?? null,
        row.captured_at,
        JSON.stringify(row.normalized_json ?? {}),
        JSON.stringify(row.payload_json ?? {})
      );

      return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7})`;
    });

    return {
      sql: `insert into broker_state_snapshots (
        broker, snapshot_type, symbol, broker_object_id, captured_at, normalized_json, payload_json
      ) values ${values.join(', ')}`,
      params,
    };
  });
}

export async function insertBrokerStateSnapshots(rows, queryClient = DEFAULT_QUERY_CLIENT) {
  if (!rows.length) {
    return 0;
  }

  const statements = buildBrokerStateSnapshotInsertStatements(rows);
  for (const statement of statements) {
    await queryClient.query(statement.sql, statement.params);
  }

  return rows.length;
}
