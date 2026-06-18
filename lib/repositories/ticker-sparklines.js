import { query } from '../db.js';
import { buildSparklineIndicatorPayloads, buildSparklineSeries } from '../utils/sparkline.js';

function normalizeTicker(value) {
  return String(value ?? '').trim().toUpperCase();
}

function isMissingTableError(error) {
  return error?.code === '42P01' || /ticker_sparkline_cache/i.test(error?.message ?? '');
}

function isMissingCacheShapeError(error) {
  return error?.code === '42703' || /obv_panel_json|tf_sync_markers_json|points_json/i.test(error?.message ?? '');
}

function parseJsonArray(value) {
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string') return [];

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function parseJsonObject(value) {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value;
  if (typeof value !== 'string') return null;

  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
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
    points: parseJsonArray(row.points_json),
    markers: parseJsonArray(row.marker_slots_json),
    tfSyncMarkers: parseJsonArray(row.tf_sync_markers_json),
    obvPanel: parseJsonObject(row.obv_panel_json),
  };
}

function normalizeComputedSparkline(sparkline, days, rows) {
  if (!sparkline?.path) {
    return null;
  }

  const indicatorPayloads = buildSparklineIndicatorPayloads(sparkline.points, rows);

  return {
    path: sparkline.path,
    returnPct: sparkline.returnPct,
    asOfDate: sparkline.points.at(-1)?.date ?? null,
    days,
    closeFirst: sparkline.closeFirst,
    closeLast: sparkline.closeLast,
    minClose: sparkline.minClose,
    maxClose: sparkline.maxClose,
    points: sparkline.points,
    markers: indicatorPayloads.markerSlots ?? sparkline.markerSlots ?? [],
    tfSyncMarkers: indicatorPayloads.tfSyncMarkers ?? [],
    obvPanel: indicatorPayloads.obvPanel ?? null,
  };
}

function groupRowsByTicker(rows) {
  const grouped = new Map();

  for (const row of rows ?? []) {
    const ticker = normalizeTicker(row.ticker);
    if (!ticker) continue;
    if (!grouped.has(ticker)) grouped.set(ticker, []);
    grouped.get(ticker).push({ ...row, ticker });
  }

  return grouped;
}

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
         points_json,
         marker_slots_json,
         tf_sync_markers_json,
         obv_panel_json
       from ticker_sparkline_cache
       where ticker = any($1::text[])
         and days = $2`,
      [uniqueTickers, days]
    );

    return new Map(result.rows.map((row) => [row.ticker, normalizeCacheRow(row)]));
  } catch (error) {
    if (isMissingTableError(error) || isMissingCacheShapeError(error)) {
      return new Map();
    }

    throw error;
  }
}

async function getComputedTickerSparklines(uniqueTickers, days) {
  if (!uniqueTickers.length) {
    return new Map();
  }

  const includeTfSync = await hasTable('tf_sync_indicator_daily');
  const result = await query(
    `with ranked_prices as (
       select
         p.ticker,
         p.date,
         p.date::text as date_text,
         coalesce(p.adj_close, p.close)::text as close,
         row_number() over (partition by p.ticker order by p.date desc) as row_number
       from stock_daily_prices p
       where p.ticker = any($1::text[])
         and coalesce(p.adj_close, p.close) is not null
         and coalesce(p.adj_close, p.close) > 0
     )
     select
       ranked_prices.ticker,
       ranked_prices.date_text as date,
       ranked_prices.close,
       indicators.ryd_obv_zscore_80::text as ryd_obv_zscore_80,
       indicators.ryd_obv_signal,
       ${includeTfSync
         ? `tf_sync.tf_sync_signal,
            tf_sync.tf_sync_buy_signal,
            tf_sync.tf_sync_sell_signal,
            tf_sync.tf_sync_buy_active,
            tf_sync.tf_sync_sell_active`
         : `null as tf_sync_signal,
            null as tf_sync_buy_signal,
            null as tf_sync_sell_signal,
            null as tf_sync_buy_active,
            null as tf_sync_sell_active`}
     from ranked_prices
     left join stock_daily_indicators indicators
       on indicators.ticker = ranked_prices.ticker
      and indicators.date = ranked_prices.date
     ${includeTfSync
       ? `left join tf_sync_indicator_daily tf_sync
            on tf_sync.ticker = ranked_prices.ticker
           and tf_sync.date = ranked_prices.date`
       : ''}
     where ranked_prices.row_number <= $2
     order by ranked_prices.ticker asc, ranked_prices.date asc`,
    [uniqueTickers, days]
  );

  const computed = new Map();
  const groupedRows = groupRowsByTicker(result.rows);

  for (const [ticker, rows] of groupedRows.entries()) {
    const sparkline = normalizeComputedSparkline(buildSparklineSeries(rows), days, rows);
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
