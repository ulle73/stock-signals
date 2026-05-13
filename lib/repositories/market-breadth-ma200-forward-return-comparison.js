import { query } from '../db.js';

const STATIC_SELECT = `
  s.date::text as static_date,
  s.ma200_breadth_pct::text as static_ma200_breadth_pct,
  s.ma200_breadth_bucket as static_ma200_breadth_bucket,
  s.ma200_breadth_signal as static_ma200_breadth_signal,
  s.ma200_breadth_action as static_ma200_breadth_action,
  s.ma200_breadth_confidence as static_ma200_breadth_confidence,
  s.ma200_breadth_warning as static_ma200_breadth_warning,
  s.ma200_expected_return_5d::text as static_ma200_expected_return_5d,
  s.ma200_expected_return_10d::text as static_ma200_expected_return_10d,
  s.ma200_expected_return_1m::text as static_ma200_expected_return_1m,
  s.ma200_expected_return_3m::text as static_ma200_expected_return_3m,
  s.ma200_expected_return_6m::text as static_ma200_expected_return_6m,
  s.ma200_expected_return_12m::text as static_ma200_expected_return_12m,
  s.ma200_win_ratio_5d::text as static_ma200_win_ratio_5d,
  s.ma200_win_ratio_10d::text as static_ma200_win_ratio_10d,
  s.ma200_win_ratio_1m::text as static_ma200_win_ratio_1m,
  s.ma200_win_ratio_3m::text as static_ma200_win_ratio_3m,
  s.ma200_win_ratio_6m::text as static_ma200_win_ratio_6m,
  s.ma200_win_ratio_12m::text as static_ma200_win_ratio_12m,
  s.ma200_forward_model_version as static_ma200_forward_model_version
`;

const EMPIRICAL_SELECT = `
  e.benchmark_symbol,
  e.date::text as empirical_date,
  e.ma200_breadth_pct::text as empirical_ma200_breadth_pct,
  e.ma200_breadth_bucket as empirical_ma200_breadth_bucket,
  e.ma200_empirical_sample_count_5d,
  e.ma200_empirical_sample_count_10d,
  e.ma200_empirical_sample_count_1m,
  e.ma200_empirical_sample_count_3m,
  e.ma200_empirical_sample_count_6m,
  e.ma200_empirical_sample_count_12m,
  e.ma200_empirical_expected_return_5d::text as empirical_ma200_expected_return_5d,
  e.ma200_empirical_expected_return_10d::text as empirical_ma200_expected_return_10d,
  e.ma200_empirical_expected_return_1m::text as empirical_ma200_expected_return_1m,
  e.ma200_empirical_expected_return_3m::text as empirical_ma200_expected_return_3m,
  e.ma200_empirical_expected_return_6m::text as empirical_ma200_expected_return_6m,
  e.ma200_empirical_expected_return_12m::text as empirical_ma200_expected_return_12m,
  e.ma200_empirical_win_ratio_5d::text as empirical_ma200_empirical_win_ratio_5d,
  e.ma200_empirical_win_ratio_10d::text as empirical_ma200_empirical_win_ratio_10d,
  e.ma200_empirical_win_ratio_1m::text as empirical_ma200_empirical_win_ratio_1m,
  e.ma200_empirical_win_ratio_3m::text as empirical_ma200_empirical_win_ratio_3m,
  e.ma200_empirical_win_ratio_6m::text as empirical_ma200_empirical_win_ratio_6m,
  e.ma200_empirical_win_ratio_12m::text as empirical_ma200_empirical_win_ratio_12m,
  e.ma200_forward_model_version as empirical_ma200_forward_model_version
`;

