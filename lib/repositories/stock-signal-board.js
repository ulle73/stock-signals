import { query } from '../db.js';

async function hasTable(tableName) {
  const result = await query(
    `select exists(
       select 1
       from information_schema.tables
       where table_schema = 'public'
         and table_name = $1
     ) as table_exists`,
    [tableName]
  );

  return result.rows[0]?.table_exists === true;
}

function buildStockSignalBoardSql(includeTfSync, includeTickerMarkov) {
  return `with latest_indicator_rows as (
       select *
       from (
         select
           i.ticker,
           i.date as current_date_value,
           i.date::text as current_date,
           i.indicator_price::text as indicator_price,
           i.daily_return_pct::text as daily_return_pct,
           i.relative_volume20::text as relative_volume20,
           i.volume_z20::text as volume_z20,
           i.ryd_obv::text as ryd_obv,
           i.ryd_obv_zscore_80::text as ryd_obv_zscore_80,
           i.ryd_obv_signal,
           i.volume_event,
           i.volume_event_tone,
           i.price_zscore_20::text as price_zscore_20,
           i.price_zscore_avg_20::text as price_zscore_avg_20,
           i.price_zscore_signal,
           i.ibs_value::text as ibs_value,
           i.rsi14::text as rsi14,
           i.ibs_rsi_signal,
           i.macd_v::text as macd_v,
           i.macd_v_signal,
           i.breakout_20d_high::text as breakout_20d_high,
           i.breakout_20d_low::text as breakout_20d_low,
           i.breakout_20d_signal,
           i.plce_threshold_value::text as plce_threshold_value,
           i.plce_threshold_signal,
           row_number() over (
             partition by i.ticker
             order by i.date desc
           ) as row_number
         from stock_daily_indicators i
       ) ranked
       where row_number = 1
     ),
     latest_active_indicator_rows as (
       select *
       from (
         select
           i.ticker,
           i.date::text as latest_active_indicator_date,
           i.ryd_obv_signal as latest_active_ryd_obv_signal,
           i.volume_event as latest_active_volume_event,
           i.volume_event_tone as latest_active_volume_event_tone,
           i.price_zscore_signal as latest_active_price_zscore_signal,
           i.ibs_rsi_signal as latest_active_ibs_rsi_signal,
           i.macd_v_signal as latest_active_macd_v_signal,
           i.breakout_20d_signal as latest_active_breakout_20d_signal,
           i.plce_threshold_signal as latest_active_plce_threshold_signal,
           row_number() over (
             partition by i.ticker
             order by
               i.date desc,
               case when i.ryd_obv_signal <> 'none' then 0 else 1 end,
               case when i.price_zscore_signal <> 'none' then 0 else 1 end,
               case when i.ibs_rsi_signal <> 'none' then 0 else 1 end,
               case when i.macd_v_signal <> 'none' then 0 else 1 end,
               case when i.breakout_20d_signal <> 'none' then 0 else 1 end,
               case when i.plce_threshold_signal <> 'none' then 0 else 1 end,
               case when i.volume_event <> 'normal' then 0 else 1 end
           ) as row_number
         from stock_daily_indicators i
         where
           i.ryd_obv_signal <> 'none'
           or i.volume_event <> 'normal'
           or i.price_zscore_signal <> 'none'
           or i.ibs_rsi_signal <> 'none'
           or i.macd_v_signal <> 'none'
           or i.breakout_20d_signal <> 'none'
           or i.plce_threshold_signal <> 'none'
       ) ranked
       where row_number = 1
     ),
     ${includeTfSync
    ? `latest_tf_sync_active_rows as (
       select *
       from (
         select
           t.ticker,
           t.date::text as latest_active_tf_sync_date,
           t.tf_sync_signal as latest_active_tf_sync_signal,
           row_number() over (
             partition by t.ticker
             order by
               t.date desc,
               case when t.tf_sync_buy_signal or t.tf_sync_sell_signal then 0 else 1 end
           ) as row_number
         from tf_sync_indicator_daily t
         where t.tf_sync_signal <> 'none'
       ) ranked
       where row_number = 1
     ),`
    : ''}
     ${includeTickerMarkov
    ? `latest_ticker_markov_rows as (
       select *
       from (
         select
           m.ticker,
           m.date::text as ticker_markov_date,
           m.markov_state as ticker_markov_state,
           m.twenty_day_return::text as ticker_markov_twenty_day_return,
           m.bull_probability::text as ticker_markov_bull_probability,
           m.sideways_probability::text as ticker_markov_sideways_probability,
           m.bear_probability::text as ticker_markov_bear_probability,
           m.markov_total::text as ticker_markov_total,
           m.markov_stickiness::text as ticker_markov_stickiness,
           m.sample_size as ticker_markov_sample_size,
           m.signal as ticker_markov_signal,
           m.rank_bull as ticker_markov_rank_bull,
           m.rank_sell as ticker_markov_rank_sell,
           row_number() over (
             partition by m.ticker
             order by m.date desc
           ) as row_number
         from ticker_markov_daily m
       ) ranked
       where row_number = 1
     ),`
    : ''}
     latest_watchlist_rows as (
       select *
       from (
         select
           w.ticker,
           w.date::text as latest_watchlist_date,
           w.bias as latest_watchlist_bias,
           w.swing_setup as latest_watchlist_setup,
           w.swing_decision as latest_watchlist_decision,
           w.watchlist_score::text as latest_watchlist_score,
           w.is_actionable as latest_watchlist_is_actionable,
           row_number() over (
             partition by w.ticker
             order by w.date desc, w.rank_in_bias asc
           ) as row_number
         from swing_watchlist_daily w
       ) ranked
       where row_number = 1
     ),
     latest_watchlist_snapshot as (
       select max(date)::text as board_watchlist_date
       from swing_watchlist_daily
     ),
    board as (
      select
        base.*,
        case
          when base.latest_watchlist_date = base.board_watchlist_date then true
          else false
        end as watchlist_on_current_board,
        least(
          case when base.ryd_obv_signal in ('buy', 'sell') then 0 else 99 end,
          case when base.price_zscore_signal in ('buy', 'sell') then 1 else 99 end,
          case when base.ibs_rsi_signal = 'buy' then 2 else 99 end,
          case when base.macd_v_signal in ('buy', 'sell', 'active') then 3 else 99 end,
          case when base.breakout_20d_signal in ('buy', 'sell') then 4 else 99 end,
          case when base.tf_sync_signal in ('buy', 'sell', 'buy_active', 'sell_active') then 5 else 99 end,
          case when base.plce_threshold_signal = 'buy' then 6 else 99 end,
          case when base.volume_event is not null and base.volume_event <> 'normal' then 7 else 99 end,
          case when base.latest_watchlist_date = base.board_watchlist_date and base.latest_watchlist_bias in ('long', 'short') then 8 else 99 end,
          case when base.ticker_markov_signal in ('bull', 'sell') then 9 else 99 end
        ) as current_signal_rank,
        case
          when
            base.ryd_obv_signal in ('buy', 'sell')
            or (base.volume_event is not null and base.volume_event <> 'normal')
            or base.price_zscore_signal in ('buy', 'sell')
            or base.ibs_rsi_signal = 'buy'
            or base.macd_v_signal in ('buy', 'sell', 'active')
            or base.breakout_20d_signal in ('buy', 'sell')
            or base.tf_sync_signal in ('buy', 'sell', 'buy_active', 'sell_active')
            or base.plce_threshold_signal = 'buy'
            or (base.latest_watchlist_date = base.board_watchlist_date and base.latest_watchlist_bias in ('long', 'short'))
            or base.ticker_markov_signal in ('bull', 'sell')
          then true
          else false
        end as has_active_signals_now,
        greatest(
          coalesce(base.latest_active_indicator_date::date, date '1900-01-01'),
          coalesce(base.latest_active_tf_sync_date::date, date '1900-01-01'),
          coalesce(base.ticker_markov_date::date, date '1900-01-01'),
          coalesce(
            case
              when base.latest_watchlist_date = base.board_watchlist_date and base.latest_watchlist_bias in ('long', 'short')
                then base.latest_watchlist_date::date
              else null
            end,
            date '1900-01-01'
          )
        )::text as latest_signal_sort_date
      from (
        select
          c.ticker,
          c.company_name,
          c.sector,
          indicator.current_date,
          indicator.indicator_price,
          indicator.daily_return_pct,
          indicator.relative_volume20,
          indicator.volume_z20,
          indicator.ryd_obv,
          indicator.ryd_obv_zscore_80,
          indicator.ryd_obv_signal,
          indicator.volume_event,
          indicator.volume_event_tone,
          indicator.price_zscore_20,
          indicator.price_zscore_avg_20,
          indicator.price_zscore_signal,
          indicator.ibs_value,
          indicator.rsi14,
          indicator.ibs_rsi_signal,
          indicator.macd_v,
          indicator.macd_v_signal,
          indicator.breakout_20d_high,
          indicator.breakout_20d_low,
          indicator.breakout_20d_signal,
          indicator.plce_threshold_value,
          indicator.plce_threshold_signal,
          ${includeTfSync
      ? `tf_sync.tf_sync_signal,
          tf_sync.tf_sync_buy_active,
          tf_sync.tf_sync_sell_active,
          tf_sync.intraday_60m_candle_at::text as tf_sync_intraday_60m_candle_at,
          tf_sync.tf_sync_weekly_open::text as tf_sync_weekly_open,
          tf_sync.tf_sync_weekly_close::text as tf_sync_weekly_close,
          tf_sync.tf_sync_daily_green,
          tf_sync.tf_sync_daily_red,
          tf_sync.tf_sync_weekly_green,
          tf_sync.tf_sync_weekly_red,
          tf_sync.tf_sync_intraday_green,
          tf_sync.tf_sync_intraday_red,`
      : `null as tf_sync_signal,
          null as tf_sync_buy_active,
          null as tf_sync_sell_active,
          null as tf_sync_intraday_60m_candle_at,
          null as tf_sync_weekly_open,
          null as tf_sync_weekly_close,
          null as tf_sync_daily_green,
          null as tf_sync_daily_red,
          null as tf_sync_weekly_green,
          null as tf_sync_weekly_red,
          null as tf_sync_intraday_green,
          null as tf_sync_intraday_red,`}
          ${includeTickerMarkov
      ? `ticker_markov.ticker_markov_date,
          ticker_markov.ticker_markov_state,
          ticker_markov.ticker_markov_twenty_day_return,
          ticker_markov.ticker_markov_bull_probability,
          ticker_markov.ticker_markov_sideways_probability,
          ticker_markov.ticker_markov_bear_probability,
          ticker_markov.ticker_markov_total,
          ticker_markov.ticker_markov_stickiness,
          ticker_markov.ticker_markov_sample_size,
          ticker_markov.ticker_markov_signal,
          ticker_markov.ticker_markov_rank_bull,
          ticker_markov.ticker_markov_rank_sell,`
      : `null as ticker_markov_date,
          null as ticker_markov_state,
          null as ticker_markov_twenty_day_return,
          null as ticker_markov_bull_probability,
          null as ticker_markov_sideways_probability,
          null as ticker_markov_bear_probability,
          null as ticker_markov_total,
          null as ticker_markov_stickiness,
          null as ticker_markov_sample_size,
          null as ticker_markov_signal,
          null as ticker_markov_rank_bull,
          null as ticker_markov_rank_sell,`}
          indicator_history.latest_active_indicator_date,
          indicator_history.latest_active_ryd_obv_signal,
          indicator_history.latest_active_volume_event,
          indicator_history.latest_active_volume_event_tone,
          indicator_history.latest_active_price_zscore_signal,
          indicator_history.latest_active_ibs_rsi_signal,
          indicator_history.latest_active_macd_v_signal,
          indicator_history.latest_active_breakout_20d_signal,
          indicator_history.latest_active_plce_threshold_signal,
          ${includeTfSync
      ? `tf_sync_history.latest_active_tf_sync_date,
          tf_sync_history.latest_active_tf_sync_signal,`
      : `null as latest_active_tf_sync_date,
          null as latest_active_tf_sync_signal,`}
          watchlist.latest_watchlist_date,
          watchlist.latest_watchlist_bias,
          watchlist.latest_watchlist_setup,
          watchlist.latest_watchlist_decision,
          watchlist.latest_watchlist_score,
          watchlist.latest_watchlist_is_actionable,
          latest_watchlist_snapshot.board_watchlist_date
        from sp500_constituents c
        left join latest_indicator_rows indicator
          on indicator.ticker = c.ticker
        left join latest_active_indicator_rows indicator_history
          on indicator_history.ticker = c.ticker
        ${includeTfSync
      ? `left join tf_sync_indicator_daily tf_sync
          on tf_sync.ticker = c.ticker
         and tf_sync.date = indicator.current_date_value
        left join latest_tf_sync_active_rows tf_sync_history
          on tf_sync_history.ticker = c.ticker`
      : ''}
        ${includeTickerMarkov
      ? `left join latest_ticker_markov_rows ticker_markov
          on ticker_markov.ticker = c.ticker`
      : ''}
        left join latest_watchlist_rows watchlist
          on watchlist.ticker = c.ticker
        cross join latest_watchlist_snapshot
        where c.is_active = true
      ) base
     )
     select *
     from board`;
}

