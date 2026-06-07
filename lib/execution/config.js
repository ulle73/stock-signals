function normalizeBoolean(value) {
  return String(value ?? '').trim().toLowerCase() === 'true';
}

function parseDelimitedList(rawValue) {
  return String(rawValue ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
}

function normalizeAccountId(value) {
  return String(value ?? '')
    .trim()
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toUpperCase();
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

function parseAllowedSymbols(rawValue, fallback = 'SPY') {
  const source = rawValue?.trim() ?? fallback;
  if (!source.trim()) {
    return [];
  }

  const values = source
    .split(',')
    .map((value) => value.trim().toUpperCase())
    .filter(Boolean);

  return [...new Set(values)];
}

function buildBrokerLabel(accountId) {
  return `alpaca_${String(accountId ?? '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_')}`;
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

export function getMarkovPaperAccountConfigs(env = process.env) {
  const accountIds = parseDelimitedList(env.MARKOV_PAPER_ACCOUNTS);

  return accountIds.map((accountId) => {
    const normalizedAccountId = normalizeAccountId(accountId);
    const prefix = `MARKOV_PAPER_${normalizedAccountId}`;
    const strategyName = env[`${prefix}_STRATEGY_NAME`]?.trim() || accountId.trim();

    return {
      accountId: accountId.trim(),
      strategyName,
      broker: env[`${prefix}_BROKER`]?.trim() || buildBrokerLabel(accountId),
      alpaca: {
        apiBaseUrl: env[`${prefix}_API_BASE_URL`]?.trim() || 'https://paper-api.alpaca.markets/v2',
        apiKey: env[`${prefix}_API_KEY`]?.trim() || '',
        apiSecret: env[`${prefix}_API_SECRET`]?.trim() || '',
        tradingEnabled: normalizeBoolean(env[`${prefix}_TRADING_ENABLED`]),
      },
      allowedSymbols: parseAllowedSymbols(env[`${prefix}_ALLOWED_SYMBOLS`], ''),
      maxOrderNotionalUsd: parsePositiveNumber(
        `${prefix}_MAX_ORDER_NOTIONAL_USD`,
        env[`${prefix}_MAX_ORDER_NOTIONAL_USD`] ?? env.EXECUTION_MAX_ORDER_NOTIONAL_USD,
        100000
      ),
      maxPositionNotionalUsd: parsePositiveNumber(
        `${prefix}_MAX_POSITION_NOTIONAL_USD`,
        env[`${prefix}_MAX_POSITION_NOTIONAL_USD`] ?? env.EXECUTION_MAX_POSITION_NOTIONAL_USD,
        100000
      ),
      maxSignalAgeDays: parsePositiveNumber(
        `${prefix}_MAX_SIGNAL_AGE_DAYS`,
        env[`${prefix}_MAX_SIGNAL_AGE_DAYS`] ?? env.EXECUTION_MAX_SIGNAL_AGE_DAYS,
        5
      ),
      shortingEnabled: normalizeBoolean(env[`${prefix}_SHORTING_ENABLED`]),
    };
  });
}
