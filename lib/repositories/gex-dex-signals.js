import { query } from '../db.js';
import { chunkArray } from '../utils/chunk.js';
import { formatIndicatorValueForStorage } from '../utils/rolling-indicators.js';

const GEX_DEX_SIGNAL_BATCH_SIZE = 100;

function toStorageNumber(value) {
  return formatIndicatorValueForStorage(value);
}

export function buildGexDexSignalUpsertStatements(rows, batchSize = GEX_DEX_SIGNAL_BATCH_SIZE) {
  return chunkArray(rows, batchSize).map((batch) => {
    const params = [];
    const values = batch.map((row, index) => {
      const base = index * 12;
      params.push(
        toStorageNumber(row.snapshot_id),
        row.ticker,
        row.gamma_regime,
        toStorageNumber(row.spot_to_gamma_flip_atr),
        toStorageNumber(row.spot_to_call_wall_atr),
        toStorageNumber(row.spot_to_put_wall_atr),
        row.inside_walls,
        row.near_gamma_flip,
        row.above_call_wall,
        row.below_put_wall,
        row.gex_dex_confluence,
        row.gex_dex_signal
      );

      return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7}, $${base + 8}, $${base + 9}, $${base + 10}, $${base + 11}, $${base + 12}, now())`;
    });

    return {
      sql: `insert into gex_dex_signal_snapshots (
        snapshot_id, ticker, gamma_regime, spot_to_gamma_flip_atr, spot_to_call_wall_atr,
        spot_to_put_wall_atr, inside_walls, near_gamma_flip, above_call_wall, below_put_wall,
        gex_dex_confluence, gex_dex_signal, updated_at
      ) values ${values.join(', ')}
      on conflict (snapshot_id) do update set
        ticker = excluded.ticker,
        gamma_regime = excluded.gamma_regime,
        spot_to_gamma_flip_atr = excluded.spot_to_gamma_flip_atr,
        spot_to_call_wall_atr = excluded.spot_to_call_wall_atr,
        spot_to_put_wall_atr = excluded.spot_to_put_wall_atr,
        inside_walls = excluded.inside_walls,
        near_gamma_flip = excluded.near_gamma_flip,
        above_call_wall = excluded.above_call_wall,
        below_put_wall = excluded.below_put_wall,
        gex_dex_confluence = excluded.gex_dex_confluence,
        gex_dex_signal = excluded.gex_dex_signal,
        updated_at = now()`,
      params,
    };
  });
}

export async function upsertGexDexSignalRows(rows) {
  if (!rows.length) return 0;

  for (const statement of buildGexDexSignalUpsertStatements(rows)) {
    await query(statement.sql, statement.params);
  }

  return rows.length;
}

export async function getLatestGexDexDashboardRows(tickers = null) {
  const result = await query(
    `with latest as (
       select distinct on (source.ticker)
         source.id,
         source.ticker,
         source.source_timestamp,
         source.source_url,
         source.source_status,
         source.data_quality,
         source.from_cache,
         source.stale,
         source.multi_expiry,
         source.spot_price,
         source.spot_change,
         source.spot_change_pct,
         source.call_wall,
         source.put_wall,
         source.gamma_flip,
         source.net_gex,
         source.net_dex,
         source.dealer_positioning,
         source.market_regime,
         source.dex_resistance,
         source.dex_support,
         source.atr_14,
         source.atr_pct,
         signal.gamma_regime,
         signal.spot_to_gamma_flip_atr,
         signal.spot_to_call_wall_atr,
         signal.spot_to_put_wall_atr,
         signal.inside_walls,
         signal.near_gamma_flip,
         signal.above_call_wall,
         signal.below_put_wall,
         signal.gex_dex_confluence,
         signal.gex_dex_signal
       from gex_dex_source_snapshots source
       left join gex_dex_signal_snapshots signal
         on signal.snapshot_id = source.id
       where $1::text[] is null or source.ticker = any($1::text[])
       order by source.ticker, source.source_timestamp desc
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
       gamma_regime,
       spot_to_gamma_flip_atr::text as spot_to_gamma_flip_atr,
       spot_to_call_wall_atr::text as spot_to_call_wall_atr,
       spot_to_put_wall_atr::text as spot_to_put_wall_atr,
       inside_walls,
       near_gamma_flip,
       above_call_wall,
       below_put_wall,
       gex_dex_confluence,
       gex_dex_signal
     from latest
     order by ticker asc`,
    [tickers?.length ? tickers : null]
  );

  return result.rows;
}
