import { buildSectorOverviewRows } from '../indicators/sector-overview-momentum.js';
import { query } from '../db.js';

const DEFAULT_QUERY_CLIENT = { query };
const HISTORY_SESSION_COUNT = 42;

function latestDate(...rowSets) {
  return rowSets
    .flat()
    .map((row) => row?.date ?? null)
    .filter(Boolean)
    .sort()
    .at(-1) ?? null;
}

export async function getSectorOverviewSnapshot(queryClient = DEFAULT_QUERY_CLIENT) {
  const [dailyReturnResult, strengthResult, breadthResult, signalResult] = await Promise.all([
    queryClient.query(
      `with selected_dates as (
         select date
         from (
           select distinct date
           from stock_daily_indicators
           where daily_return_pct is not null
           order by date desc
           limit $1
         ) latest_dates
       )
       select
         i.date::text as date,
         c.sector,
         i.daily_return_pct::text as daily_return_pct
       from stock_daily_indicators i
       join selected_dates d
         on d.date = i.date
       join sp500_constituents c
         on c.ticker = i.ticker
       where c.is_active = true
         and c.sector is not null
         and i.daily_return_pct is not null
       order by i.date asc, c.sector asc, i.ticker asc`,
      [HISTORY_SESSION_COUNT]
    ),
    queryClient.query(
      `select
         c.sector,
         avg(r.rs_percentile_63d)::text as strength
       from stock_relative_strength_daily r
       join sp500_constituents c
         on c.ticker = r.ticker
       where r.date = (select max(date) from stock_relative_strength_daily)
         and c.is_active = true
         and c.sector is not null
       group by c.sector
       order by c.sector asc`
    ),
    queryClient.query(
      `select
         date::text as date,
         sector,
         pct_above_sma50::text as pct_above_sma50
       from sector_breadth_daily
       where date = (select max(date) from sector_breadth_daily)
       order by sector asc`
    ),
    queryClient.query(
      `select
         date::text as date,
         sector,
         signal
       from sector_signal_daily
       where date = (select max(date) from sector_signal_daily)
       order by sector asc`
    ),
  ]);

  return {
    asOfDate: latestDate(
      dailyReturnResult.rows,
      breadthResult.rows,
      signalResult.rows
    ),
    rows: buildSectorOverviewRows({
      dailyRows: dailyReturnResult.rows,
      strengthRows: strengthResult.rows,
      breadthRows: breadthResult.rows,
      signalRows: signalResult.rows,
    }),
  };
}
