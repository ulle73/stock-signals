import { query } from '../db.js';

export async function getStockSignalBoardRows() {
  const result = await query(
    `with latest_indicator_rows as (
       select *
       from (
         select
           i.ticker,
           i.date::text as current_date,
           i.indicator_price::text as indicator_price,
           i.daily_return_pct::text as daily_return_pct,
           i.relative_volume20::text as relative_volume20,
           i.ryd_obv_signal,
           i.volume_event,
           i.volume_event_tone,
           row_number() over (
             partition by i.ticker
             order by i.date desc
           ) as row_number
         from stock_daily_indicators i
       ) ranked
       where row_number = 1
     ),
     latest_watchlist_snapshot as (
       select max(date)::text as board_watchlist_date
       from swing_watchlist_daily
     )
     select
       c.ticker,
       c.company_name,
       c.sector,
       indicator.current_date,
       indicator.indicator_price,
       indicator.daily_return_pct,
       indicator.relative_volume20,
       indicator.ryd_obv_signal,
       indicator.volume_event,
       indicator.volume_event_tone,
       indicator_history.latest_active_indicator_date,
       indicator_history.latest_active_ryd_obv_signal,
       indicator_history.latest_active_volume_event,
       indicator_history.latest_active_volume_event_tone,
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
     left join lateral (
       select
         i.date::text as latest_active_indicator_date,
         i.ryd_obv_signal as latest_active_ryd_obv_signal,
         i.volume_event as latest_active_volume_event,
         i.volume_event_tone as latest_active_volume_event_tone
       from stock_daily_indicators i
       where i.ticker = c.ticker
         and (
           i.ryd_obv_signal <> 'none'
           or i.volume_event <> 'normal'
         )
       order by
         i.date desc,
         case when i.ryd_obv_signal <> 'none' then 0 else 1 end,
         case when i.volume_event <> 'normal' then 0 else 1 end
       limit 1
     ) indicator_history on true
     left join lateral (
       select
         w.date::text as latest_watchlist_date,
         w.bias as latest_watchlist_bias,
         w.swing_setup as latest_watchlist_setup,
         w.swing_decision as latest_watchlist_decision,
         w.watchlist_score::text as latest_watchlist_score,
         w.is_actionable as latest_watchlist_is_actionable
       from swing_watchlist_daily w
       where w.ticker = c.ticker
       order by w.date desc, w.rank_in_bias asc
       limit 1
     ) watchlist on true
     cross join latest_watchlist_snapshot
     where c.is_active = true
     order by c.ticker asc`
  );

  return result.rows;
}
