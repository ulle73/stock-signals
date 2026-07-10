import fs from 'node:fs';
import { closePool, query } from '../lib/db.js';
import { ensureEnvLoaded } from '../lib/env.js';
import { buildDailyRefreshDecision } from '../lib/utils/daily-refresh-check.js';
import { getExpectedLatestUsEquityMarketDate } from '../lib/utils/us-market-calendar.js';

ensureEnvLoaded();

function writeOutput(key, value) {
  const outputPath = process.env.GITHUB_OUTPUT;
  if (!outputPath) return;
  fs.appendFileSync(outputPath, `${key}=${String(value)}\n`);
}

async function loadRefreshSnapshot(expectedLatestMarketDate) {
  const result = await query(
    `select
       (select max(date)::text from stock_daily_prices) as latest_price_date,
       (select max(date)::text from benchmark_daily_prices where ticker = 'SPY') as latest_benchmark_date,
       (select max(date)::text from market_signal_daily) as latest_market_signal_date,
       (select max(date)::text from position_signal_daily) as latest_position_signal_date,
       (select count(*)::int from stock_daily_prices where date = $1::date) as price_ticker_count_for_expected_date,
       (select count(*)::int from sp500_constituents where is_active = true) as active_ticker_count,
       (select count(*)::int from data_fetch_runs where job_name = 'fetch_daily' and status = 'running') as running_fetch_run_count`
    ,
    [expectedLatestMarketDate]
  );

  return result.rows[0] ?? {};
}

async function run() {
  const expectedLatestMarketDate = getExpectedLatestUsEquityMarketDate();
  const snapshot = await loadRefreshSnapshot(expectedLatestMarketDate);
  const decision = buildDailyRefreshDecision({
    latestPriceDate: snapshot.latest_price_date,
    latestBenchmarkDate: snapshot.latest_benchmark_date,
    latestMarketSignalDate: snapshot.latest_market_signal_date,
    latestPositionSignalDate: snapshot.latest_position_signal_date,
    priceTickerCountForExpectedDate: snapshot.price_ticker_count_for_expected_date,
    activeTickerCount: snapshot.active_ticker_count,
    runningFetchRunCount: snapshot.running_fetch_run_count,
    expectedLatestMarketDate,
  });

  console.log(JSON.stringify({
    executionMode: decision.executionMode,
    refreshNeeded: decision.refreshNeeded,
    rawDataNeeded: decision.rawDataNeeded,
    derivedCalculationNeeded: decision.derivedCalculationNeeded,
    blockedByRunningFetch: decision.blockedByRunningFetch,
    expectedLatestMarketDate: decision.expectedLatestMarketDate,
    latestPriceDate: snapshot.latest_price_date ?? null,
    latestBenchmarkDate: snapshot.latest_benchmark_date ?? null,
    latestMarketSignalDate: snapshot.latest_market_signal_date ?? null,
    latestPositionSignalDate: snapshot.latest_position_signal_date ?? null,
    priceTickerCountForExpectedDate: snapshot.price_ticker_count_for_expected_date ?? null,
    activeTickerCount: snapshot.active_ticker_count ?? null,
    staleTargets: decision.staleTargets.map((target) => target.label),
    reason: decision.reason,
  }, null, 2));

  writeOutput('execution_mode', decision.executionMode);
  writeOutput('refresh_skip', decision.refreshNeeded ? 'no' : 'yes');
  writeOutput('expected_latest_market_date', decision.expectedLatestMarketDate);
  writeOutput('latest_price_date', snapshot.latest_price_date ?? '');
  writeOutput('latest_benchmark_date', snapshot.latest_benchmark_date ?? '');
  writeOutput('latest_market_signal_date', snapshot.latest_market_signal_date ?? '');
  writeOutput('latest_position_signal_date', snapshot.latest_position_signal_date ?? '');
  writeOutput('price_ticker_count', snapshot.price_ticker_count_for_expected_date ?? '');
  writeOutput('active_ticker_count', snapshot.active_ticker_count ?? '');
  writeOutput('reason', decision.reason);
}

run()
  .catch((error) => {
    console.error('check:daily-refresh-needed failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closePool();
  });