function mapJoinedRow(row) {
  if (!row) {
    return null;
  }

  return {
    staticRow: {
      date: row.static_date,
      ma200_breadth_pct: row.static_ma200_breadth_pct,
      ma200_breadth_bucket: row.static_ma200_breadth_bucket,
      ma200_breadth_signal: row.static_ma200_breadth_signal,
      ma200_breadth_action: row.static_ma200_breadth_action,
      ma200_breadth_confidence: row.static_ma200_breadth_confidence,
      ma200_breadth_warning: row.static_ma200_breadth_warning,
      ma200_expected_return_5d: row.static_ma200_expected_return_5d,
      ma200_expected_return_10d: row.static_ma200_expected_return_10d,
      ma200_expected_return_1m: row.static_ma200_expected_return_1m,
      ma200_expected_return_3m: row.static_ma200_expected_return_3m,
      ma200_expected_return_6m: row.static_ma200_expected_return_6m,
      ma200_expected_return_12m: row.static_ma200_expected_return_12m,
      ma200_win_ratio_5d: row.static_ma200_win_ratio_5d,
      ma200_win_ratio_10d: row.static_ma200_win_ratio_10d,
      ma200_win_ratio_1m: row.static_ma200_win_ratio_1m,
      ma200_win_ratio_3m: row.static_ma200_win_ratio_3m,
      ma200_win_ratio_6m: row.static_ma200_win_ratio_6m,
      ma200_win_ratio_12m: row.static_ma200_win_ratio_12m,
      ma200_forward_model_version: row.static_ma200_forward_model_version,
    },
    empiricalRow: {
      benchmark_symbol: row.benchmark_symbol,
      date: row.empirical_date,
      ma200_breadth_pct: row.empirical_ma200_breadth_pct,
      ma200_breadth_bucket: row.empirical_ma200_breadth_bucket,
      ma200_empirical_sample_count_5d: row.ma200_empirical_sample_count_5d,
      ma200_empirical_sample_count_10d: row.ma200_empirical_sample_count_10d,
      ma200_empirical_sample_count_1m: row.ma200_empirical_sample_count_1m,
      ma200_empirical_sample_count_3m: row.ma200_empirical_sample_count_3m,
      ma200_empirical_sample_count_6m: row.ma200_empirical_sample_count_6m,
      ma200_empirical_sample_count_12m: row.ma200_empirical_sample_count_12m,
      ma200_empirical_expected_return_5d: row.empirical_ma200_expected_return_5d,
      ma200_empirical_expected_return_10d: row.empirical_ma200_expected_return_10d,
      ma200_empirical_expected_return_1m: row.empirical_ma200_expected_return_1m,
      ma200_empirical_expected_return_3m: row.empirical_ma200_expected_return_3m,
      ma200_empirical_expected_return_6m: row.empirical_ma200_expected_return_6m,
      ma200_empirical_expected_return_12m: row.empirical_ma200_expected_return_12m,
      ma200_empirical_win_ratio_5d: row.empirical_ma200_empirical_win_ratio_5d,
      ma200_empirical_win_ratio_10d: row.empirical_ma200_empirical_win_ratio_10d,
      ma200_empirical_win_ratio_1m: row.empirical_ma200_empirical_win_ratio_1m,
      ma200_empirical_win_ratio_3m: row.empirical_ma200_empirical_win_ratio_3m,
      ma200_empirical_win_ratio_6m: row.empirical_ma200_empirical_win_ratio_6m,
      ma200_empirical_win_ratio_12m: row.empirical_ma200_empirical_win_ratio_12m,
      ma200_forward_model_version: row.empirical_ma200_forward_model_version,
    },
  };
}

export async function getLatestMarketBreadthForwardReturnComparisonSnapshot(benchmarkSymbol = 'SPY') {
  const result = await query(
    `select
       ${STATIC_SELECT},
       ${EMPIRICAL_SELECT}
     from market_breadth_ma200_forward_return_signal_daily s
     join market_breadth_ma200_forward_return_empirical_daily e
       on e.date = s.date
      and e.benchmark_symbol = $1
     order by s.date desc
     limit 1`,
    [benchmarkSymbol]
  );

  return mapJoinedRow(result.rows[0] ?? null);
}
