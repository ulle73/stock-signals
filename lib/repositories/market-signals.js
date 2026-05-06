import { query } from '../db.js';
import { chunkArray } from '../utils/chunk.js';
import { formatIndicatorValueForStorage } from '../utils/rolling-indicators.js';

const MARKET_SIGNAL_BATCH_SIZE = 100;
const SIGNAL_VALUE_FIELDS = [
  'spx_close',
  'spx_3d_change',
  'spx_14d_change',
  'pct_above_50',
  'pct_above_50_3d_change',
  'pct_above_50_14d_change',
  'pct_above_200',
  'pct_above_200_14d_change',
  'ad_line',
  'ad_line_14d_change',
];

export function buildMarketSignalUpsertStatements(rows, batchSize = MARKET_SIGNAL_BATCH_SIZE) {
  return chunkArray(rows, batchSize).map((batch) => {
    const params = [];
    const values = batch.map((row, index) => {
      const base = index * 18;
      params.push(
        row.date,
        ...SIGNAL_VALUE_FIELDS.map((field) => formatIndicatorValueForStorage(row[field])),
        row.new_highs,
        row.new_lows,
        formatIndicatorValueForStorage(row.vix),
        formatIndicatorValueForStorage(row.market_regime_score),
        row.signal,
        row.divergence_status,
        row.short_divergence_status
      );

      return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7}, $${base + 8}, $${base + 9}, $${base + 10}, $${base + 11}, $${base + 12}, $${base + 13}, $${base + 14}, $${base + 15}, $${base + 16}, $${base + 17}, $${base + 18}, now())`;
    });

    return {
      sql: `insert into market_signal_daily (
        date, spx_close, spx_3d_change, spx_14d_change, pct_above_50, pct_above_50_3d_change,
        pct_above_50_14d_change, pct_above_200, pct_above_200_14d_change, ad_line, ad_line_14d_change,
        new_highs, new_lows, vix, market_regime_score, signal, divergence_status, short_divergence_status, updated_at
      ) values ${values.join(', ')}
      on conflict (date) do update set
        spx_close = excluded.spx_close,
        spx_3d_change = excluded.spx_3d_change,
        spx_14d_change = excluded.spx_14d_change,
        pct_above_50 = excluded.pct_above_50,
        pct_above_50_3d_change = excluded.pct_above_50_3d_change,
        pct_above_50_14d_change = excluded.pct_above_50_14d_change,
        pct_above_200 = excluded.pct_above_200,
        pct_above_200_14d_change = excluded.pct_above_200_14d_change,
        ad_line = excluded.ad_line,
        ad_line_14d_change = excluded.ad_line_14d_change,
        new_highs = excluded.new_highs,
        new_lows = excluded.new_lows,
        vix = excluded.vix,
        market_regime_score = excluded.market_regime_score,
        signal = excluded.signal,
        divergence_status = excluded.divergence_status,
        short_divergence_status = excluded.short_divergence_status,
        updated_at = now()`,
      params,
    };
  });
}

export async function upsertMarketSignals(rows) {
  if (!rows.length) return 0;

  const statements = buildMarketSignalUpsertStatements(rows);

  for (const statement of statements) {
    await query(statement.sql, statement.params);
  }

  return rows.length;
}

export async function getMarketSignalSourceRows() {
  const breadthResult = await query(
    `select
       date::text as date,
       pct_above_sma50::text as pct_above_sma50,
       pct_above_sma200::text as pct_above_sma200,
       advancers,
       decliners,
       new_highs_52w,
       new_lows_52w,
       is_valid_signal_date
     from market_breadth_daily
     order by date asc`
  );

  const seriesResult = await query(
    `select series_id, date::text as date, value::text as value
     from market_series_daily
     where series_id in ('SP500', 'VIXCLS')
     order by date asc`
  );

  const breadthRows = breadthResult.rows;
  const spxRows = [];
  const vixRows = [];

  for (const row of seriesResult.rows) {
    if (row.series_id === 'SP500') {
      spxRows.push(row);
    } else if (row.series_id === 'VIXCLS') {
      vixRows.push(row);
    }
  }

  return {
    breadthRows,
    spxRows,
    vixRows,
  };
}
