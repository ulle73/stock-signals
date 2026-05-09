import { closePool } from '../lib/db.js';
import { ensureEnvLoaded } from '../lib/env.js';
import { buildCvolCallVolumeIndicatorRows } from '../lib/indicators/cvol-call-volume-zscore-occ.js';
import { failRunningFetchRuns, finishFetchRun, startFetchRun } from '../lib/repositories/fetch-runs.js';
import { getCvolCallVolumeSourceRows, upsertCvolCallVolumeIndicatorRows } from '../lib/repositories/cvol-call-volume-indicator.js';
import { createFetchRunGuard } from '../lib/utils/fetch-run-guard.js';

ensureEnvLoaded();

const JOB_NAME = 'calculate_cvol_call_volume';
const fetchRunGuard = createFetchRunGuard({
  finishRun: finishFetchRun,
  closePool,
  setExitCode(code) {
    process.exitCode = code;
  },
});

const unregisterSignalHandlers = fetchRunGuard.register(process);

async function run() {
  await failRunningFetchRuns(JOB_NAME, 'calculate-cvol-call-volume interrupted before completion', {
    recoveredBy: JOB_NAME,
  });
  const fetchRunId = await startFetchRun(JOB_NAME);
  fetchRunGuard.setRunId(fetchRunId);

  try {
    const sourceRows = await getCvolCallVolumeSourceRows();
    const indicatorRows = buildCvolCallVolumeIndicatorRows(sourceRows);
    const inserted = await upsertCvolCallVolumeIndicatorRows(indicatorRows);

    await fetchRunGuard.finish('success', {
      totalItems: indicatorRows.length,
      successfulItems: inserted,
      failedItems: 0,
      metadata: {
        occRowsRead: sourceRows.length,
        cvolRowsCalculated: indicatorRows.length,
      },
    });

    console.log(`Calculated ${indicatorRows.length} CVOL indicator rows.`);
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
    console.error('calculate-cvol-call-volume failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    unregisterSignalHandlers();
    await closePool();
  });
