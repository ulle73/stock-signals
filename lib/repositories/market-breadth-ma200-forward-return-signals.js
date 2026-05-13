import { query } from '../db.js';
import { chunkArray } from '../utils/chunk.js';
import { formatIndicatorValueForStorage } from '../utils/rolling-indicators.js';

const MA200_BREADTH_SIGNAL_BATCH_SIZE = 100;

export function buildMa200BreadthForwardReturnSignalUpsertStatements(rows, batchSize = MA200_BREADTH_SIGNAL_BATCH_SIZE) {
  return chunkArray(rows, batchSize).map((batch) => {
    const params = [];
    const values = batch.map((row, index) => {
      const base = index * 24;
      params.push(
        row.date,
        formatIndicatorValueForStorage(row.ma200_breadth_pct),
        row.ma200_breadth_bucket,
        formatIndicatorValueForStorage(row.ma200_breadth_5d_change),
        formatIndicatorValueForStorage(row.ma200_breadth_10d_change),
        formatIndicatorValueForStorage(row.ma200_breadth_20d_change),
        formatIndicatorValueForStorage(row.ma200_breadth_50d_change),
        row.ma200_breadth_signal,
        row.ma200_breadth_action,
        row.ma200_breadth_confidence,
        row.ma200_breadth_warning,
        formatIndicatorValueForStorage(row.ma200_expected_return_5d),
        formatIndicatorValueForStorage(row.ma200_expected_return_10d),
        formatIndicatorValueForStorage(row.ma200_expected_return_1m),
        formatIndicatorValueForStorage(row.ma200_expected_return_3m),
        formatIndicatorValueForStorage(row.ma200_expected_return_6m),
        formatIndicatorValueForStorage(row.ma200_expected_return_12m),
        formatIndicatorValueForStorage(row.ma200_win_ratio_5d),
        formatIndicatorValueForStorage(row.ma200_win_ratio_10d),
        formatIndicatorValueForStorage(row.ma200_win_ratio_1m),
        formatIndicatorValueForStorage(row.ma200_win_ratio_3m),
        formatIndicatorValueForStorage(row.ma200_win_ratio_6m),
        formatIndicatorValueForStorage(row.ma200_win_ratio_12m),
        row.ma200_forward_model_version
      );

      return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7}, $${base + 8}, $${base + 9}, $${base + 10}, $${base + 11}, $${base + 12}, $${base + 13}, $${base + 14}, $${base + 15}, $${base + 16}, $${base + 17}, $${base + 18}, $${base + 19}, $${base + 20}, $${base + 21}, $${base + 22}, $${base + 23}, $${base + 24}, now())`;
    });

    return {
      sql: `insert into market_breadth_ma200_forward_return_signal_daily (
        date, ma200_breadth_pct, ma200_breadth_bucket, ma200_breadth_5d_change, ma200_breadth_10d_change,
        ma200_breadth_20d_change, ma200_breadth_50d_change, ma200_breadth_signal, ma200_breadth_action,
        ma200_breadth_confidence, ma200_breadth_warning, ma200_expected_return_5d, ma200_expected_return_10d,
        ma200_expected_return_1m, ma200_expected_return_3m, ma200_expected_return_6m, ma200_expected_return_12m,
        ma200_win_ratio_5d, ma200_win_ratio_10d, ma200_win_ratio_1m, ma200_win_ratio_3m, ma200_win_ratio_6m,
        ma200_win_ratio_12m, ma200_forward_model_version, updated_at
      ) values ${values.join(', ')}
      on conflict (date) do update set
        ma200_breadth_pct = excluded.ma200_breadth_pct,
        ma200_breadth_bucket = excluded.ma200_breadth_bucket,
        ma200_breadth_5d_change = excluded.ma200_breadth_5d_change,
        ma200_breadth_10d_change = excluded.ma200_breadth_10d_change,
        ma200_breadth_20d_change = excluded.ma200_breadth_20d_change,
        ma200_breadth_50d_change = excluded.ma200_breadth_50d_change,
        ma200_breadth_signal = excluded.ma200_breadth_signal,
        ma200_breadth_action = excluded.ma200_breadth_action,
        ma200_breadth_confidence = excluded.ma200_breadth_confidence,
        ma200_breadth_warning = excluded.ma200_breadth_warning,
        ma200_expected_return_5d = excluded.ma200_expected_return_5d,
        ma200_expected_return_10d = excluded.ma200_expected_return_10d,
        ma200_expected_return_1m = excluded.ma200_expected_return_1m,
        ma200_expected_return_3m = excluded.ma200_expected_return_3m,
        ma200_expected_return_6m = excluded.ma200_expected_return_6m,
        ma200_expected_return_12m = excluded.ma200_expected_return_12m,
        ma200_win_ratio_5d = excluded.ma200_win_ratio_5d,
        ma200_win_ratio_10d = excluded.ma200_win_ratio_10d,
        ma200_win_ratio_1m = excluded.ma200_win_ratio_1m,
        ma200_win_ratio_3m = excluded.ma200_win_ratio_3m,
        ma200_win_ratio_6m = excluded.ma200_win_ratio_6m,
        ma200_win_ratio_12m = excluded.ma200_win_ratio_12m,
        ma200_forward_model_version = excluded.ma200_forward_model_version,
        updated_at = now()`,
      params,
    };
  });
}

export async function upsertMa200BreadthForwardReturnSignalRows(rows) {
  if (!rows.length) return 0;

  const statements = buildMa200BreadthForwardReturnSignalUpsertStatements(rows);

  for (const statement of statements) {
    await query(statement.sql, statement.params);
  }

  return rows.length;
}

export async function getMarketBreadthSourceRows() {
  const result = await query(
    `select
       date::text as date,
       pct_above_sma200::text as pct_above_sma200,
       is_valid_signal_date
     from market_breadth_daily
     order by date asc`
  );

  return result.rows;
}
