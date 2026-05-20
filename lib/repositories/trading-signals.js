import { query } from '../db.js';
import { chunkArray } from '../utils/chunk.js';
import { formatIndicatorValueForStorage } from '../utils/rolling-indicators.js';

const TRADING_SIGNAL_BATCH_SIZE = 100;

const TRADING_SIGNAL_FIELDS = [
  'date',
  'setup',
  'decision',
  'previous_state',
  'target_state',
  'trigger_count',
  'market_regime_score',
  'reason_summary',
  'historical_edge_fingerprint',
  'historical_edge_direction',
  'historical_edge_score',
  'markov_state',
  'markov_bull_probability',
  'markov_sideways_probability',
  'markov_bear_probability',
  'markov_edge',
  'markov_stickiness',
  'markov_sample_size',
  'forward_5d_avg_return',
  'forward_5d_win_rate',
  'forward_20d_avg_return',
  'forward_20d_win_rate',
  'forward_sample_size',
  'state_duration_days',
  'state_duration_percentile',
  'state_exhaustion_risk',
];

const NUMERIC_FIELDS = new Set([
  'market_regime_score',
  'historical_edge_score',
  'markov_bull_probability',
  'markov_sideways_probability',
  'markov_bear_probability',
  'markov_edge',
  'markov_stickiness',
  'forward_5d_avg_return',
  'forward_5d_win_rate',
  'forward_20d_avg_return',
  'forward_20d_win_rate',
  'state_duration_percentile',
]);

function formatFieldValue(row, field) {
  if (NUMERIC_FIELDS.has(field)) {
    return formatIndicatorValueForStorage(row[field]);
  }

  return row[field] ?? null;
}

export function buildTradingSignalUpsertStatements(rows, batchSize = TRADING_SIGNAL_BATCH_SIZE) {
  return chunkArray(rows, batchSize).map((batch) => {
    const params = [];
    const values = batch.map((row, index) => {
      const base = index * TRADING_SIGNAL_FIELDS.length;
      params.push(...TRADING_SIGNAL_FIELDS.map((field) => formatFieldValue(row, field)));

      return `(${TRADING_SIGNAL_FIELDS.map((_, fieldIndex) => `$${base + fieldIndex + 1}`).join(', ')}, now())`;
    });

    return {
      sql: `insert into trading_signal_daily (
        ${TRADING_SIGNAL_FIELDS.join(', ')}, updated_at
      ) values ${values.join(', ')}
      on conflict (date) do update set
        ${TRADING_SIGNAL_FIELDS.filter((field) => field !== 'date').map((field) => `${field} = excluded.${field}`).join(',\n        ')},
        updated_at = now()`,
      params,
    };
  });
}

export async function getTradingSignalSourceRows() {
  const result = await query(
    `select
       ms.date::text as date,
       ms.spx_close::text as spx_close,
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
       reason_summary,
       historical_edge_fingerprint,
       historical_edge_direction,
       historical_edge_score::text as historical_edge_score,
       markov_state,
       markov_bull_probability::text as markov_bull_probability,
       markov_sideways_probability::text as markov_sideways_probability,
       markov_bear_probability::text as markov_bear_probability,
       markov_edge::text as markov_edge,
       markov_stickiness::text as markov_stickiness,
       markov_sample_size,
       forward_5d_avg_return::text as forward_5d_avg_return,
       forward_5d_win_rate::text as forward_5d_win_rate,
       forward_20d_avg_return::text as forward_20d_avg_return,
       forward_20d_win_rate::text as forward_20d_win_rate,
       forward_sample_size,
       state_duration_days,
       state_duration_percentile::text as state_duration_percentile,
       state_exhaustion_risk
     from trading_signal_daily
     order by date asc`
  );

  return result.rows;
}

export async function getLatestTradingSignalRow() {
  const result = await query(
    `select
       date::text as date,
       setup,
       decision,
       previous_state,
       target_state,
       trigger_count,
       market_regime_score::text as market_regime_score,
       reason_summary,
       historical_edge_fingerprint,
       historical_edge_direction,
       historical_edge_score::text as historical_edge_score,
       markov_state,
       markov_bull_probability::text as markov_bull_probability,
       markov_sideways_probability::text as markov_sideways_probability,
       markov_bear_probability::text as markov_bear_probability,
       markov_edge::text as markov_edge,
       markov_stickiness::text as markov_stickiness,
       markov_sample_size,
       forward_5d_avg_return::text as forward_5d_avg_return,
       forward_5d_win_rate::text as forward_5d_win_rate,
       forward_20d_avg_return::text as forward_20d_avg_return,
       forward_20d_win_rate::text as forward_20d_win_rate,
       forward_sample_size,
       state_duration_days,
       state_duration_percentile::text as state_duration_percentile,
       state_exhaustion_risk
     from trading_signal_daily
     order by date desc
     limit 1`
  );

  return result.rows[0] ?? null;
}
