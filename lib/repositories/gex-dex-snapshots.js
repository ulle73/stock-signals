import { getPool, query } from '../db.js';
import { chunkArray } from '../utils/chunk.js';
import { formatIndicatorValueForStorage } from '../utils/rolling-indicators.js';

const GEX_DEX_STRIKE_BATCH_SIZE = 100;

function toStorageNumber(value) {
  return formatIndicatorValueForStorage(value);
}

export function buildGexDexSnapshotUpsertStatement(snapshot) {
  const params = [
    snapshot.ticker,
    snapshot.source_timestamp,
    snapshot.source_url,
    snapshot.source_status,
    snapshot.data_quality,
    snapshot.from_cache,
    snapshot.stale,
    snapshot.multi_expiry,
    toStorageNumber(snapshot.spot_price),
    toStorageNumber(snapshot.spot_change),
    toStorageNumber(snapshot.spot_change_pct),
    toStorageNumber(snapshot.call_wall),
    toStorageNumber(snapshot.put_wall),
    toStorageNumber(snapshot.gamma_flip),
    toStorageNumber(snapshot.net_gex),
    toStorageNumber(snapshot.net_dex),
    snapshot.dealer_positioning,
    snapshot.market_regime,
    toStorageNumber(snapshot.dex_resistance),
    toStorageNumber(snapshot.dex_support),
    toStorageNumber(snapshot.atr_14),
    toStorageNumber(snapshot.atr_pct),
    JSON.stringify(snapshot.key_levels ?? {}),
    JSON.stringify(snapshot.raw_payload ?? {}),
  ];

  return {
    sql: `insert into gex_dex_source_snapshots (
      ticker, source_timestamp, source_url, source_status, data_quality, from_cache, stale, multi_expiry,
      spot_price, spot_change, spot_change_pct, call_wall, put_wall, gamma_flip, net_gex, net_dex,
      dealer_positioning, market_regime, dex_resistance, dex_support, atr_14, atr_pct, key_levels,
      raw_payload, fetched_at, updated_at
    ) values (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16,
      $17, $18, $19, $20, $21, $22, $23::jsonb, $24::jsonb, now(), now()
    )
    on conflict (ticker, source_timestamp) do update set
      source_url = excluded.source_url,
      source_status = excluded.source_status,
      data_quality = excluded.data_quality,
      from_cache = excluded.from_cache,
      stale = excluded.stale,
      multi_expiry = excluded.multi_expiry,
      spot_price = excluded.spot_price,
      spot_change = excluded.spot_change,
      spot_change_pct = excluded.spot_change_pct,
      call_wall = excluded.call_wall,
      put_wall = excluded.put_wall,
      gamma_flip = excluded.gamma_flip,
      net_gex = excluded.net_gex,
      net_dex = excluded.net_dex,
      dealer_positioning = excluded.dealer_positioning,
      market_regime = excluded.market_regime,
      dex_resistance = excluded.dex_resistance,
      dex_support = excluded.dex_support,
      atr_14 = excluded.atr_14,
      atr_pct = excluded.atr_pct,
      key_levels = excluded.key_levels,
      raw_payload = excluded.raw_payload,
      fetched_at = now(),
      updated_at = now()
    returning id`,
    params,
  };
}

