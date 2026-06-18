import fs from 'node:fs';
import { closePool, query } from '../lib/db.js';
import { ensureEnvLoaded } from '../lib/env.js';
import { buildDailyRefreshDecision } from '../lib/utils/daily-refresh-check.js';

ensureEnvLoaded();

function writeOutput(key, value) {
  const outputPath = process.env.GITHUB_OUTPUT;
  if (!outputPath) return;
  fs.appendFileSync(outputPath, `${key}=${String(value)}\n`);
}

async function loadRefreshSnapshot() {
  const result = await query(
    `select
       (select max(date)::text from stock_daily_prices) as latest_price_date,
       (select max(date)::text from benchmark_daily_prices where ticker = 'SPY') as latest_benchmark_date,
       (select max(date)::text from market_signal_daily) as latest_market_signal_date,
       (select max(date)::text from position_signal_daily) as latest_position_signal_date,
       (select count(*)::int from data_fetch_runs where job_name = 'fetch_daily' and status = 'running') as running_fetch_run_count`
  );

  return result.rows[0] ?? {};
}

async function run() {
  const snapshot = await loadRefreshSnapshot();
  const decision = buildDailyRefreshDecision({
    latestPriceDate: snapshot.latest_price_date,
    latestBenchmarkDate: snapshot.latest_benchmark_date,
    latestMarketSignalDate: snapshot.latest_market_signal_date,
    latestPositionSignalDate: snapshot.latest_position_signal_date,
    runningFetchRunCount: snapshot.running_fetch_run_count,
  });

  console.log(JSON.stringify({
    refreshNeeded: decision.refreshNeeded,
    blockedByRunningFetch: decision.blockedByRunningFetch,
    expectedLatestMarketDate: decision.expectedLatestMarketDate,
    latestPriceDate: snapshot.latest_price_date ?? null,
    latestBenchmarkDate: snapshot.latest_benchmark_date ?? null,
    latestMarketSignalDate: snapshot.latest_market_signal_date ?? null,
    latestPositionSignalDate: snapshot.latest_position_signal_date ?? null,
    staleTargets: decision.staleTargets.map((target) => target.label),
    reason: decision.reason,
  }, null, 2));

  writeOutput('refresh_needed', decision.refreshNeeded ? 'true' : 'false');
  writeOutput('expected_latest_market_date', decision.expectedLatestMarketDate);
  writeOutput('latest_price_date', snapshot.latest_price_date ?? '');
  writeOutput('latest_benchmark_date', snapshot.latest_benchmark_date ?? '');
  writeOutput('latest_market_signal_date', snapshot.latest_market_signal_date ?? '');
  writeOutput('latest_position_signal_date', snapshot.latest_position_signal_date ?? '');
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
