import { closePool } from '../lib/db.js';
import { ensureEnvLoaded } from '../lib/env.js';
import { createFetchRunGuard } from '../lib/utils/fetch-run-guard.js';
import { buildBacktestRunArtifacts } from '../lib/utils/backtest-engine.js';
import {
  createBacktestRun,
  failBacktestRun,
  finishBacktestRun,
  getActiveStrategyDefinitions,
  upsertStrategyEquity,
  upsertStrategyPositions,
} from '../lib/repositories/backtests.js';
import { getBenchmarkBars } from '../lib/repositories/benchmark-prices.js';
import { failRunningFetchRuns, finishFetchRun, startFetchRun } from '../lib/repositories/fetch-runs.js';
import { getMarketSignalRows } from '../lib/repositories/market-signals.js';

ensureEnvLoaded();

const fetchRunGuard = createFetchRunGuard({
  finishRun: finishFetchRun,
  closePool,
  setExitCode(code) {
    process.exitCode = code;
  },
});

const unregisterSignalHandlers = fetchRunGuard.register(process);

async function run() {
  await failRunningFetchRuns('backtest_daily', 'backtest:daily interrupted before completion', {
    recoveredBy: 'backtest_daily',
  });
  const fetchRunId = await startFetchRun('backtest_daily');
  fetchRunGuard.setRunId(fetchRunId);

  try {
    const strategies = await getActiveStrategyDefinitions();
    const benchmarkBars = await getBenchmarkBars('SPY');
    const signalRows = await getMarketSignalRows();

    let successfulStrategies = 0;
    const failedStrategies = [];

    for (const strategy of strategies) {
      const runId = await createBacktestRun(strategy);

      try {
        const artifacts = buildBacktestRunArtifacts({
          strategy,
          benchmarkBars,
          signalRows,
        });

        await upsertStrategyPositions(
          artifacts.positions.map((row) => ({ run_id: runId, ...row }))
        );
        await upsertStrategyEquity(
          artifacts.equityRows.map((row) => ({ run_id: runId, ...row }))
        );
        await finishBacktestRun(runId, {
          status: 'success',
          signal_data_end_date: artifacts.summary.signal_data_end_date,
          notes: `strategy=${strategy.code}`,
          cagr: artifacts.summary.cagr,
          max_drawdown: artifacts.summary.max_drawdown,
          sharpe: artifacts.summary.sharpe,
          sortino: artifacts.summary.sortino,
          calmar: artifacts.summary.calmar,
          turnover: artifacts.summary.turnover,
          time_in_market_pct: artifacts.summary.time_in_market_pct,
        });
        successfulStrategies += 1;
      } catch (error) {
        await failBacktestRun(runId, error.message);
        failedStrategies.push({ strategy: strategy.code, error: error.message });
      }
    }

    const failedItems = failedStrategies.length;
    const status = failedItems > 0 ? 'partial_success' : 'success';

    await fetchRunGuard.finish(status, {
      totalItems: strategies.length,
      successfulItems: successfulStrategies,
      failedItems,
      metadata: {
        benchmarkBars: benchmarkBars.length,
        marketSignals: signalRows.length,
        failedStrategies,
      },
    });

    console.log(`Backtest daily completed with status: ${status}`);
    console.log(`Strategies: ${successfulStrategies}/${strategies.length} succeeded.`);
  } catch (error) {
    await fetchRunGuard.finish('failure', {
      errorMessage: error.message,
      metadata: { stack: error.stack },
    });
    throw error;
  }
}

run()
  .catch((error) => {
    console.error('backtest:daily failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    unregisterSignalHandlers();
    await closePool();
  });