export function buildGexDexStrikeUpsertStatements(
  snapshotId,
  strikes,
  batchSize = GEX_DEX_STRIKE_BATCH_SIZE
) {
  return chunkArray(strikes, batchSize).map((batch) => {
    const params = [];
    const values = batch.map((strike, index) => {
      const base = index * 9;
      params.push(
        toStorageNumber(snapshotId),
        toStorageNumber(strike.strike),
        toStorageNumber(strike.call_gex),
        toStorageNumber(strike.put_gex),
        toStorageNumber(strike.net_gex),
        toStorageNumber(strike.call_dex),
        toStorageNumber(strike.put_dex),
        toStorageNumber(strike.net_dex),
        toStorageNumber(strike.expiry_count)
      );

      return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7}, $${base + 8}, $${base + 9}, now())`;
    });

    return {
      sql: `insert into gex_dex_strike_snapshots (
        snapshot_id, strike, call_gex, put_gex, net_gex, call_dex, put_dex, net_dex, expiry_count, updated_at
      ) values ${values.join(', ')}
      on conflict (snapshot_id, strike) do update set
        call_gex = excluded.call_gex,
        put_gex = excluded.put_gex,
        net_gex = excluded.net_gex,
        call_dex = excluded.call_dex,
        put_dex = excluded.put_dex,
        net_dex = excluded.net_dex,
        expiry_count = excluded.expiry_count,
        updated_at = now()`,
      params,
    };
  });
}

export async function upsertGexDexSnapshot(snapshot, strikes, pool = getPool()) {
  const client = await pool.connect();

  try {
    await client.query('begin');
    const snapshotStatement = buildGexDexSnapshotUpsertStatement(snapshot);
    const snapshotResult = await client.query(snapshotStatement.sql, snapshotStatement.params);
    const snapshotId = snapshotResult.rows[0].id;

    await client.query('delete from gex_dex_strike_snapshots where snapshot_id = $1', [snapshotId]);
    for (const statement of buildGexDexStrikeUpsertStatements(snapshotId, strikes)) {
      await client.query(statement.sql, statement.params);
    }

    await client.query('commit');
    return snapshotId;
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}

export async function getGexDexSnapshotsWithoutSignals(limit = 100) {
  const result = await query(
    `select
       s.id,
       s.ticker,
       s.source_timestamp::text as source_timestamp,
       s.source_status,
       s.stale,
       s.spot_price::text as spot_price,
       s.call_wall::text as call_wall,
       s.put_wall::text as put_wall,
       s.gamma_flip::text as gamma_flip,
       s.net_gex::text as net_gex,
       s.net_dex::text as net_dex,
       s.dealer_positioning,
       s.dex_resistance::text as dex_resistance,
       s.dex_support::text as dex_support,
       s.atr_14::text as atr_14,
       s.key_levels
     from gex_dex_source_snapshots s
     left join gex_dex_signal_snapshots signal
       on signal.snapshot_id = s.id
     where signal.snapshot_id is null
     order by s.source_timestamp asc
     limit $1`,
    [limit]
  );

  return result.rows;
}

export async function getLatestGexDexSourceSnapshots(tickers = null) {
  const result = await query(
    `with latest as (
       select distinct on (ticker)
         id,
         ticker,
         source_timestamp,
         source_url,
         source_status,
         data_quality,
         from_cache,
         stale,
         multi_expiry,
         spot_price,
         spot_change,
         spot_change_pct,
         call_wall,
         put_wall,
         gamma_flip,
         net_gex,
         net_dex,
         dealer_positioning,
         market_regime,
         dex_resistance,
         dex_support,
         atr_14,
         atr_pct,
         key_levels
       from gex_dex_source_snapshots
       where $1::text[] is null or ticker = any($1::text[])
       order by ticker, source_timestamp desc
     )
     select
       id,
       ticker,
       source_timestamp::text as source_timestamp,
       source_url,
       source_status,
       data_quality,
       from_cache,
       stale,
       multi_expiry,
       spot_price::text as spot_price,
       spot_change::text as spot_change,
       spot_change_pct::text as spot_change_pct,
       call_wall::text as call_wall,
       put_wall::text as put_wall,
       gamma_flip::text as gamma_flip,
       net_gex::text as net_gex,
       net_dex::text as net_dex,
       dealer_positioning,
       market_regime,
       dex_resistance::text as dex_resistance,
       dex_support::text as dex_support,
       atr_14::text as atr_14,
       atr_pct::text as atr_pct,
       key_levels
     from latest
     order by ticker asc`,
    [tickers?.length ? tickers : null]
  );

  return result.rows;
}

export async function getGexDexStrikeSnapshots(snapshotIds) {
  if (!snapshotIds.length) return [];

  const result = await query(
    `select
       snapshot_id,
       strike::text as strike,
       call_gex::text as call_gex,
       put_gex::text as put_gex,
       net_gex::text as net_gex,
       call_dex::text as call_dex,
       put_dex::text as put_dex,
       net_dex::text as net_dex,
       expiry_count::text as expiry_count
     from gex_dex_strike_snapshots
     where snapshot_id = any($1::bigint[])
     order by snapshot_id asc, strike asc`,
    [snapshotIds]
  );

  return result.rows;
}
