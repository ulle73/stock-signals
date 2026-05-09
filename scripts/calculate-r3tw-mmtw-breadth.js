import { closePool } from '../lib/db.js';
import { ensureEnvLoaded } from '../lib/env.js';
import { buildR3twMmtw20dmaBreadthIndicatorRows } from '../lib/indicators/r3tw-mmtw-20dma-breadth-barchart.js';
import { getR3twMmtwBreadthSourceRows, upsertR3twMmtw20dmaBreadthIndicatorRows } from '../lib/repositories/r3tw-mmtw-breadth-indicator.js';
import { failRunningFetchRuns, finishFetchRun, startFetchRun } from '../lib/repositories/fetch-runs.js';
import { createFetchRunGuard } from '../lib/utils/fetch-run-guard.js';

ensureEnvLoaded();

const JOB_NAME = 'calculate_r3tw_mmtw_breadth';
const fetchRunGuard = createFetchRunGuard({
  finishRun: finishFetchRun,
  closePool,
  setExitCode(code) {
    process.exitCode = code;
  },
});

const unregisterSignalHandlers = fetchRunGuard.register(process);

async function run() {
  await failRunningFetchRuns(JOB_NAME, 'calculate-r3tw-mmtw-breadth interrupted before completion', {
    recoveredBy: JOB_NAME,
  });
  const fetchRunId = await startFetchRun(JOB_NAME);
  fetchRunGuard.setRunId(fetchRunId);

  try {
    const sourceRows = await getR3twMmtwBreadthSourceRows();
    const indicatorRows = buildR3twMmtw20dmaBreadthIndicatorRows(sourceRows);
    const inserted = await upsertR3twMmtw20dmaBreadthIndicatorRows(indicatorRows);

    await fetchRunGuard.finish('success', {
      totalItems: indicatorRows.length,
      successfulItems: inserted,
      failedItems: 0,
      metadata: {
        externalBreadthRowsRead: sourceRows.length,
        breadthRowsCalculated: indicatorRows.length,
      },
    });

    console.log(`Calculated ${indicatorRows.length} R3TW/MMTW breadth indicator rows.`);
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
    console.error('calculate-r3tw-mmtw-breadth failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    unregisterSignalHandlers();
    await closePool();
  });
