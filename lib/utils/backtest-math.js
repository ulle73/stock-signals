import { formatIndicatorValueForStorage } from './rolling-indicators.js';

function toNumber(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  return Number(value);
}

function normalizePercent(value) {
  return Number(formatIndicatorValueForStorage(value));
}

export function deriveAdjustedOpen(bar) {
  const open = toNumber(bar.open);
  const close = toNumber(bar.close);
  const adjClose = toNumber(bar.adj_close);

  if (open === null || close === null || adjClose === null || close === 0) {
    return null;
  }

  return normalizePercent(open * (adjClose / close));
}

export function calculateDailyStrategyReturn({
  previousState,
  nextState,
  previousBar,
  currentBar,
  transactionCostBps,
}) {
  const previousAdjClose = toNumber(previousBar?.adj_close);
  const currentAdjClose = toNumber(currentBar?.adj_close);
  const currentAdjOpen = deriveAdjustedOpen(currentBar);
  const transactionCostPct = normalizePercent(transactionCostBps / 100);

  if (previousState === 'long' && nextState === 'long') {
    return {
      strategyReturnPct: normalizePercent(((currentAdjClose / previousAdjClose) - 1) * 100),
      transactionCostPct: 0,
      tradeAction: 'hold',
    };
  }

  if (previousState === 'cash' && nextState === 'long') {
    return {
      strategyReturnPct: normalizePercent(((currentAdjClose / currentAdjOpen) - 1) * 100 - transactionCostPct),
      transactionCostPct,
      tradeAction: 'enter',
    };
  }

  if (previousState === 'long' && nextState === 'cash') {
    return {
      strategyReturnPct: normalizePercent(((currentAdjOpen / previousAdjClose) - 1) * 100 - transactionCostPct),
      transactionCostPct,
      tradeAction: 'exit',
    };
  }

  return {
    strategyReturnPct: 0,
    transactionCostPct: 0,
    tradeAction: 'stay_out',
  };
}

export function calculateDrawdown(equity, runningPeak) {
  if (!runningPeak) {
    return 0;
  }

  return normalizePercent(((equity / runningPeak) - 1) * 100);
}
