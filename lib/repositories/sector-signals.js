import { query } from '../db.js';
import { chunkArray } from '../utils/chunk.js';
import { formatIndicatorValueForStorage } from '../utils/rolling-indicators.js';

const SECTOR_SIGNAL_BATCH_SIZE = 200;

export function buildSectorSignalUpsertStatements(rows, batchSize = SECTOR_SIGNAL_BATCH_SIZE) {
  return chunkArray(rows, batchSize).map((batch) => {
    const params = [];
    const values = batch.map((row, index) => {
      const base = index * 14;
      params.push(
        row.date,
        row.sector,
        row.active_ticker_count,
        formatIndicatorValueForStorage(row.pct_above_sma50),
        formatIndicatorValueForStorage(row.pct_above_sma50_14d_change),
        formatIndicatorValueForStorage(row.pct_above_sma200),
        formatIndicatorValueForStorage(row.pct_above_sma200_14d_change),
        row.ad_net,
        row.ad_net_14d_change,
        row.new_highs_52w,
        row.new_lows_52w,
        formatIndicatorValueForStorage(row.sector_regime_score),
        row.signal,
        row.reason_summary ?? null
      );

      return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7}, $${base + 8}, $${base + 9}, $${base + 10}, $${base + 11}, $${base + 12}, $${base + 13}, $${base + 14}, now())`;
    });

    return {
      sql: `insert into sector_signal_daily (
        date, sector, active_ticker_count, pct_above_sma50, pct_above_sma50_14d_change,
        pct_above_sma200, pct_above_sma200_14d_change, ad_net, ad_net_14d_change,
        new_highs_52w, new_lows_52w, sector_regime_score, signal, reason_summary, updated_at
      ) values ${values.join(', ')}
      on conflict (date, sector) do update set
        active_ticker_count = excluded.active_ticker_count,
        pct_above_sma50 = excluded.pct_above_sma50,
        pct_above_sma50_14d_change = excluded.pct_above_sma50_14d_change,
        pct_above_sma200 = excluded.pct_above_sma200,
        pct_above_sma200_14d_change = excluded.pct_above_sma200_14d_change,
        ad_net = excluded.ad_net,
        ad_net_14d_change = excluded.ad_net_14d_change,
        new_highs_52w = excluded.new_highs_52w,
        new_lows_52w = excluded.new_lows_52w,
        sector_regime_score = excluded.sector_regime_score,
        signal = excluded.signal,
        reason_summary = excluded.reason_summary,
        updated_at = now()`,
      params,
    };
  });
}

export async function getSectorSignalSourceRows() {
  const result = await query(
    `select
       date::text as date,
       sector,
       active_ticker_count,
       advancers,
       decliners,
       pct_above_sma50::text as pct_above_sma50,
       pct_above_sma200::text as pct_above_sma200,
       new_highs_52w,
       new_lows_52w,
       is_valid_signal_date
     from sector_breadth_daily
     order by date asc, sector asc`
  );

  return {
    sectorBreadthRows: result.rows,
  };
}

export async function upsertSectorSignals(rows) {
  if (!rows.length) {
    return 0;
  }

  const statements = buildSectorSignalUpsertStatements(rows);

  for (const statement of statements) {
    await query(statement.sql, statement.params);
  }

  return rows.length;
}

export async function getSectorSignalRows() {
  const result = await query(
    `select
       date::text as date,
       sector,
       active_ticker_count,
       pct_above_sma50::text as pct_above_sma50,
       pct_above_sma50_14d_change::text as pct_above_sma50_14d_change,
       pct_above_sma200::text as pct_above_sma200,
       pct_above_sma200_14d_change::text as pct_above_sma200_14d_change,
       ad_net,
       ad_net_14d_change::text as ad_net_14d_change,
       new_highs_52w,
       new_lows_52w,
       sector_regime_score::text as sector_regime_score,
       signal,
       reason_summary
     from sector_signal_daily
     order by date asc, sector asc`
  );

  return result.rows;
}
