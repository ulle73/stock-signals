import { getPool, query } from '../db.js';
import { chunkArray } from '../utils/chunk.js';
import { formatIndicatorValueForStorage } from '../utils/rolling-indicators.js';

const SWING_WATCHLIST_BATCH_SIZE = 100;

export function buildSwingWatchlistUpsertStatements(rows, batchSize = SWING_WATCHLIST_BATCH_SIZE) {
  return chunkArray(rows, batchSize).map((batch) => {
    const params = [];
    const values = batch.map((row, index) => {
      const base = index * 19;
      params.push(
        row.date,
        row.bias,
        row.rank_in_bias,
        row.ticker,
        row.sector,
        row.sector_signal,
        row.swing_setup,
        row.swing_decision,
        row.playbook,
        row.is_actionable,
        formatIndicatorValueForStorage(row.watchlist_score),
        formatIndicatorValueForStorage(row.indicator_price),
        formatIndicatorValueForStorage(row.daily_return_pct),
        formatIndicatorValueForStorage(row.relative_volume20),
        formatIndicatorValueForStorage(row.pct_from_52w_high),
        formatIndicatorValueForStorage(row.pct_from_52w_low),
        formatIndicatorValueForStorage(row.distance_from_sma50_pct),
        formatIndicatorValueForStorage(row.distance_from_sma200_pct),
        row.reason_summary ?? null
      );

      return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7}, $${base + 8}, $${base + 9}, $${base + 10}, $${base + 11}, $${base + 12}, $${base + 13}, $${base + 14}, $${base + 15}, $${base + 16}, $${base + 17}, $${base + 18}, $${base + 19}, now())`;
    });

    return {
      sql: `insert into swing_watchlist_daily (
        date, bias, rank_in_bias, ticker, sector, sector_signal, swing_setup, swing_decision,
        playbook, is_actionable,
        watchlist_score, indicator_price, daily_return_pct, relative_volume20,
        pct_from_52w_high, pct_from_52w_low, distance_from_sma50_pct, distance_from_sma200_pct,
        reason_summary, updated_at
      ) values ${values.join(', ')}
      on conflict (date, bias, rank_in_bias) do update set
        ticker = excluded.ticker,
        sector = excluded.sector,
        sector_signal = excluded.sector_signal,
        swing_setup = excluded.swing_setup,
        swing_decision = excluded.swing_decision,
        playbook = excluded.playbook,
        is_actionable = excluded.is_actionable,
        watchlist_score = excluded.watchlist_score,
        indicator_price = excluded.indicator_price,
        daily_return_pct = excluded.daily_return_pct,
        relative_volume20 = excluded.relative_volume20,
        pct_from_52w_high = excluded.pct_from_52w_high,
        pct_from_52w_low = excluded.pct_from_52w_low,
        distance_from_sma50_pct = excluded.distance_from_sma50_pct,
        distance_from_sma200_pct = excluded.distance_from_sma200_pct,
        reason_summary = excluded.reason_summary,
        updated_at = now()`,
      params,
    };
  });
}

export async function getSwingWatchlistSourceRows() {
  const [indicatorResult, sectorSignalResult, swingSignalResult] = await Promise.all([
    query(
      `select
         i.date::text as date,
         i.ticker,
         c.sector,
         i.indicator_price::text as indicator_price,
         i.daily_return_pct::text as daily_return_pct,
         i.relative_volume20::text as relative_volume20,
         i.pct_from_52w_high::text as pct_from_52w_high,
         i.pct_from_52w_low::text as pct_from_52w_low,
         i.sma50::text as sma50,
         i.sma200::text as sma200
       from stock_daily_indicators i
       join sp500_constituents c
         on c.ticker = i.ticker
       where c.is_active = true
       order by i.date asc, i.ticker asc`
    ),
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
         setup,
         decision
       from swing_signal_daily
       order by date asc`
    ),
  ]);

  return {
    indicatorRows: indicatorResult.rows,
    sectorSignalRows: sectorSignalResult.rows,
    swingSignalRows: swingSignalResult.rows,
  };
}

export async function replaceSwingWatchlists(rows) {
  if (!rows.length) {
    return 0;
  }

  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query('begin');
    await client.query('delete from swing_watchlist_daily');

    const statements = buildSwingWatchlistUpsertStatements(rows);
    for (const statement of statements) {
      await client.query(statement.sql, statement.params);
    }

    await client.query('commit');
    return rows.length;
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}

export async function getSwingWatchlistRows() {
  const result = await query(
    `select
       date::text as date,
       bias,
       rank_in_bias,
       ticker,
       sector,
       sector_signal,
       swing_setup,
       swing_decision,
       playbook,
       is_actionable,
       watchlist_score::text as watchlist_score,
       indicator_price::text as indicator_price,
       daily_return_pct::text as daily_return_pct,
       relative_volume20::text as relative_volume20,
       pct_from_52w_high::text as pct_from_52w_high,
       pct_from_52w_low::text as pct_from_52w_low,
       distance_from_sma50_pct::text as distance_from_sma50_pct,
       distance_from_sma200_pct::text as distance_from_sma200_pct,
       reason_summary
     from swing_watchlist_daily
     order by date asc, bias asc, rank_in_bias asc`
  );

  return result.rows;
}
