function toNumber(value) {
  if (value === null || value === undefined || value === '') {
    return 0;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeAccount(account = {}, apiBaseUrl) {
  return {
    id: account.id ?? null,
    status: account.status ?? null,
    currency: account.currency ?? null,
    cash: toNumber(account.cash),
    equity: toNumber(account.equity),
    portfolioValue: toNumber(account.portfolio_value ?? account.portfolioValue ?? account.equity),
    buyingPower: toNumber(account.buying_power ?? account.buyingPower),
    tradingBlocked: Boolean(account.trading_blocked ?? account.tradingBlocked),
    transfersBlocked: Boolean(account.transfers_blocked ?? account.transfersBlocked),
    accountBlocked: Boolean(account.account_blocked ?? account.accountBlocked),
    apiBaseUrl,
  };
}

function normalizePosition(position = {}) {
  return {
    id: position.asset_id ?? position.id ?? null,
    symbol: position.symbol ?? null,
    qty: toNumber(position.qty),
    marketValue: toNumber(position.market_value ?? position.marketValue),
    side: position.side ?? null,
  };
}

function normalizeOpenOrder(order = {}) {
  return {
    id: order.id ?? null,
    symbol: order.symbol ?? null,
    side: order.side ?? null,
    qty: toNumber(order.qty),
    notional: toNumber(order.notional),
    status: order.status ?? null,
  };
}

export function normalizeAlpacaBrokerState({
  apiBaseUrl,
  account,
  positions = [],
  openOrders = [],
}) {
  return {
    metadata: {
      broker: 'alpaca',
      apiBaseUrl,
    },
    account: normalizeAccount(account, apiBaseUrl),
    positions: positions.map((position) => normalizePosition(position)),
    openOrders: openOrders.map((order) => normalizeOpenOrder(order)),
  };
}

export function buildBrokerStateSnapshotRows({
  broker = 'alpaca',
  capturedAt,
  normalizedState,
  rawState,
}) {
  const rows = [
    {
      broker,
      snapshot_type: 'account',
      symbol: null,
      broker_object_id: normalizedState.account.id,
      captured_at: capturedAt,
      normalized_json: normalizedState.account,
      payload_json: rawState.account ?? {},
    },
  ];

  for (let index = 0; index < normalizedState.positions.length; index += 1) {
    rows.push({
      broker,
      snapshot_type: 'position',
      symbol: normalizedState.positions[index].symbol,
      broker_object_id: normalizedState.positions[index].id,
      captured_at: capturedAt,
      normalized_json: normalizedState.positions[index],
      payload_json: rawState.positions?.[index] ?? {},
    });
  }

  for (let index = 0; index < normalizedState.openOrders.length; index += 1) {
    rows.push({
      broker,
      snapshot_type: 'open_order',
      symbol: normalizedState.openOrders[index].symbol,
      broker_object_id: normalizedState.openOrders[index].id,
      captured_at: capturedAt,
      normalized_json: normalizedState.openOrders[index],
      payload_json: rawState.openOrders?.[index] ?? {},
    });
  }

  return rows;
}

export async function fetchAndNormalizeAlpacaState({
  brokerClient,
  config,
  capturedAt = new Date().toISOString(),
}) {
  const [account, positions, openOrders] = await Promise.all([
    brokerClient.getAccount(),
    brokerClient.getPositions(),
    brokerClient.getOpenOrders(),
  ]);
  const rawState = {
    account,
    positions: Array.isArray(positions) ? positions : [],
    openOrders: Array.isArray(openOrders) ? openOrders : [],
  };
  const normalizedState = normalizeAlpacaBrokerState({
    apiBaseUrl: config.alpaca.apiBaseUrl,
    ...rawState,
  });
  const snapshotRows = buildBrokerStateSnapshotRows({
    broker: 'alpaca',
    capturedAt,
    normalizedState,
    rawState,
  });

  return {
    rawState,
    brokerState: normalizedState,
    normalizedState,
    snapshotRows,
  };
}