async function getBoardFeatureFlags() {
  const [includeTfSync, includeTickerMarkov] = await Promise.all([
    hasTable('tf_sync_indicator_daily'),
    hasTable('ticker_markov_daily'),
  ]);

  return { includeTfSync, includeTickerMarkov };
}

export async function getStockSignalBoardRows() {
  const { includeTfSync, includeTickerMarkov } = await getBoardFeatureFlags();
  const result = await query(buildStockSignalBoardSql(includeTfSync, includeTickerMarkov));
  return result.rows;
}

export async function getStockSignalBoardSummary() {
  const { includeTfSync, includeTickerMarkov } = await getBoardFeatureFlags();
  const result = await query(
    `with board as (
       ${buildStockSignalBoardSql(includeTfSync, includeTickerMarkov)}
     )
     select
       count(*)::int as "totalTickers",
       count(*) filter (where has_active_signals_now)::int as "activeNowCount",
       count(*) filter (where ryd_obv_signal in ('buy', 'sell'))::int as "obvActiveCount",
       count(*) filter (where volume_event is not null and volume_event <> 'normal')::int as "volumeActiveCount",
       count(*) filter (where price_zscore_signal in ('buy', 'sell'))::int as "priceZscoreActiveCount",
       count(*) filter (where ibs_rsi_signal = 'buy')::int as "ibsRsiActiveCount",
       count(*) filter (where macd_v_signal in ('buy', 'sell', 'active'))::int as "macdVActiveCount",
       count(*) filter (where breakout_20d_signal in ('buy', 'sell'))::int as "breakoutActiveCount",
       count(*) filter (where tf_sync_signal in ('buy', 'sell', 'buy_active', 'sell_active'))::int as "tfSyncActiveCount",
       count(*) filter (where plce_threshold_signal = 'buy')::int as "plceActiveCount",
       count(*) filter (where ticker_markov_signal = 'bull')::int as "tickerMarkovBullCount",
       count(*) filter (where ticker_markov_signal = 'sell')::int as "tickerMarkovSellCount",
       count(*) filter (where watchlist_on_current_board)::int as "watchlistCount",
       max(board.current_date) as "latestIndicatorDate",
       max(board.board_watchlist_date) as "latestWatchlistDate",
       max(board.ticker_markov_date) as "latestTickerMarkovDate"
     from board`
  );

  return result.rows[0];
}

export async function getStockSignalBoardPage({ limit = 20, offset = 0 } = {}) {
  const { includeTfSync, includeTickerMarkov } = await getBoardFeatureFlags();
  const safeLimit = Math.max(1, Math.min(Number(limit) || 20, 100));
  const safeOffset = Math.max(0, Number(offset) || 0);
  const result = await query(
    `with board as (
       ${buildStockSignalBoardSql(includeTfSync, includeTickerMarkov)}
     )
     select *
     from board
     order by
       case when has_active_signals_now then 0 else 1 end,
       current_signal_rank asc,
       latest_signal_sort_date desc,
       ticker asc
     limit $1
     offset $2`,
    [safeLimit, safeOffset]
  );

  return result.rows;
}
