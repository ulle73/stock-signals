import { getExpectedLatestUsEquityMarketDate } from './us-market-calendar.js';

export const DAILY_REFRESH_EXECUTION_MODES = Object.freeze({
  SKIP: 'skip',
  FETCH_AND_CALCULATE: 'fetch_and_calculate',
  CALCULATE_ONLY: 'calculate_only',
  DEFER: 'defer',
});

function isMissingOrStale(value, expectedLatestMarketDate) {
  return !value || value < expectedLatestMarketDate;
}

function buildTargetStatus(label, value, expectedLatestMarketDate) {
  return {
    label,
    latestDate: value ?? null,
    isStale: isMissingOrStale(value, expectedLatestMarketDate),
  };
}

function buildCoverageTargetStatus(priceTickerCountForExpectedDate, activeTickerCount) {
  const observed = Number(priceTickerCountForExpectedDate);
  const expected = Number(activeTickerCount);
  const hasCoverageCounts = Number.isFinite(observed) && Number.isFinite(expected) && expected > 0;

  return {
    label: 'stock_daily_prices:coverage',
    latestDate: hasCoverageCounts ? `${observed}/${expected}` : null,
    isStale: hasCoverageCounts && observed < expected,
  };
}

export function buildDailyRefreshDecision({
  latestPriceDate,
  latestBenchmarkDate,
  latestMarketSignalDate,
  latestPositionSignalDate,
  priceTickerCountForExpectedDate,
  activeTickerCount,
  runningFetchRunCount = 0,
  expectedLatestMarketDate: expectedLatestMarketDateOverride,
  now = new Date(),
  timeZone = 'America/New_York',
  closeHour = 17,
  closeMinute = 30,
} = {}) {
  const expectedLatestMarketDate = expectedLatestMarketDateOverride ?? getExpectedLatestUsEquityMarketDate({
    now,
    timeZone,
    closeHour,
    closeMinute,
  });

  const sourceTargets = [
    buildTargetStatus('stock_daily_prices', latestPriceDate, expectedLatestMarketDate),
    buildCoverageTargetStatus(priceTickerCountForExpectedDate, activeTickerCount),
    buildTargetStatus('benchmark_daily_prices:SPY', latestBenchmarkDate, expectedLatestMarketDate),
  ];
  const derivedTargets = [
    buildTargetStatus('market_signal_daily', latestMarketSignalDate, expectedLatestMarketDate),
    buildTargetStatus('position_signal_daily', latestPositionSignalDate, expectedLatestMarketDate),
  ];

  const targets = [...sourceTargets, ...derivedTargets];
  const sourceStaleTargets = sourceTargets.filter((target) => target.isStale);
  const derivedStaleTargets = derivedTargets.filter((target) => target.isStale);
  const staleTargets = targets.filter((target) => target.isStale);
  const blockedByRunningFetch = Number(runningFetchRunCount) > 0;
  const rawDataNeeded = sourceStaleTargets.length > 0;
  const derivedCalculationNeeded = rawDataNeeded || derivedStaleTargets.length > 0;

  let executionMode;
  if (blockedByRunningFetch && staleTargets.length > 0) {
    executionMode = DAILY_REFRESH_EXECUTION_MODES.DEFER;
  } else if (rawDataNeeded) {
    executionMode = DAILY_REFRESH_EXECUTION_MODES.FETCH_AND_CALCULATE;
  } else if (derivedStaleTargets.length > 0) {
    executionMode = DAILY_REFRESH_EXECUTION_MODES.CALCULATE_ONLY;
  } else {
    executionMode = DAILY_REFRESH_EXECUTION_MODES.SKIP;
  }

  const refreshNeeded = [
    DAILY_REFRESH_EXECUTION_MODES.FETCH_AND_CALCULATE,
    DAILY_REFRESH_EXECUTION_MODES.CALCULATE_ONLY,
  ].includes(executionMode);

  let reason;

  if (executionMode === DAILY_REFRESH_EXECUTION_MODES.FETCH_AND_CALCULATE) {
    reason = `Expected market date ${expectedLatestMarketDate} is missing from source data: ${sourceStaleTargets.map((target) => target.label).join(', ')}.`;
  } else if (executionMode === DAILY_REFRESH_EXECUTION_MODES.CALCULATE_ONLY) {
    reason = `Expected market date ${expectedLatestMarketDate} is missing from derived data: ${derivedStaleTargets.map((target) => target.label).join(', ')}.`;
  } else if (executionMode === DAILY_REFRESH_EXECUTION_MODES.DEFER) {
    reason = `Expected market date ${expectedLatestMarketDate} is still missing, but fetch_daily is already running.`;
  } else {
    reason = `All tracked datasets are current for expected market date ${expectedLatestMarketDate}.`;
  }

  return {
    refreshNeeded,
    blockedByRunningFetch,
    executionMode,
    rawDataNeeded,
    derivedCalculationNeeded,
    expectedLatestMarketDate,
    runningFetchRunCount: Number(runningFetchRunCount) || 0,
    targets,
    staleTargets,
    sourceStaleTargets,
    derivedStaleTargets,
    reason,
  };
}
