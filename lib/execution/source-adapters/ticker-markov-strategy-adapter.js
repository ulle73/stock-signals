import { getLatestTickerMarkovExecutionInputs } from '../../repositories/ticker-markov-strategy-studies.js';
import {
  getTickerMarkovStrategyByName,
  marketAllowsExposure,
  pickTickers,
  shouldRebalance,
} from '../../utils/ticker-markov-strategy-study.js';

const DEFAULT_REPOSITORY = {
  getLatestTickerMarkovExecutionInputs,
};

function formatDateInTimeZone(value, timeZone) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  return formatter.format(value);
}

function addDays(dateText, days) {
  const date = new Date(`${dateText}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function normalizeTickerList(value) {
  const source = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? JSON.parse(value)
      : [];

  return source
    .map((ticker) => String(ticker ?? '').trim().toUpperCase())
    .filter(Boolean);
}

function buildPriceByTicker(rows) {
  const byTicker = new Map();

  for (const row of rows ?? []) {
    const price = Number(row.adj_close ?? row.close);
    if (!row.ticker || !Number.isFinite(price) || price <= 0) continue;
    byTicker.set(String(row.ticker).trim().toUpperCase(), price);
  }

  return byTicker;
}

function buildTradingSignalByDate(row) {
  const byDate = new Map();

  if (row?.date) {
    byDate.set(row.date, row);
  }

  return byDate;
}

function buildHeldTickerSet(brokerState) {
  return new Set(
    (brokerState?.positions ?? [])
      .filter((position) => Math.abs(Number(position.qty ?? 0)) > 0)
      .map((position) => String(position.symbol ?? '').trim().toUpperCase())
      .filter(Boolean)
  );
}

function setsEqual(left, right) {
  if (left.size !== right.size) return false;
  for (const value of left) {
    if (!right.has(value)) return false;
  }
  return true;
}

function buildBaseIntent({
  strategy,
  signalDate,
  nextTradingDate,
  targetTickers,
  rebalanceMode,
}) {
  return {
    source_type: 'ticker_markov_daily',
    source_table: 'ticker_markov_daily',
    source_row_key: `${strategy.name}:${signalDate}`,
    strategy_code: `ticker_markov_${strategy.name}`,
    asset_class: 'us_equity',
    signal_date: signalDate,
    signal_timestamp: `${signalDate}T00:00:00.000Z`,
    reason_summary: `Ticker Markov ${strategy.name}`,
    adapter_metadata_json: {
      strategy_name: strategy.name,
      next_trading_date: nextTradingDate,
      rebalance_frequency: strategy.rebalanceFrequency,
      holding_days: strategy.holdingDays,
      rebalance_mode: rebalanceMode,
      ticker_count: targetTickers.length,
    },
  };
}

async function getNextTradingDate(brokerClient, signalDate) {
  const calendarRows = await brokerClient.getCalendar({
    start: signalDate,
    end: addDays(signalDate, 10),
  });

  return (calendarRows ?? [])
    .map((row) => row?.date)
    .find((date) => typeof date === 'string' && date > signalDate) ?? null;
}

export async function getLatestTickerMarkovStrategyExecutionIntents({
  strategyName,
  brokerState,
  brokerClient,
  now = new Date(),
  repository = DEFAULT_REPOSITORY,
}) {
  const strategy = getTickerMarkovStrategyByName(strategyName);
  if (!strategy) {
    throw new Error(`Unsupported ticker Markov strategy: ${strategyName}`);
  }

  const snapshot = await repository.getLatestTickerMarkovExecutionInputs({ strategyName });
  if (!snapshot?.signalDate || !snapshot.markovRows?.length) {
    return [];
  }

  const currentNyDate = formatDateInTimeZone(now, 'America/New_York');
  if (snapshot.signalDate !== currentNyDate) {
    return [];
  }

  const nextTradingDate = await getNextTradingDate(brokerClient, snapshot.signalDate);
  if (!nextTradingDate) {
    return [];
  }

  const willRebalance = shouldRebalance(strategy, snapshot.signalDate, nextTradingDate, true);
  const tradingSignalByDate = buildTradingSignalByDate(snapshot.tradingSignalRow);
  const carryoverTickers = normalizeTickerList(snapshot.strategyDailyRow?.tickers);
  const carryoverTickerSet = new Set(carryoverTickers);
  const heldTickerSet = buildHeldTickerSet(brokerState);

  let targetTickers = [];
  let rebalanceMode = 'carry';

  if (willRebalance) {
    targetTickers = marketAllowsExposure(strategy, tradingSignalByDate, snapshot.signalDate)
      ? pickTickers(strategy, snapshot.markovRows)
      : [];
    rebalanceMode = 'rebalance';
  } else if (!setsEqual(heldTickerSet, carryoverTickerSet)) {
    targetTickers = carryoverTickers;
    rebalanceMode = 'sync_carryover';
  } else {
    return [];
  }

  const targetTickerSet = new Set(targetTickers);
  const targetExposurePct = targetTickers.length
    ? (strategy.side === 'short' ? -100 : 100) / targetTickers.length
    : 0;
  const priceByTicker = buildPriceByTicker(snapshot.priceRows);
  const baseIntent = buildBaseIntent({
    strategy,
    signalDate: snapshot.signalDate,
    nextTradingDate,
    targetTickers,
    rebalanceMode,
  });
  const intents = [];

  for (const symbol of targetTickers) {
    intents.push({
      ...baseIntent,
      symbol,
      intent_status: 'active',
      target_state: strategy.side === 'short' ? 'short' : 'long',
      target_exposure_pct: targetExposurePct,
      action_hint: strategy.side === 'short' ? 'enter_short' : 'go_long',
      reference_price: priceByTicker.get(symbol) ?? null,
      adapter_metadata_json: {
        ...baseIntent.adapter_metadata_json,
        reference_price: priceByTicker.get(symbol) ?? null,
      },
    });
  }

  for (const symbol of heldTickerSet) {
    if (targetTickerSet.has(symbol)) continue;

    intents.push({
      ...baseIntent,
      symbol,
      intent_status: 'active',
      target_state: 'cash',
      target_exposure_pct: 0,
      action_hint: 'go_cash',
    });
  }

  return intents;
}
