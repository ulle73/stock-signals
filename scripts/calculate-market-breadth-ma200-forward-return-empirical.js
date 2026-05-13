import { closePool } from '../lib/db.js';
import { ensureEnvLoaded } from '../lib/env.js';
import {
  buildMa200BreadthForwardReturnEmpiricalRows,
  EMPIRICAL_FORWARD_MODEL_VERSION,
} from '../lib/indicators/market-breadth-ma200-forward-return-empirical.js';
import { getBenchmarkBars } from '../lib/repositories/benchmark-prices.js';
import {
  getMarketBreadthSourceRows,
} from '../lib/repositories/market-breadth-ma200-forward-return-signals.js';
import {
  upsertMa200BreadthForwardReturnEmpiricalRows,
} from '../lib/repositories/market-breadth-ma200-forward-return-empirical.js';
import { failRunningFetchRuns, finishFetchRun, startFetchRun } from '../lib/repositories/fetch-runs.js';
import { createFetchRunGuard } from '../lib/utils/fetch-run-guard.js';

ensureEnvLoaded();

const BENCHMARK_SYMBOL = 'SPY';
const JOB_NAME = 'calculate_market_breadth_ma200_forward_return_empirical';
const fetchRunGuard = createFetchRunGuard({
  finishRun: finishFetchRun,
  closePool,
  setExitCode(code) {
    process.exitCode = code;
  },
});

const unregisterSignalHandlers = fetchRunGuard.register(process);

async function run() {
  await failRunningFetchRuns(JOB_NAME, 'calculate-market-breadth-ma200-forward-return-empirical interrupted before completion', {
    recoveredBy: JOB_NAME,
  });
  const fetchRunId = await startFetchRun(JOB_NAME);
  fetchRunGuard.setRunId(fetchRunId);

  try {
    const breadthRows = await getMarketBreadthSourceRows();
    if (!breadthRows.length) {
      throw new Error('No market breadth rows found for empirical MA200 forward-return model.');
    }

    const benchmarkRows = await getBenchmarkBars(BENCHMARK_SYMBOL);
    if (!benchmarkRows.length) {
      throw new Error(`No benchmark rows found for ${BENCHMARK_SYMBOL}.`);
    }

    const empiricalRows = buildMa200BreadthForwardReturnEmpiricalRows({
      breadthRows,
      benchmarkRows,
      benchmarkSymbol: BENCHMARK_SYMBOL,
    });
    const inserted = await upsertMa200BreadthForwardReturnEmpiricalRows(empiricalRows);

    await fetchRunGuard.finish('success', {
      totalItems: empiricalRows.length,
      successfulItems: inserted,
      failedItems: 0,
      metadata: {
        benchmarkSymbol: BENCHMARK_SYMBOL,
        benchmarkRowsRead: benchmarkRows.length,
        breadthRowsRead: breadthRows.length,
        empiricalRowsCalculated: empiricalRows.length,
        modelVersion: EMPIRICAL_FORWARD_MODEL_VERSION,
      },
    });

    console.log(`Calculated ${empiricalRows.length} empirical MA200 breadth forward-return rows for ${BENCHMARK_SYMBOL}.`);
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
    console.error('calculate-market-breadth-ma200-forward-return-empirical failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    unregisterSignalHandlers();
    await closePool();
  });
