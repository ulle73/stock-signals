import { getExpectedLatestUsEquityMarketDate } from './us-market-calendar.js';

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

export function buildDailyRefreshDecision({
  latestPriceDate,
  latestBenchmarkDate,
  latestMarketSignalDate,
  latestPositionSignalDate,
  runningFetchRunCount = 0,
  now = new Date(),
  timeZone = 'America/New_York',
  closeHour = 17,
  closeMinute = 30,
} = {}) {
  const expectedLatestMarketDate = getExpectedLatestUsEquityMarketDate({
    now,
    timeZone,
    closeHour,
    closeMinute,
  });

  const targets = [
    buildTargetStatus('stock_daily_prices', latestPriceDate, expectedLatestMarketDate),
    buildTargetStatus('benchmark_daily_prices:SPY', latestBenchmarkDate, expectedLatestMarketDate),
    buildTargetStatus('market_signal_daily', latestMarketSignalDate, expectedLatestMarketDate),
    buildTargetStatus('position_signal_daily', latestPositionSignalDate, expectedLatestMarketDate),
  ];

  const staleTargets = targets.filter((target) => target.isStale);
  const blockedByRunningFetch = Number(runningFetchRunCount) > 0;
  const refreshNeeded = staleTargets.length > 0 && !blockedByRunningFetch;

  let reason;

  if (refreshNeeded) {
    reason = `Expected market date ${expectedLatestMarketDate} is missing from ${staleTargets.map((target) => target.label).join(', ')}.`;
  } else if (blockedByRunningFetch && staleTargets.length > 0) {
    reason = `Expected market date ${expectedLatestMarketDate} is still missing, but fetch_daily is already running.`;
  } else {
    reason = `All tracked datasets are current for expected market date ${expectedLatestMarketDate}.`;
  }

  return {
    refreshNeeded,
    blockedByRunningFetch,
    expectedLatestMarketDate,
    runningFetchRunCount: Number(runningFetchRunCount) || 0,
    targets,
    staleTargets,
    reason,
  };
}
