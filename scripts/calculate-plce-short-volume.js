import { closePool } from '../lib/db.js';
import { ensureEnvLoaded } from '../lib/env.js';
import { buildPlceShortVolumeIndicatorRows } from '../lib/indicators/plce-short-volume-zscore-finra.js';
import { failRunningFetchRuns, finishFetchRun, startFetchRun } from '../lib/repositories/fetch-runs.js';
import { getPlceShortVolumeSourceRows, upsertPlceShortVolumeIndicatorRows } from '../lib/repositories/plce-short-volume-indicator.js';
import { createFetchRunGuard } from '../lib/utils/fetch-run-guard.js';

ensureEnvLoaded();

const JOB_NAME = 'calculate_plce_short_volume';
const fetchRunGuard = createFetchRunGuard({
  finishRun: finishFetchRun,
  closePool,
  setExitCode(code) {
    process.exitCode = code;
  },
});

const unregisterSignalHandlers = fetchRunGuard.register(process);

async function run() {
  await failRunningFetchRuns(JOB_NAME, 'calculate-plce-short-volume interrupted before completion', {
    recoveredBy: JOB_NAME,
  });
  const fetchRunId = await startFetchRun(JOB_NAME);
  fetchRunGuard.setRunId(fetchRunId);

  try {
    const sourceRows = await getPlceShortVolumeSourceRows();
    const indicatorRows = buildPlceShortVolumeIndicatorRows(sourceRows);
    const inserted = await upsertPlceShortVolumeIndicatorRows(indicatorRows);

    await fetchRunGuard.finish('success', {
      totalItems: indicatorRows.length,
      successfulItems: inserted,
      failedItems: 0,
      metadata: {
        finraRowsRead: sourceRows.length,
        plceRowsCalculated: indicatorRows.length,
      },
    });

    console.log(`Calculated ${indicatorRows.length} PLCE short-volume indicator rows.`);
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
    console.error('calculate-plce-short-volume failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    unregisterSignalHandlers();
    await closePool();
  });
