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
  previousWeight,
  nextWeight,
  previousBar,
  currentBar,
  transactionCostBps,
}) {
  const previousAdjClose = toNumber(previousBar?.adj_close);
  const currentAdjClose = toNumber(currentBar?.adj_close);
  const currentAdjOpen = deriveAdjustedOpen(currentBar);
  const resolvedPreviousWeight = previousWeight ?? (previousState === 'long' ? 1 : 0);
  const resolvedNextWeight = nextWeight ?? (nextState === 'long' ? 1 : 0);
  const weightDelta = Math.abs(resolvedNextWeight - resolvedPreviousWeight);
  const transactionCostPct = normalizePercent((transactionCostBps / 100) * weightDelta);

  if (resolvedPreviousWeight > 0 && resolvedNextWeight > 0 && resolvedPreviousWeight === resolvedNextWeight) {
    return {
      strategyReturnPct: normalizePercent((((currentAdjClose / previousAdjClose) - 1) * 100) * resolvedNextWeight),
      transactionCostPct: 0,
      tradeAction: 'hold',
    };
  }

  if (resolvedPreviousWeight > 0 || resolvedNextWeight > 0) {
    const overnightReturnPct = previousAdjClose && currentAdjOpen
      ? ((currentAdjOpen / previousAdjClose) - 1) * 100
      : 0;
    const intradayReturnPct = currentAdjOpen && currentAdjClose
      ? ((currentAdjClose / currentAdjOpen) - 1) * 100
      : 0;
    const strategyReturnPct = normalizePercent(
      (overnightReturnPct * resolvedPreviousWeight) +
      (intradayReturnPct * resolvedNextWeight) -
      transactionCostPct
    );

    return {
      strategyReturnPct,
      transactionCostPct,
      tradeAction:
        resolvedPreviousWeight === 0
          ? 'enter'
          : resolvedNextWeight === 0
            ? 'exit'
            : resolvedPreviousWeight !== resolvedNextWeight
              ? 'rebalance'
              : 'hold',
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
