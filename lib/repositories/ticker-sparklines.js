import { query } from '../db.js';
import { buildSparklineSeries } from '../utils/sparkline.js';

function normalizeTicker(value) {
  return String(value ?? '').trim().toUpperCase();
}

function isMissingTableError(error) {
  return error?.code === '42P01' || /ticker_sparkline_cache/i.test(error?.message ?? '');
}

function normalizeCacheRow(row) {
  return {
    path: row.sparkline_path,
    returnPct: row.return_pct,
    asOfDate: row.as_of_date,
    days: row.days,
    closeFirst: row.close_first,
    closeLast: row.close_last,
    minClose: row.min_close,
    maxClose: row.max_close,
    markers: Array.isArray(row.marker_slots_json) ? row.marker_slots_json : [],
  };
}

function normalizeComputedSparkline(sparkline, days) {
  if (!sparkline?.path) {
    return null;
  }

  return {
    path: sparkline.path,
    returnPct: sparkline.returnPct,
    asOfDate: sparkline.points.at(-1)?.date ?? null,
    days,
    closeFirst: sparkline.closeFirst,
    closeLast: sparkline.closeLast,
    minClose: sparkline.minClose,
    maxClose: sparkline.maxClose,
    markers: sparkline.markerSlots ?? [],
  };
}

function groupRowsByTicker(rows) {
  const grouped = new Map();

  for (const row of rows ?? []) {
    const ticker = normalizeTicker(row.ticker);
    if (!ticker) continue;
    if (!grouped.has(ticker)) grouped.set(ticker, []);
    grouped.get(ticker).push({ date: row.date, close: row.close });
  }

  return grouped;
}

async function getCachedTickerSparklines(uniqueTickers, days) {
  try {
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

    return new Map(result.rows.map((row) => [row.ticker, normalizeCacheRow(row)]));
  } catch (error) {
    if (isMissingTableError(error)) {
      return new Map();
    }

    throw error;
  }
}

async function getComputedTickerSparklines(uniqueTickers, days) {
  if (!uniqueTickers.length) {
    return new Map();
  }

  const result = await query(
    `with ranked_prices as (
       select
         p.ticker,
         p.date::text as date,
         coalesce(p.adj_close, p.close)::text as close,
         row_number() over (partition by p.ticker order by p.date desc) as row_number
       from stock_daily_prices p
       where p.ticker = any($1::text[])
         and coalesce(p.adj_close, p.close) is not null
         and coalesce(p.adj_close, p.close) > 0
     )
     select ticker, date, close
     from ranked_prices
     where row_number <= $2
     order by ticker asc, date asc`,
    [uniqueTickers, days]
  );

  const computed = new Map();
  const groupedRows = groupRowsByTicker(result.rows);

  for (const [ticker, rows] of groupedRows.entries()) {
    const sparkline = normalizeComputedSparkline(buildSparklineSeries(rows), days);
    if (sparkline) {
      computed.set(ticker, sparkline);
    }
  }

  return computed;
}

export async function getTickerSparklinesForTickers(tickers, { days = 50 } = {}) {
  const uniqueTickers = [...new Set((tickers ?? []).map(normalizeTicker).filter(Boolean))];

  if (!uniqueTickers.length) {
    return new Map();
  }

  const safeDays = Number.isFinite(Number(days)) && Number(days) > 0
    ? Math.min(Math.floor(Number(days)), 260)
    : 50;
  const cached = await getCachedTickerSparklines(uniqueTickers, safeDays);
  const missingTickers = uniqueTickers.filter((ticker) => !cached.has(ticker));

  if (!missingTickers.length) {
    return cached;
  }

  const computed = await getComputedTickerSparklines(missingTickers, safeDays);

  return new Map([...cached, ...computed]);
}
