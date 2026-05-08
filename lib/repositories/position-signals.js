import { query } from '../db.js';
import { chunkArray } from '../utils/chunk.js';
import { formatIndicatorValueForStorage } from '../utils/rolling-indicators.js';

const POSITION_SIGNAL_BATCH_SIZE = 100;

export function buildPositionSignalUpsertStatements(rows, batchSize = POSITION_SIGNAL_BATCH_SIZE) {
  return chunkArray(rows, batchSize).map((batch) => {
    const params = [];
    const values = batch.map((row, index) => {
      const base = index * 17;
      params.push(
        row.date,
        row.signal,
        row.decision,
        formatIndicatorValueForStorage(row.target_equity_weight_pct),
        formatIndicatorValueForStorage(row.target_cash_weight_pct),
        row.raw_signal,
        row.raw_decision,
        formatIndicatorValueForStorage(row.raw_target_equity_weight_pct),
        formatIndicatorValueForStorage(row.raw_target_cash_weight_pct),
        row.market_signal,
        formatIndicatorValueForStorage(row.market_regime_score),
        row.caution_count,
        row.hard_risk_off_count,
        row.reason_summary ?? null,
        row.persistence_direction,
        row.persistence_streak_days,
        row.persistence_required_days
      );

      return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7}, $${base + 8}, $${base + 9}, $${base + 10}, $${base + 11}, $${base + 12}, $${base + 13}, $${base + 14}, $${base + 15}, $${base + 16}, $${base + 17}, now())`;
    });

    return {
      sql: `insert into position_signal_daily (
        date, signal, decision, target_equity_weight_pct, target_cash_weight_pct, raw_signal,
        raw_decision, raw_target_equity_weight_pct, raw_target_cash_weight_pct, market_signal,
        market_regime_score, caution_count, hard_risk_off_count, reason_summary,
        persistence_direction, persistence_streak_days, persistence_required_days, updated_at
      ) values ${values.join(', ')}
      on conflict (date) do update set
        signal = excluded.signal,
        decision = excluded.decision,
        target_equity_weight_pct = excluded.target_equity_weight_pct,
        target_cash_weight_pct = excluded.target_cash_weight_pct,
        raw_signal = excluded.raw_signal,
        raw_decision = excluded.raw_decision,
        raw_target_equity_weight_pct = excluded.raw_target_equity_weight_pct,
        raw_target_cash_weight_pct = excluded.raw_target_cash_weight_pct,
        market_signal = excluded.market_signal,
        market_regime_score = excluded.market_regime_score,
        caution_count = excluded.caution_count,
        hard_risk_off_count = excluded.hard_risk_off_count,
        reason_summary = excluded.reason_summary,
        persistence_direction = excluded.persistence_direction,
        persistence_streak_days = excluded.persistence_streak_days,
        persistence_required_days = excluded.persistence_required_days,
        updated_at = now()`,
      params,
    };
  });
}

export async function getPositionSignalSourceRows() {
  const [positionFactResult, marketSignalResult] = await Promise.all([
    query(
      `select
         date::text as date,
         sp500_trend_regime,
         vix_regime,
         credit_regime,
         yield_curve_regime,
         fed_policy_trend,
         labor_trend,
         inflation_trend,
         sentiment_trend
       from position_facts_daily
       order by date asc`
    ),
    query(
      `select
         date::text as date,
         market_regime_score::text as market_regime_score,
         signal
       from market_signal_daily
       order by date asc`
    ),
  ]);

  return {
    positionFactRows: positionFactResult.rows,
    marketSignalRows: marketSignalResult.rows,
  };
}

export async function upsertPositionSignals(rows) {
  if (!rows.length) {
    return 0;
  }

  const statements = buildPositionSignalUpsertStatements(rows);

  for (const statement of statements) {
    await query(statement.sql, statement.params);
  }

  return rows.length;
}

export async function getPositionSignalRows() {
  const result = await query(
    `select
       date::text as date,
       signal,
       decision,
       target_equity_weight_pct::text as target_equity_weight_pct,
       target_cash_weight_pct::text as target_cash_weight_pct,
       raw_signal,
       raw_decision,
       raw_target_equity_weight_pct::text as raw_target_equity_weight_pct,
       raw_target_cash_weight_pct::text as raw_target_cash_weight_pct,
       market_signal,
       market_regime_score::text as market_regime_score,
       caution_count,
       hard_risk_off_count,
       reason_summary,
       persistence_direction,
       persistence_streak_days,
       persistence_required_days
     from position_signal_daily
     order by date asc`
  );

  return result.rows;
}
