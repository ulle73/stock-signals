function buildResult(rule, status, code, message) {
  return { rule, status, code, message };
}

function normalizeSymbol(value) {
  return String(value ?? '').trim().toUpperCase();
}

function calculateSignalAgeDays(signalDate, now) {
  const signalTime = Date.parse(`${signalDate}T00:00:00.000Z`);
  const currentTime = now.getTime();
  const difference = currentTime - signalTime;
  return Math.floor(difference / 86_400_000);
}

export function evaluateExecutionRiskRules({
  intent,
  proposal,
  brokerState,
  config,
  mode,
  now = new Date(),
}) {
  const results = [];
  const apiBaseUrl = brokerState?.metadata?.apiBaseUrl ?? config?.alpaca?.apiBaseUrl ?? '';
  const normalizedSymbol = normalizeSymbol(intent.symbol);
  const allowedSymbols = new Set((config.allowedSymbols ?? []).map((value) => normalizeSymbol(value)));
  const openOrders = brokerState?.openOrders ?? [];
  const account = brokerState?.account ?? {};

  results.push(
    apiBaseUrl.includes('paper-api.alpaca.markets')
      ? buildResult('paper_only_check', 'pass', 'paper_account_required', 'Paper endpoint confirmed.')
      : buildResult('paper_only_check', 'block', 'paper_account_required', 'Execution is only allowed against Alpaca paper trading.')
  );

  if (mode === 'paper_execute') {
    results.push(
      config?.alpaca?.tradingEnabled
        ? buildResult('trading_enabled_gate', 'pass', 'trading_disabled', 'Trading gate is enabled.')
        : buildResult('trading_enabled_gate', 'block', 'trading_disabled', 'ALPACA_TRADING_ENABLED=true is required before sending orders.')
    );
  }

  results.push(
    !allowedSymbols.size || allowedSymbols.has(normalizedSymbol)
      ? buildResult('allowed_symbols_check', 'pass', 'symbol_not_allowed', allowedSymbols.size ? 'Symbol is allowed.' : 'No symbol allowlist is configured.')
      : buildResult('allowed_symbols_check', 'block', 'symbol_not_allowed', `Symbol ${normalizedSymbol} is not in the allowed execution list.`)
  );

  const isShortIntent = intent.target_state === 'short'
    || Number(intent.target_exposure_pct ?? 0) < 0
    || String(intent.action_hint ?? '').includes('short');
  results.push(
    isShortIntent && !config?.shortingEnabled
      ? buildResult('shorting_enabled_check', 'block', 'short_not_enabled', 'Short execution is disabled for this account.')
      : buildResult('shorting_enabled_check', 'pass', 'short_not_enabled', isShortIntent ? 'Short execution is enabled.' : 'Long-only rule passed.')
  );

  results.push(
    intent.asset_class === 'us_equity'
      ? buildResult('no_options_check', 'pass', 'options_not_supported', 'Equity asset class passed.')
      : buildResult('no_options_check', 'block', 'options_not_supported', 'Options and non-equity assets are not supported in v1.')
  );

  const signalAgeDays = calculateSignalAgeDays(intent.signal_date, now);
  results.push(
    signalAgeDays <= Number(config.maxSignalAgeDays)
      ? buildResult('stale_signal_check', 'pass', 'signal_stale', `Signal age ${signalAgeDays}d is within limit.`)
      : buildResult('stale_signal_check', 'block', 'signal_stale', `Signal age ${signalAgeDays}d exceeds the configured limit.`)
  );

  const hasConflictingOpenOrder = openOrders.some((order) => normalizeSymbol(order.symbol) === normalizedSymbol);
  results.push(
    hasConflictingOpenOrder
      ? buildResult('open_order_check', 'block', 'open_order_exists', `An open order already exists for ${normalizedSymbol}.`)
      : buildResult('open_order_check', 'pass', 'open_order_exists', 'No conflicting open order exists.')
  );

  const proposalNotional = Math.abs(Number(proposal?.notional ?? 0));
  results.push(
    proposalNotional > Number(config.maxOrderNotionalUsd)
      ? buildResult('max_order_size_check', 'block', 'order_size_exceeded', 'Proposed order notional exceeds configured max order size.')
      : buildResult('max_order_size_check', 'pass', 'order_size_exceeded', 'Order size is within limit.')
  );

  const resultingPositionNotional = Math.abs(Number(proposal?.resultingPositionNotional ?? 0));
  results.push(
    resultingPositionNotional > Number(config.maxPositionNotionalUsd)
      ? buildResult('max_position_size_check', 'block', 'position_size_exceeded', 'Resulting position exceeds configured max position size.')
      : buildResult('max_position_size_check', 'pass', 'position_size_exceeded', 'Position size is within limit.')
  );

  const accountTradeable = account.status === 'ACTIVE' && !account.tradingBlocked && !account.accountBlocked;
  results.push(
    accountTradeable
      ? buildResult('account_tradeable_check', 'pass', 'account_blocked', 'Account is tradeable.')
      : buildResult('account_tradeable_check', 'block', 'account_blocked', 'Account is not in a tradeable state.')
  );

  return results;
}
