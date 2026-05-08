import { query } from '../db.js';
import { chunkArray } from '../utils/chunk.js';
import { formatIndicatorValueForStorage } from '../utils/rolling-indicators.js';

const SECTOR_BREADTH_BATCH_SIZE = 200;

export function buildSectorBreadthUpsertStatements(rows, batchSize = SECTOR_BREADTH_BATCH_SIZE) {
  return chunkArray(rows, batchSize).map((batch) => {
    const params = [];
    const values = batch.map((row, index) => {
      const base = index * 19;
      params.push(
        row.date,
        row.sector,
        row.active_ticker_count,
        row.advancers,
        row.decliners,
        row.unchanged,
        row.valid_sma20_count,
        row.above_sma20_count,
        formatIndicatorValueForStorage(row.pct_above_sma20),
        row.valid_sma50_count,
        row.above_sma50_count,
        formatIndicatorValueForStorage(row.pct_above_sma50),
        row.valid_sma200_count,
        row.above_sma200_count,
        formatIndicatorValueForStorage(row.pct_above_sma200),
        row.valid_52w_count,
        row.new_highs_52w,
        row.new_lows_52w,
        row.is_valid_signal_date
      );

      return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7}, $${base + 8}, $${base + 9}, $${base + 10}, $${base + 11}, $${base + 12}, $${base + 13}, $${base + 14}, $${base + 15}, $${base + 16}, $${base + 17}, $${base + 18}, $${base + 19}, now())`;
    });

    return {
      sql: `insert into sector_breadth_daily (
        date,
        sector,
        active_ticker_count,
        advancers,
        decliners,
        unchanged,
        valid_sma20_count,
        above_sma20_count,
        pct_above_sma20,
        valid_sma50_count,
        above_sma50_count,
        pct_above_sma50,
        valid_sma200_count,
        above_sma200_count,
        pct_above_sma200,
        valid_52w_count,
        new_highs_52w,
        new_lows_52w,
        is_valid_signal_date,
        updated_at
      ) values ${values.join(', ')}
      on conflict (date, sector) do update set
        active_ticker_count = excluded.active_ticker_count,
        advancers = excluded.advancers,
        decliners = excluded.decliners,
        unchanged = excluded.unchanged,
        valid_sma20_count = excluded.valid_sma20_count,
        above_sma20_count = excluded.above_sma20_count,
        pct_above_sma20 = excluded.pct_above_sma20,
        valid_sma50_count = excluded.valid_sma50_count,
        above_sma50_count = excluded.above_sma50_count,
        pct_above_sma50 = excluded.pct_above_sma50,
        valid_sma200_count = excluded.valid_sma200_count,
        above_sma200_count = excluded.above_sma200_count,
        pct_above_sma200 = excluded.pct_above_sma200,
        valid_52w_count = excluded.valid_52w_count,
        new_highs_52w = excluded.new_highs_52w,
        new_lows_52w = excluded.new_lows_52w,
        is_valid_signal_date = excluded.is_valid_signal_date,
        updated_at = now()`,
      params,
    };
  });
}

export async function getSectorBreadthSourceRows() {
  const result = await query(
    `select
       i.ticker,
       c.sector,
       i.date::text as date,
       i.indicator_price::text as indicator_price,
       i.daily_return_pct::text as daily_return_pct,
       i.sma20::text as sma20,
       i.sma50::text as sma50,
       i.sma200::text as sma200,
       i.pct_from_52w_high::text as pct_from_52w_high,
       i.pct_from_52w_low::text as pct_from_52w_low
     from stock_daily_indicators i
     left join sp500_constituents c
       on c.ticker = i.ticker
     order by i.date asc, c.sector asc nulls last, i.ticker asc`
  );

  return result.rows;
}

export async function upsertSectorBreadthDaily(rows) {
  if (!rows.length) return 0;

  const statements = buildSectorBreadthUpsertStatements(rows);

  for (const statement of statements) {
    await query(statement.sql, statement.params);
  }

  return rows.length;
}
