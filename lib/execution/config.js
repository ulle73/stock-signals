function normalizeBoolean(value) {
  return String(value ?? '').trim().toLowerCase() === 'true';
}

function parsePositiveNumber(name, rawValue, defaultValue) {
  const value = rawValue?.trim();
  if (!value) {
    return defaultValue;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`Invalid ${name}: ${rawValue}`);
  }

  return parsed;
}

function parseAllowedSymbols(rawValue) {
  const source = rawValue?.trim() || 'SPY';
  const values = source
    .split(',')
    .map((value) => value.trim().toUpperCase())
    .filter(Boolean);

  return [...new Set(values)];
}

export function getExecutionConfig(env = process.env) {
  return {
    alpaca: {
      apiBaseUrl: env.ALPACA_API_BASE_URL?.trim() || 'https://paper-api.alpaca.markets/v2',
      apiKey: env.ALPACA_API_KEY?.trim() || '',
      apiSecret: env.ALPACA_API_SECRET?.trim() || '',
      tradingEnabled: normalizeBoolean(env.ALPACA_TRADING_ENABLED),
    },
    allowedSymbols: parseAllowedSymbols(env.EXECUTION_ALLOWED_SYMBOLS),
    maxOrderNotionalUsd: parsePositiveNumber('EXECUTION_MAX_ORDER_NOTIONAL_USD', env.EXECUTION_MAX_ORDER_NOTIONAL_USD, 100000),
    maxPositionNotionalUsd: parsePositiveNumber('EXECUTION_MAX_POSITION_NOTIONAL_USD', env.EXECUTION_MAX_POSITION_NOTIONAL_USD, 100000),
    maxSignalAgeDays: parsePositiveNumber('EXECUTION_MAX_SIGNAL_AGE_DAYS', env.EXECUTION_MAX_SIGNAL_AGE_DAYS, 5),
  };
}
