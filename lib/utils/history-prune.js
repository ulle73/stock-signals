const DEFAULT_DAILY_DAYS = 400;
const DEFAULT_INTRADAY_60M_DAYS = 60;
const DEFAULT_MACRO_PROXY_DAYS = 400;
const DEFAULT_IV_PROXY_DAYS = 400;

const TRUTHY_VALUES = new Set(['1', 'true', 'yes', 'on']);
const FALSY_VALUES = new Set(['0', 'false', 'no', 'off']);

const DAILY_RETENTION_TABLES = [
  { table: 'stock_daily_prices', column: 'date', retention: 'daily' },
  { table: 'stock_daily_indicators', column: 'date', retention: 'daily' },
  { table: 'ticker_markov_daily', column: 'date', retention: 'daily' },
  { table: 'swing_signal_daily', column: 'date', retention: 'daily' },
  { table: 'swing_watchlist_daily', column: 'date', retention: 'daily' },
];

const INTRADAY_RETENTION_TABLES = [
  { table: 'stock_intraday_prices_60m', column: 'session_date', retention: 'intraday60m' },
  { table: 'tf_sync_indicator_daily', column: 'date', retention: 'intraday60m' },
];

const MACRO_PROXY_RETENTION_TABLES = [
  { table: 'macro_matrix_yahoo_proxy_daily', column: 'date', retention: 'macroProxy' },
];

const IV_PROXY_RETENTION_TABLES = [
  { table: 'implied_volatility_proxy_source_daily', column: 'date', retention: 'ivProxy' },
];

function parseBooleanEnv(name, rawValue, fallback = false) {
  const normalized = rawValue?.trim().toLowerCase();

  if (!normalized) {
    return fallback;
  }

  if (TRUTHY_VALUES.has(normalized)) {
    return true;
  }

  if (FALSY_VALUES.has(normalized)) {
    return false;
  }

  throw new Error(`Invalid ${name} value: ${rawValue}`);
}

function parseRetentionDays(name, rawValue, fallbackValue) {
  const normalized = rawValue?.trim();

  if (!normalized) {
    return fallbackValue;
  }

  const parsed = Number.parseInt(normalized, 10);

  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`Invalid ${name} value: ${rawValue}`);
  }

  return parsed;
}

export function isHistoryPruneEnabled(env = process.env) {
  return parseBooleanEnv('HISTORY_PRUNE_ENABLED', env.HISTORY_PRUNE_ENABLED, false);
}

export function getHistoryPruneSettings(env = process.env) {
  return {
    dailyDays: parseRetentionDays(
      'HISTORY_PRUNE_DAILY_DAYS',
      env.HISTORY_PRUNE_DAILY_DAYS,
      DEFAULT_DAILY_DAYS
    ),
    intraday60mDays: parseRetentionDays(
      'HISTORY_PRUNE_INTRADAY_60M_DAYS',
      env.HISTORY_PRUNE_INTRADAY_60M_DAYS,
      DEFAULT_INTRADAY_60M_DAYS
    ),
    macroProxyDays: parseRetentionDays(
      'HISTORY_PRUNE_MACRO_PROXY_DAYS',
      env.HISTORY_PRUNE_MACRO_PROXY_DAYS,
      DEFAULT_MACRO_PROXY_DAYS
    ),
    ivProxyDays: parseRetentionDays(
      'HISTORY_PRUNE_IV_PROXY_DAYS',
      env.HISTORY_PRUNE_IV_PROXY_DAYS,
      DEFAULT_IV_PROXY_DAYS
    ),
  };
}

function resolveRetentionDays(retention, settings) {
  if (retention === 'daily') {
    return settings.dailyDays;
  }

  if (retention === 'intraday60m') {
    return settings.intraday60mDays;
  }

  if (retention === 'macroProxy') {
    return settings.macroProxyDays;
  }

  return settings.ivProxyDays;
}

export function getHistoryPrunePlan(env = process.env) {
  const settings = getHistoryPruneSettings(env);

  return [
    ...DAILY_RETENTION_TABLES,
    ...INTRADAY_RETENTION_TABLES,
    ...MACRO_PROXY_RETENTION_TABLES,
    ...IV_PROXY_RETENTION_TABLES,
  ].map((item) => ({
    ...item,
    days: resolveRetentionDays(item.retention, settings),
  }));
}

export function buildHistoryPruneStatement({ table, column, days }) {
  return {
    sql: `delete from ${table} where ${column} < current_date - $1::integer`,
    params: [days],
  };
}
