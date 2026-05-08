import { query } from '../db.js';
import { chunkArray } from '../utils/chunk.js';
import { formatIndicatorValueForStorage } from '../utils/rolling-indicators.js';

const SWING_SIGNAL_BATCH_SIZE = 100;

export function buildSwingSignalUpsertStatements(rows, batchSize = SWING_SIGNAL_BATCH_SIZE) {
  return chunkArray(rows, batchSize).map((batch) => {
    const params = [];
    const values = batch.map((row, index) => {
      const base = index * 14;
      params.push(
        row.date,
        row.setup,
        row.decision,
        row.previous_state,
        row.target_state,
        row.active_sector_count,
        row.leading_sector_count,
        row.improving_sector_count,
        row.weakening_sector_count,
        row.lagging_sector_count,
        row.mixed_sector_count,
        row.market_signal,
        formatIndicatorValueForStorage(row.market_regime_score),
        row.reason_summary ?? null
      );

      return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7}, $${base + 8}, $${base + 9}, $${base + 10}, $${base + 11}, $${base + 12}, $${base + 13}, $${base + 14}, now())`;
    });

    return {
      sql: `insert into swing_signal_daily (
        date, setup, decision, previous_state, target_state, active_sector_count,
        leading_sector_count, improving_sector_count, weakening_sector_count,
        lagging_sector_count, mixed_sector_count, market_signal, market_regime_score,
        reason_summary, updated_at
      ) values ${values.join(', ')}
      on conflict (date) do update set
        setup = excluded.setup,
        decision = excluded.decision,
        previous_state = excluded.previous_state,
        target_state = excluded.target_state,
        active_sector_count = excluded.active_sector_count,
        leading_sector_count = excluded.leading_sector_count,
        improving_sector_count = excluded.improving_sector_count,
        weakening_sector_count = excluded.weakening_sector_count,
        lagging_sector_count = excluded.lagging_sector_count,
        mixed_sector_count = excluded.mixed_sector_count,
        market_signal = excluded.market_signal,
        market_regime_score = excluded.market_regime_score,
        reason_summary = excluded.reason_summary,
        updated_at = now()`,
      params,
    };
  });
}

export async function getSwingSignalSourceRows() {
  const [sectorSignalResult, marketSignalResult] = await Promise.all([
    query(
      `select
         date::text as date,
         sector,
         signal
       from sector_signal_daily
       order by date asc, sector asc`
    ),
    query(
      `select
         date::text as date,
         signal,
         market_regime_score::text as market_regime_score
       from market_signal_daily
       order by date asc`
    ),
  ]);

  return {
    sectorSignalRows: sectorSignalResult.rows,
    marketSignalRows: marketSignalResult.rows,
  };
}

export async function upsertSwingSignals(rows) {
  if (!rows.length) {
    return 0;
  }

  const statements = buildSwingSignalUpsertStatements(rows);

  for (const statement of statements) {
    await query(statement.sql, statement.params);
  }

  return rows.length;
}

export async function getSwingSignalRows() {
  const result = await query(
    `select
       date::text as date,
       setup,
       decision,
       previous_state,
       target_state,
       active_sector_count,
       leading_sector_count,
       improving_sector_count,
       weakening_sector_count,
       lagging_sector_count,
       mixed_sector_count,
       market_signal,
       market_regime_score::text as market_regime_score,
       reason_summary
     from swing_signal_daily
     order by date asc`
  );

  return result.rows;
}
