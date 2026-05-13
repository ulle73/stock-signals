import { query } from '../db.js';
import { chunkArray } from '../utils/chunk.js';
import { formatIndicatorValueForStorage } from '../utils/rolling-indicators.js';

const MA200_BREADTH_EMPIRICAL_BATCH_SIZE = 100;

export function buildMa200BreadthForwardReturnEmpiricalUpsertStatements(rows, batchSize = MA200_BREADTH_EMPIRICAL_BATCH_SIZE) {
  return chunkArray(rows, batchSize).map((batch) => {
    const params = [];
    const values = batch.map((row, index) => {
      const base = index * 23;
      params.push(
        row.date,
        row.benchmark_symbol,
        formatIndicatorValueForStorage(row.ma200_breadth_pct),
        row.ma200_breadth_bucket,
        row.ma200_empirical_sample_count_5d,
        row.ma200_empirical_sample_count_10d,
        row.ma200_empirical_sample_count_1m,
        row.ma200_empirical_sample_count_3m,
        row.ma200_empirical_sample_count_6m,
        row.ma200_empirical_sample_count_12m,
        formatIndicatorValueForStorage(row.ma200_empirical_expected_return_5d),
        formatIndicatorValueForStorage(row.ma200_empirical_expected_return_10d),
        formatIndicatorValueForStorage(row.ma200_empirical_expected_return_1m),
        formatIndicatorValueForStorage(row.ma200_empirical_expected_return_3m),
        formatIndicatorValueForStorage(row.ma200_empirical_expected_return_6m),
        formatIndicatorValueForStorage(row.ma200_empirical_expected_return_12m),
        formatIndicatorValueForStorage(row.ma200_empirical_win_ratio_5d),
        formatIndicatorValueForStorage(row.ma200_empirical_win_ratio_10d),
        formatIndicatorValueForStorage(row.ma200_empirical_win_ratio_1m),
        formatIndicatorValueForStorage(row.ma200_empirical_win_ratio_3m),
        formatIndicatorValueForStorage(row.ma200_empirical_win_ratio_6m),
        formatIndicatorValueForStorage(row.ma200_empirical_win_ratio_12m),
        row.ma200_forward_model_version
      );

      return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7}, $${base + 8}, $${base + 9}, $${base + 10}, $${base + 11}, $${base + 12}, $${base + 13}, $${base + 14}, $${base + 15}, $${base + 16}, $${base + 17}, $${base + 18}, $${base + 19}, $${base + 20}, $${base + 21}, $${base + 22}, $${base + 23}, now())`;
    });

    return {
      sql: `insert into market_breadth_ma200_forward_return_empirical_daily (
        date, benchmark_symbol, ma200_breadth_pct, ma200_breadth_bucket, ma200_empirical_sample_count_5d,
        ma200_empirical_sample_count_10d, ma200_empirical_sample_count_1m, ma200_empirical_sample_count_3m,
        ma200_empirical_sample_count_6m, ma200_empirical_sample_count_12m, ma200_empirical_expected_return_5d,
        ma200_empirical_expected_return_10d, ma200_empirical_expected_return_1m, ma200_empirical_expected_return_3m,
        ma200_empirical_expected_return_6m, ma200_empirical_expected_return_12m, ma200_empirical_win_ratio_5d,
        ma200_empirical_win_ratio_10d, ma200_empirical_win_ratio_1m, ma200_empirical_win_ratio_3m,
        ma200_empirical_win_ratio_6m, ma200_empirical_win_ratio_12m, ma200_forward_model_version, updated_at
      ) values ${values.join(', ')}
      on conflict (benchmark_symbol, date) do update set
        ma200_breadth_pct = excluded.ma200_breadth_pct,
        ma200_breadth_bucket = excluded.ma200_breadth_bucket,
        ma200_empirical_sample_count_5d = excluded.ma200_empirical_sample_count_5d,
        ma200_empirical_sample_count_10d = excluded.ma200_empirical_sample_count_10d,
        ma200_empirical_sample_count_1m = excluded.ma200_empirical_sample_count_1m,
        ma200_empirical_sample_count_3m = excluded.ma200_empirical_sample_count_3m,
        ma200_empirical_sample_count_6m = excluded.ma200_empirical_sample_count_6m,
        ma200_empirical_sample_count_12m = excluded.ma200_empirical_sample_count_12m,
        ma200_empirical_expected_return_5d = excluded.ma200_empirical_expected_return_5d,
        ma200_empirical_expected_return_10d = excluded.ma200_empirical_expected_return_10d,
        ma200_empirical_expected_return_1m = excluded.ma200_empirical_expected_return_1m,
        ma200_empirical_expected_return_3m = excluded.ma200_empirical_expected_return_3m,
        ma200_empirical_expected_return_6m = excluded.ma200_empirical_expected_return_6m,
        ma200_empirical_expected_return_12m = excluded.ma200_empirical_expected_return_12m,
        ma200_empirical_win_ratio_5d = excluded.ma200_empirical_win_ratio_5d,
        ma200_empirical_win_ratio_10d = excluded.ma200_empirical_win_ratio_10d,
        ma200_empirical_win_ratio_1m = excluded.ma200_empirical_win_ratio_1m,
        ma200_empirical_win_ratio_3m = excluded.ma200_empirical_win_ratio_3m,
        ma200_empirical_win_ratio_6m = excluded.ma200_empirical_win_ratio_6m,
        ma200_empirical_win_ratio_12m = excluded.ma200_empirical_win_ratio_12m,
        ma200_forward_model_version = excluded.ma200_forward_model_version,
        updated_at = now()`,
      params,
    };
  });
}

export async function upsertMa200BreadthForwardReturnEmpiricalRows(rows) {
  if (!rows.length) return 0;

  const statements = buildMa200BreadthForwardReturnEmpiricalUpsertStatements(rows);

  for (const statement of statements) {
    await query(statement.sql, statement.params);
  }

  return rows.length;
}
