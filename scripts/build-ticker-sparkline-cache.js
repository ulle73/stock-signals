import { closePool, query } from '../lib/db.js';
import { ensureEnvLoaded } from '../lib/env.js';
import { buildSparklineSeries } from '../lib/utils/sparkline.js';

ensureEnvLoaded();

const DEFAULT_DAYS = 50;

function groupRowsByTicker(rows) {
  const grouped = new Map();

  for (const row of rows) {
    const ticker = String(row.ticker ?? '').trim().toUpperCase();
    if (!ticker) continue;
    if (!grouped.has(ticker)) grouped.set(ticker, []);
    grouped.get(ticker).push({ date: row.date, close: row.close });
  }

  return grouped;
}

async function fetchLatestPriceRows(days) {
  const result = await query(
    `with ranked_prices as (
       select
         p.ticker,
         p.date::text as date,
         coalesce(p.adj_close, p.close)::text as close,
         row_number() over (partition by p.ticker order by p.date desc) as row_number
       from stock_daily_prices p
       inner join sp500_constituents c on c.ticker = p.ticker and c.is_active = true
       where coalesce(p.adj_close, p.close) is not null
         and coalesce(p.adj_close, p.close) > 0
     )
     select ticker, date, close
     from ranked_prices
     where row_number <= $1
     order by ticker asc, date asc`,
    [days]
  );

  return result.rows;
}

async function upsertSparklineRow({ ticker, asOfDate, days, sparkline }) {
  await query(
    `insert into ticker_sparkline_cache (
       ticker,
       as_of_date,
       days,
       sparkline_path,
       close_first,
       close_last,
       return_pct,
       min_close,
       max_close,
       points_json,
       marker_slots_json
     ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11::jsonb)
     on conflict (ticker) do update set
       as_of_date = excluded.as_of_date,
       days = excluded.days,
       sparkline_path = excluded.sparkline_path,
       close_first = excluded.close_first,
       close_last = excluded.close_last,
       return_pct = excluded.return_pct,
       min_close = excluded.min_close,
       max_close = excluded.max_close,
       points_json = excluded.points_json,
       marker_slots_json = excluded.marker_slots_json,
       updated_at = now()`,
    [
      ticker,
      asOfDate,
      days,
      sparkline.path,
      sparkline.closeFirst,
      sparkline.closeLast,
      sparkline.returnPct,
      sparkline.minClose,
      sparkline.maxClose,
      JSON.stringify(sparkline.points),
      JSON.stringify(sparkline.markerSlots),
    ]
  );
}

async function run() {
  const days = Number(process.env.TICKER_SPARKLINE_DAYS ?? DEFAULT_DAYS);
  const safeDays = Number.isFinite(days) && days > 0 ? Math.min(Math.floor(days), 260) : DEFAULT_DAYS;
  const groupedRows = groupRowsByTicker(await fetchLatestPriceRows(safeDays));
  let written = 0;

  for (const [ticker, rows] of groupedRows.entries()) {
    const sparkline = buildSparklineSeries(rows);
    if (!sparkline?.path) continue;
    await upsertSparklineRow({ ticker, asOfDate: rows.at(-1)?.date, days: safeDays, sparkline });
    written += 1;
  }

  console.log(`build:ticker-sparkline-cache tickers=${written} days=${safeDays}`);
}

run()
  .catch((error) => {
    console.error('build:ticker-sparkline-cache failed:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closePool();
  });
