import { query } from '../db.js';
import { chunkArray } from '../utils/chunk.js';
import { formatIndicatorValueForStorage } from '../utils/rolling-indicators.js';

const TF_SYNC_BATCH_SIZE = 200;
const DEFAULT_QUERY_CLIENT = { query };

export function buildTfSyncIndicatorUpsertStatements(rows, batchSize = TF_SYNC_BATCH_SIZE) {
  return chunkArray(rows, batchSize).map((batch) => {
    const params = [];
    const values = batch.map((row, index) => {
      const base = index * 18;
      params.push(
        row.ticker,
        row.date,
        row.intraday_60m_candle_at,
        formatIndicatorValueForStorage(row.tf_sync_weekly_open),
        formatIndicatorValueForStorage(row.tf_sync_weekly_close),
        row.tf_sync_daily_green,
        row.tf_sync_daily_red,
        row.tf_sync_weekly_green,
        row.tf_sync_weekly_red,
        row.tf_sync_intraday_green,
        row.tf_sync_intraday_red,
        row.tf_sync_buy_condition,
        row.tf_sync_sell_condition,
        row.tf_sync_buy_signal,
        row.tf_sync_sell_signal,
        row.tf_sync_buy_active,
        row.tf_sync_sell_active,
        row.tf_sync_signal
      );

      return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7}, $${base + 8}, $${base + 9}, $${base + 10}, $${base + 11}, $${base + 12}, $${base + 13}, $${base + 14}, $${base + 15}, $${base + 16}, $${base + 17}, $${base + 18}, now())`;
    });

    return {
      sql: `insert into tf_sync_indicator_daily (
        ticker, date, intraday_60m_candle_at, tf_sync_weekly_open, tf_sync_weekly_close,
        tf_sync_daily_green, tf_sync_daily_red, tf_sync_weekly_green, tf_sync_weekly_red,
        tf_sync_intraday_green, tf_sync_intraday_red, tf_sync_buy_condition, tf_sync_sell_condition,
        tf_sync_buy_signal, tf_sync_sell_signal, tf_sync_buy_active, tf_sync_sell_active,
        tf_sync_signal, updated_at
      ) values ${values.join(', ')}
      on conflict (ticker, date) do update set
        intraday_60m_candle_at = excluded.intraday_60m_candle_at,
        tf_sync_weekly_open = excluded.tf_sync_weekly_open,
        tf_sync_weekly_close = excluded.tf_sync_weekly_close,
        tf_sync_daily_green = excluded.tf_sync_daily_green,
        tf_sync_daily_red = excluded.tf_sync_daily_red,
        tf_sync_weekly_green = excluded.tf_sync_weekly_green,
        tf_sync_weekly_red = excluded.tf_sync_weekly_red,
        tf_sync_intraday_green = excluded.tf_sync_intraday_green,
        tf_sync_intraday_red = excluded.tf_sync_intraday_red,
        tf_sync_buy_condition = excluded.tf_sync_buy_condition,
        tf_sync_sell_condition = excluded.tf_sync_sell_condition,
        tf_sync_buy_signal = excluded.tf_sync_buy_signal,
        tf_sync_sell_signal = excluded.tf_sync_sell_signal,
        tf_sync_buy_active = excluded.tf_sync_buy_active,
        tf_sync_sell_active = excluded.tf_sync_sell_active,
        tf_sync_signal = excluded.tf_sync_signal,
        updated_at = now()`,
      params,
    };
  });
}

function buildSelectedTickerCte({ ticker = null, tickerLimit = null } = {}) {
  if (ticker) {
    return {
      sql: `selected_tickers as (
        select ticker
        from sp500_constituents
        where is_active = true and ticker = $1
      )`,
      params: [ticker],
    };
  }

  if (tickerLimit) {
    return {
      sql: `selected_tickers as (
        select ticker
        from sp500_constituents
        where is_active = true
        order by ticker asc
        limit $1
      )`,
      params: [tickerLimit],
    };
  }

  return {
    sql: `selected_tickers as (
      select ticker
      from sp500_constituents
      where is_active = true
    )`,
    params: [],
  };
}

export async function getTfSyncSourceRows({ ticker = null, tickerLimit = null } = {}) {
  const selectedTickers = buildSelectedTickerCte({ ticker, tickerLimit });
  const result = await query(
    `with ${selectedTickers.sql},
     intraday_scope as (
       select coalesce(min(i.session_date), current_date)::date as min_session_date
       from stock_intraday_prices_60m i
       inner join selected_tickers t on t.ticker = i.ticker
     )
     select
       p.ticker,
       p.date::text as date,
       p.open::text as daily_open,
       p.close::text as daily_close,
       intraday.intraday_60m_candle_at,
       intraday.intraday_open,
       intraday.intraday_close
     from stock_daily_prices p
     inner join selected_tickers t on t.ticker = p.ticker
     cross join intraday_scope s
     left join lateral (
       select
         i.candle_at::text as intraday_60m_candle_at,
         i.open::text as intraday_open,
         i.close::text as intraday_close
       from stock_intraday_prices_60m i
       where i.ticker = p.ticker and i.session_date = p.date
       order by i.candle_at desc
       limit 1
     ) intraday on true
     where p.open is not null
       and p.close is not null
       and p.date >= (s.min_session_date - interval '7 days')
     order by p.ticker asc, p.date asc`,
    selectedTickers.params
  );

  return result.rows;
}

export async function upsertTfSyncIndicatorRows(client, rows, batchSize = TF_SYNC_BATCH_SIZE) {
  if (!rows.length) {
    return 0;
  }

  const queryClient = client ?? DEFAULT_QUERY_CLIENT;
  const statements = buildTfSyncIndicatorUpsertStatements(rows, batchSize);

  for (const statement of statements) {
    await queryClient.query(statement.sql, statement.params);
  }

  return rows.length;
}

export async function getLatestTfSyncRows(limit = 20) {
  const result = await query(
    `select
       ticker,
       date::text as date,
       intraday_60m_candle_at::text as intraday_60m_candle_at,
       tf_sync_signal,
       tf_sync_buy_active,
       tf_sync_sell_active
     from tf_sync_indicator_daily
     order by date desc, ticker asc
     limit $1`,
    [limit]
  );

  return result.rows;
}
