import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDailyRefreshDecision } from '../lib/utils/daily-refresh-check.js';

const afterCloseNow = new Date('2026-06-16T22:00:00.000Z');

test('daily refresh check skips when all tracked datasets are current', () => {
  const decision = buildDailyRefreshDecision({
    latestPriceDate: '2026-06-16',
    latestBenchmarkDate: '2026-06-16',
    latestMarketSignalDate: '2026-06-16',
    latestPositionSignalDate: '2026-06-16',
    now: afterCloseNow,
  });

  assert.equal(decision.refreshNeeded, false);
  assert.equal(decision.staleTargets.length, 0);
  assert.match(decision.reason, /current for expected market date 2026-06-16/i);
});

test('daily refresh check requests rerun when raw prices are stale', () => {
  const decision = buildDailyRefreshDecision({
    latestPriceDate: '2026-06-12',
    latestBenchmarkDate: '2026-06-12',
    latestMarketSignalDate: '2026-06-12',
    latestPositionSignalDate: '2026-06-12',
    now: new Date('2026-06-16T12:30:00.000Z'),
  });

  assert.equal(decision.expectedLatestMarketDate, '2026-06-15');
  assert.equal(decision.refreshNeeded, true);
  assert.deepEqual(
    decision.staleTargets.map((target) => target.label),
    [
      'stock_daily_prices',
      'benchmark_daily_prices:SPY',
      'market_signal_daily',
      'position_signal_daily',
    ]
  );
});

test('daily refresh check requests rerun when downstream signals are stale', () => {
  const decision = buildDailyRefreshDecision({
    latestPriceDate: '2026-06-16',
    latestBenchmarkDate: '2026-06-16',
    latestMarketSignalDate: '2026-06-15',
    latestPositionSignalDate: '2026-06-16',
    now: afterCloseNow,
  });

  assert.equal(decision.refreshNeeded, true);
  assert.deepEqual(
    decision.staleTargets.map((target) => target.label),
    ['market_signal_daily']
  );
});

test('daily refresh check does not trigger duplicate work while fetch is already running', () => {
  const decision = buildDailyRefreshDecision({
    latestPriceDate: '2026-06-12',
    latestBenchmarkDate: '2026-06-12',
    latestMarketSignalDate: '2026-06-12',
    latestPositionSignalDate: '2026-06-12',
    runningFetchRunCount: 1,
    now: new Date('2026-06-16T12:30:00.000Z'),
  });

  assert.equal(decision.refreshNeeded, false);
  assert.equal(decision.blockedByRunningFetch, true);
  assert.match(decision.reason, /already running/i);
});
