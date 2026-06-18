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

function normalizeTicker(value) {
  return String(value ?? '').trim().toUpperCase();
}

function normalizeTickerList(value) {
  const source = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? JSON.parse(value)
      : [];

  return source
    .map((ticker) => normalizeTicker(ticker))
    .filter(Boolean);
}

function buildPriceByTicker(rows) {
  const byTicker = new Map();

  for (const row of rows ?? []) {
    const price = Number(row.adj_close ?? row.close);
    const ticker = normalizeTicker(row.ticker);
    if (!ticker || !Number.isFinite(price) || price <= 0) continue;
    byTicker.set(ticker, price);
  }

  return byTicker;
}

function buildMarkovByTicker(rows) {
  const byTicker = new Map();

  for (const row of rows ?? []) {
    const ticker = normalizeTicker(row.ticker);
    if (!ticker) continue;
    byTicker.set(ticker, row);
  }

  return byTicker;
}

function isUsableMarkovRow(strategy, row) {
  const markovTotal = Number(row?.markov_total);
  return Number.isFinite(markovTotal)
    && Number(row?.sample_size ?? 0) >= strategy.minSampleSize;
}

function buildShortDailyGuardSet(strategy, rows) {
  const guardSize = Math.max(strategy.size * 3, strategy.size);

  return new Set(
    [...(rows ?? [])]
      .filter((row) => isUsableMarkovRow(strategy, row) && row.signal === 'sell')
      .sort((left, right) => Number(left.markov_total) - Number(right.markov_total))
      .slice(0, guardSize)
      .map((row) => normalizeTicker(row.ticker))
      .filter(Boolean)
  );
}

function getShortDailyExitReason(strategy, row, shortDailyGuardSet, ticker) {
  if (!row) return 'missing_markov_row';
  if (Number(row.sample_size ?? 0) < strategy.minSampleSize) return 'sample_size_below_min';
  if (row.signal !== 'sell') return 'signal_not_sell';

  const markovTotal = Number(row.markov_total);
  if (!Number.isFinite(markovTotal)) return 'missing_markov_total';
  if (markovTotal > 0) return 'markov_total_positive';
  if (!shortDailyGuardSet.has(ticker)) return 'outside_bottom_guard';

  return null;
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
      .map((position) => normalizeTicker(position.symbol))
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

function getTargetExposurePct(strategy, targetTickers, rebalanceMode) {
  if (!targetTickers.length) return 0;
  if (strategy.side === 'short' && rebalanceMode === 'daily_exit') {
    return -100 / strategy.size;
  }

  return (strategy.side === 'short' ? -100 : 100) / targetTickers.length;
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
  const cashMetadataByTicker = new Map();

  if (willRebalance) {
    targetTickers = marketAllowsExposure(strategy, tradingSignalByDate, snapshot.signalDate)
      ? pickTickers(strategy, snapshot.markovRows).map((ticker) => normalizeTicker(ticker)).filter(Boolean)
      : [];
    rebalanceMode = 'rebalance';
  } else if (strategy.side === 'short' && strategy.rebalanceFrequency === 'weekly' && carryoverTickers.length) {
    const markovByTicker = buildMarkovByTicker(snapshot.markovRows);
    const shortDailyGuardSet = buildShortDailyGuardSet(strategy, snapshot.markovRows);

    targetTickers = carryoverTickers.filter((ticker) => {
      const reason = getShortDailyExitReason(strategy, markovByTicker.get(ticker), shortDailyGuardSet, ticker);
      if (reason) {
        cashMetadataByTicker.set(ticker, { short_daily_exit_reason: reason });
        return false;
      }
      return true;
    });

    const targetTickerSet = new Set(targetTickers);
    for (const symbol of heldTickerSet) {
      if (!targetTickerSet.has(symbol) && !cashMetadataByTicker.has(symbol)) {
        cashMetadataByTicker.set(symbol, {
          short_daily_exit_reason: carryoverTickerSet.has(symbol) ? 'daily_guard_failed' : 'not_in_carryover_basket',
        });
      }
    }

    if (setsEqual(heldTickerSet, targetTickerSet)) {
      return [];
    }

    rebalanceMode = 'daily_exit';
  } else if (!setsEqual(heldTickerSet, carryoverTickerSet)) {
    targetTickers = carryoverTickers;
    rebalanceMode = 'sync_carryover';
  } else {
    return [];
  }

  const targetTickerSet = new Set(targetTickers);
  const targetExposurePct = getTargetExposurePct(strategy, targetTickers, rebalanceMode);
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
      adapter_metadata_json: {
        ...baseIntent.adapter_metadata_json,
        ...(cashMetadataByTicker.get(symbol) ?? {}),
      },
    });
  }

  return intents;
}
