import { query } from '../db.js';

function finiteNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export async function getLatestGexDexStrikeSnapshot(ticker) {
  const result = await query(
    `with latest as (
       select
         id,
         source_timestamp,
         spot_price
       from gex_dex_source_snapshots
       where ticker = $1
         and source_timestamp <= now()
       order by source_timestamp desc
       limit 1
     )
     select
       latest.source_timestamp::text as source_timestamp,
       latest.spot_price::text as spot_price,
       strike.strike::text as strike,
       strike.call_gex::text as call_gex,
       strike.put_gex::text as put_gex,
       strike.net_gex::text as net_gex,
       strike.call_dex::text as call_dex,
       strike.put_dex::text as put_dex,
       strike.net_dex::text as net_dex,
       strike.expiry_count::text as expiry_count
     from latest
     left join gex_dex_strike_snapshots strike
       on strike.snapshot_id = latest.id
     order by strike.strike asc`,
    [ticker]
  );

  const first = result.rows[0] ?? null;
  if (!first) {
    return { sourceTimestamp: null, spotPrice: null, strikes: [] };
  }

  return {
    sourceTimestamp: first.source_timestamp ?? null,
    spotPrice: finiteNumber(first.spot_price),
    strikes: result.rows.flatMap((row) => {
      const strike = finiteNumber(row.strike);
      if (strike === null) return [];
      return [{
        strike,
        call_gex: finiteNumber(row.call_gex),
        put_gex: finiteNumber(row.put_gex),
        net_gex: finiteNumber(row.net_gex),
        call_dex: finiteNumber(row.call_dex),
        put_dex: finiteNumber(row.put_dex),
        net_dex: finiteNumber(row.net_dex),
        expiry_count: finiteNumber(row.expiry_count),
      }];
    }),
  };
}
