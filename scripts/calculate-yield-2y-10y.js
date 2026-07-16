import { closePool } from '../lib/db.js';
import { ensureEnvLoaded } from '../lib/env.js';
import { buildYield2y10yIndicatorRows } from '../lib/indicators/yield-2y-10y.js';
import { failRunningFetchRuns, finishFetchRun, startFetchRun } from '../lib/repositories/fetch-runs.js';
import {
  getYield2y10ySourceRows,
  upsertYield2y10yIndicatorRows,
} from '../lib/repositories/yield-2y-10y-indicator.js';
import { createFetchRunGuard } from '../lib/utils/fetch-run-guard.js';

ensureEnvLoaded();

const JOB_NAME = 'calculate_yield_2y_10y';
const fetchRunGuard = createFetchRunGuard({
  finishRun: finishFetchRun,
  closePool,
  setExitCode(code) {
    process.exitCode = code;
  },
});
const unregisterSignalHandlers = fetchRunGuard.register(process);

async function run() {
  await failRunningFetchRuns(JOB_NAME, 'calculate-yield-2y-10y interrupted before completion', {
    recoveredBy: JOB_NAME,
  });
  const fetchRunId = await startFetchRun(JOB_NAME);
  fetchRunGuard.setRunId(fetchRunId);

  try {
    const sourceRows = await getYield2y10ySourceRows();
    const indicatorRows = buildYield2y10yIndicatorRows(sourceRows);
    if (!indicatorRows.length) {
      throw new Error('No aligned DGS2, DGS10, and FEDFUNDS rows found for yield calculation.');
    }
    const inserted = await upsertYield2y10yIndicatorRows(indicatorRows);
    await fetchRunGuard.finish('success', {
      totalItems: indicatorRows.length,
      successfulItems: inserted,
      failedItems: 0,
      metadata: { sourceRowsRead: sourceRows.length, yieldRowsCalculated: indicatorRows.length },
    });
    console.log(`Calculated ${indicatorRows.length} 2Y + 10Y yield indicator rows.`);
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
    console.error('calculate-yield-2y-10y failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    unregisterSignalHandlers();
    await closePool();
  });
