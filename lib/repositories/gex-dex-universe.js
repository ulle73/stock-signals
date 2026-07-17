import { query } from '../db.js';

const DEFAULT_TOP_VOLUME_LIMIT = 30;
const DEFAULT_LOOKBACK_SESSIONS = 20;
const MAX_TOP_VOLUME_LIMIT = 100;
const MAX_LOOKBACK_SESSIONS = 120;

function normalizePositiveInteger(value, fallback, maximum) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(Math.trunc(parsed), maximum);
}

function normalizeTicker(value) {
  const ticker = String(value ?? '').trim().toUpperCase();
  return ticker || null;
}

export function buildTopVolumeGexDexTickerStatement({
  limit = DEFAULT_TOP_VOLUME_LIMIT,
  lookbackSessions = DEFAULT_LOOKBACK_SESSIONS,
} = {}) {
  const safeLimit = normalizePositiveInteger(limit, DEFAULT_TOP_VOLUME_LIMIT, MAX_TOP_VOLUME_LIMIT);
  const safeLookbackSessions = normalizePositiveInteger(
    lookbackSessions,
    DEFAULT_LOOKBACK_SESSIONS,
    MAX_LOOKBACK_SESSIONS
  );

  return {
    sql: `select
            c.ticker,
            avg(recent.volume)::numeric as avg_volume
          from sp500_constituents c
          cross join lateral (
            select p.volume
            from stock_daily_prices p
            where p.ticker = c.ticker
              and p.volume is not null
              and p.volume > 0
            order by p.date desc
            limit $1
          ) recent
          where c.is_active = true
          group by c.ticker
          having count(*) >= least($1, 10)
          order by avg(recent.volume) desc, c.ticker asc
          limit $2`,
    params: [safeLookbackSessions, safeLimit],
  };
}

export function mergeGexDexTickerUniverse(...groups) {
  const merged = [];
  const seen = new Set();

  for (const group of groups) {
    for (const value of group ?? []) {
      const ticker = normalizeTicker(value);
      if (!ticker || seen.has(ticker)) continue;
      seen.add(ticker);
      merged.push(ticker);
    }
  }

  return merged;
}

export async function getTopVolumeGexDexTickers({
  limit = DEFAULT_TOP_VOLUME_LIMIT,
  lookbackSessions = DEFAULT_LOOKBACK_SESSIONS,
  queryFn = query,
} = {}) {
  const statement = buildTopVolumeGexDexTickerStatement({ limit, lookbackSessions });
  const result = await queryFn(statement.sql, statement.params);
  return mergeGexDexTickerUniverse(result.rows?.map((row) => row.ticker) ?? []);
}
