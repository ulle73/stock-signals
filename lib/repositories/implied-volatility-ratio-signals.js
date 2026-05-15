import { query } from '../db.js';
import { chunkArray } from '../utils/chunk.js';
import { formatIndicatorValueForStorage } from '../utils/rolling-indicators.js';

const IMPLIED_VOLATILITY_RATIO_SIGNAL_BATCH_SIZE = 100;

export function buildImpliedVolatilityRatioSignalUpsertStatements(
  rows,
  batchSize = IMPLIED_VOLATILITY_RATIO_SIGNAL_BATCH_SIZE
) {
  return chunkArray(rows, batchSize).map((batch) => {
    const params = [];
    const values = batch.map((row, index) => {
      const base = index * 34;
      params.push(
        row.date,
        row.asset_key,
        row.asset_name,
        row.asset_type,
        row.source_symbol,
        row.source_status,
        formatIndicatorValueForStorage(row.close),
        formatIndicatorValueForStorage(row.implied_volatility),
        formatIndicatorValueForStorage(row.realised_volatility_30d),
        formatIndicatorValueForStorage(row.realised_volatility_30d_5d_change),
        row.realised_volatility_30d_rising_sharply,
        formatIndicatorValueForStorage(row.ivol_rvol_ratio),
        formatIndicatorValueForStorage(row.ivol_rvol_ratio_z_1y),
        formatIndicatorValueForStorage(row.ivol_rvol_ratio_z_1w_ago),
        formatIndicatorValueForStorage(row.ivol_rvol_ratio_z_1w_change),
        formatIndicatorValueForStorage(row.ivol_rvol_ratio_z_1y_min),
        formatIndicatorValueForStorage(row.ivol_rvol_ratio_z_1y_max),
        formatIndicatorValueForStorage(row.rvol_20d),
        row.rvol_bucket,
        row.close_above_ma20,
        row.close_above_ma50,
        row.close_above_ma200,
        formatIndicatorValueForStorage(row.ma20_slope_20d),
        formatIndicatorValueForStorage(row.ma50_slope_20d),
        row.trend_regime,
        formatIndicatorValueForStorage(row.range_position_20d),
        row.range_bucket,
        row.ivol_rvol_level,
        row.signal,
        row.action,
        formatIndicatorValueForStorage(row.opportunity_score),
        row.ivol_rvol_rank,
        formatIndicatorValueForStorage(row.ivol_rvol_percentile),
        JSON.stringify(row.row_values ?? {})
      );

      return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7}, $${base + 8}, $${base + 9}, $${base + 10}, $${base + 11}, $${base + 12}, $${base + 13}, $${base + 14}, $${base + 15}, $${base + 16}, $${base + 17}, $${base + 18}, $${base + 19}, $${base + 20}, $${base + 21}, $${base + 22}, $${base + 23}, $${base + 24}, $${base + 25}, $${base + 26}, $${base + 27}, $${base + 28}, $${base + 29}, $${base + 30}, $${base + 31}, $${base + 32}, $${base + 33}, $${base + 34}::jsonb, now())`;
    });

    return {
      sql: `insert into implied_volatility_ratio_signals_daily (
        date, asset_key, asset_name, asset_type, source_symbol, source_status, close,
        implied_volatility, realised_volatility_30d, realised_volatility_30d_5d_change,
        realised_volatility_30d_rising_sharply, ivol_rvol_ratio, ivol_rvol_ratio_z_1y,
        ivol_rvol_ratio_z_1w_ago, ivol_rvol_ratio_z_1w_change, ivol_rvol_ratio_z_1y_min,
        ivol_rvol_ratio_z_1y_max, rvol_20d, rvol_bucket, close_above_ma20, close_above_ma50,
        close_above_ma200, ma20_slope_20d, ma50_slope_20d, trend_regime, range_position_20d,
        range_bucket, ivol_rvol_level, signal, action, opportunity_score, ivol_rvol_rank,
        ivol_rvol_percentile, row_values, updated_at
      ) values ${values.join(', ')}
      on conflict (date, asset_key) do update set
        asset_name = excluded.asset_name,
        asset_type = excluded.asset_type,
        source_symbol = excluded.source_symbol,
        source_status = excluded.source_status,
        close = excluded.close,
        implied_volatility = excluded.implied_volatility,
        realised_volatility_30d = excluded.realised_volatility_30d,
        realised_volatility_30d_5d_change = excluded.realised_volatility_30d_5d_change,
        realised_volatility_30d_rising_sharply = excluded.realised_volatility_30d_rising_sharply,
        ivol_rvol_ratio = excluded.ivol_rvol_ratio,
        ivol_rvol_ratio_z_1y = excluded.ivol_rvol_ratio_z_1y,
        ivol_rvol_ratio_z_1w_ago = excluded.ivol_rvol_ratio_z_1w_ago,
        ivol_rvol_ratio_z_1w_change = excluded.ivol_rvol_ratio_z_1w_change,
        ivol_rvol_ratio_z_1y_min = excluded.ivol_rvol_ratio_z_1y_min,
        ivol_rvol_ratio_z_1y_max = excluded.ivol_rvol_ratio_z_1y_max,
        rvol_20d = excluded.rvol_20d,
        rvol_bucket = excluded.rvol_bucket,
        close_above_ma20 = excluded.close_above_ma20,
        close_above_ma50 = excluded.close_above_ma50,
        close_above_ma200 = excluded.close_above_ma200,
        ma20_slope_20d = excluded.ma20_slope_20d,
        ma50_slope_20d = excluded.ma50_slope_20d,
        trend_regime = excluded.trend_regime,
        range_position_20d = excluded.range_position_20d,
        range_bucket = excluded.range_bucket,
        ivol_rvol_level = excluded.ivol_rvol_level,
        signal = excluded.signal,
        action = excluded.action,
        opportunity_score = excluded.opportunity_score,
        ivol_rvol_rank = excluded.ivol_rvol_rank,
        ivol_rvol_percentile = excluded.ivol_rvol_percentile,
        row_values = excluded.row_values,
        updated_at = now()`,
      params,
    };
  });
}

export async function upsertImpliedVolatilityRatioSignalRows(rows) {
  if (!rows.length) {
    return 0;
  }

  const statements = buildImpliedVolatilityRatioSignalUpsertStatements(rows);

  for (const statement of statements) {
    await query(statement.sql, statement.params);
  }

  return rows.length;
}

export async function getLatestImpliedVolatilityRatioSignalRows() {
  const result = await query(
    `with latest_snapshot as (
       select max(date) as date
       from implied_volatility_ratio_signals_daily
     )
     select
       s.date::text as date,
       s.asset_key,
       s.asset_name,
       s.asset_type,
       s.source_symbol,
       s.source_status,
       s.ivol_rvol_ratio_z_1y::text as ivol_rvol_ratio_z_1y,
       s.ivol_rvol_ratio_z_1w_ago::text as ivol_rvol_ratio_z_1w_ago,
       s.ivol_rvol_ratio_z_1y_min::text as ivol_rvol_ratio_z_1y_min,
       s.ivol_rvol_ratio_z_1y_max::text as ivol_rvol_ratio_z_1y_max,
       s.signal,
       s.action,
       s.rvol_20d::text as rvol_20d,
       s.trend_regime,
       s.range_position_20d::text as range_position_20d,
       s.ivol_rvol_rank,
       s.ivol_rvol_percentile::text as ivol_rvol_percentile
     from implied_volatility_ratio_signals_daily s
     join latest_snapshot snapshot
       on snapshot.date = s.date
     order by s.ivol_rvol_rank asc nulls last, s.asset_name asc`
  );

  return result.rows;
}
