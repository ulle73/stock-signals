import { closePool } from '../lib/db.js';
import { ensureEnvLoaded } from '../lib/env.js';
import { buildMa200BreadthForwardReturnSignalRows } from '../lib/indicators/market-breadth-ma200-forward-return-model.js';
import {
  getMarketBreadthSourceRows,
  upsertMa200BreadthForwardReturnSignalRows,
} from '../lib/repositories/market-breadth-ma200-forward-return-signals.js';
import { failRunningFetchRuns, finishFetchRun, startFetchRun } from '../lib/repositories/fetch-runs.js';
import { createFetchRunGuard } from '../lib/utils/fetch-run-guard.js';

ensureEnvLoaded();

const JOB_NAME = 'calculate_market_breadth_ma200_forward_return';
const fetchRunGuard = createFetchRunGuard({
  finishRun: finishFetchRun,
  closePool,
  setExitCode(code) {
    process.exitCode = code;
  },
});

const unregisterSignalHandlers = fetchRunGuard.register(process);

async function run() {
  await failRunningFetchRuns(JOB_NAME, 'calculate-market-breadth-ma200-forward-return interrupted before completion', {
    recoveredBy: JOB_NAME,
  });
  const fetchRunId = await startFetchRun(JOB_NAME);
  fetchRunGuard.setRunId(fetchRunId);

  try {
    const breadthRows = await getMarketBreadthSourceRows();
    if (!breadthRows.length) {
      throw new Error('No market breadth rows found for MA200 forward-return model.');
    }

    const signalRows = buildMa200BreadthForwardReturnSignalRows({ breadthRows });
    const inserted = await upsertMa200BreadthForwardReturnSignalRows(signalRows);

    await fetchRunGuard.finish('success', {
      totalItems: signalRows.length,
      successfulItems: inserted,
      failedItems: 0,
      metadata: {
        breadthRowsRead: breadthRows.length,
        signalRowsCalculated: signalRows.length,
      },
    });

    console.log(`Calculated ${signalRows.length} MA200 breadth forward-return signal rows.`);
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
    console.error('calculate-market-breadth-ma200-forward-return failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    unregisterSignalHandlers();
    await closePool();
  });
