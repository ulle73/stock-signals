import { query } from '../db.js';

function normalizeTicker(value) {
  return String(value ?? '').trim().toUpperCase();
}

export async function getTickerSparklinesForTickers(tickers, { days = 50 } = {}) {
  const uniqueTickers = [...new Set((tickers ?? []).map(normalizeTicker).filter(Boolean))];

  if (!uniqueTickers.length) {
    return new Map();
  }

  const result = await query(
    `select
       ticker,
       as_of_date::text as as_of_date,
       days,
       sparkline_path,
       close_first::text as close_first,
       close_last::text as close_last,
       return_pct::text as return_pct,
       min_close::text as min_close,
       max_close::text as max_close,
       marker_slots_json
     from ticker_sparkline_cache
     where ticker = any($1::text[])
       and days = $2`,
    [uniqueTickers, days]
  );

  return new Map(result.rows.map((row) => [
    row.ticker,
    {
      path: row.sparkline_path,
      returnPct: row.return_pct,
      asOfDate: row.as_of_date,
      days: row.days,
      closeFirst: row.close_first,
      closeLast: row.close_last,
      minClose: row.min_close,
      maxClose: row.max_close,
      markers: Array.isArray(row.marker_slots_json) ? row.marker_slots_json : [],
    },
  ]));
}
