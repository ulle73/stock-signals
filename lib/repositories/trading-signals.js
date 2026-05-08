import { query } from '../db.js';
import { chunkArray } from '../utils/chunk.js';
import { formatIndicatorValueForStorage } from '../utils/rolling-indicators.js';

const TRADING_SIGNAL_BATCH_SIZE = 100;

export function buildTradingSignalUpsertStatements(rows, batchSize = TRADING_SIGNAL_BATCH_SIZE) {
  return chunkArray(rows, batchSize).map((batch) => {
    const params = [];
    const values = batch.map((row, index) => {
      const base = index * 8;
      params.push(
        row.date,
        row.setup,
        row.decision,
        row.previous_state,
        row.target_state,
        row.trigger_count,
        formatIndicatorValueForStorage(row.market_regime_score),
        row.reason_summary ?? null
      );

      return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7}, $${base + 8}, now())`;
    });

    return {
      sql: `insert into trading_signal_daily (
        date, setup, decision, previous_state, target_state, trigger_count,
        market_regime_score, reason_summary, updated_at
      ) values ${values.join(', ')}
      on conflict (date) do update set
        setup = excluded.setup,
        decision = excluded.decision,
        previous_state = excluded.previous_state,
        target_state = excluded.target_state,
        trigger_count = excluded.trigger_count,
        market_regime_score = excluded.market_regime_score,
        reason_summary = excluded.reason_summary,
        updated_at = now()`,
      params,
    };
  });
}

export async function getTradingSignalSourceRows() {
  const result = await query(
    `select
       ms.date::text as date,
       ms.pct_above_50::text as pct_above_50,
       ms.pct_above_200::text as pct_above_200,
       ms.spx_3d_change::text as spx_3d_change,
       ms.spx_14d_change::text as spx_14d_change,
       ms.ad_line_14d_change::text as ad_line_14d_change,
       mb.advancers,
       mb.decliners,
       ms.vix::text as vix,
       ms.market_regime_score::text as market_regime_score,
       ms.divergence_status,
       ms.short_divergence_status
     from market_signal_daily ms
     join market_breadth_daily mb
       on mb.date = ms.date
     order by ms.date asc`
  );

  return {
    marketSignalRows: result.rows,
  };
}

export async function upsertTradingSignals(rows) {
  if (!rows.length) {
    return 0;
  }

  const statements = buildTradingSignalUpsertStatements(rows);
  for (const statement of statements) {
    await query(statement.sql, statement.params);
  }

  return rows.length;
}

export async function getTradingSignalRows() {
  const result = await query(
    `select
       date::text as date,
       setup,
       decision,
       previous_state,
       target_state,
       trigger_count,
       market_regime_score::text as market_regime_score,
       reason_summary
     from trading_signal_daily
     order by date asc`
  );

  return result.rows;
}
