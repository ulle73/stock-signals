import { closePool } from '../lib/db.js';
import { ensureEnvLoaded } from '../lib/env.js';
import { buildTfSyncIndicatorRows } from '../lib/indicators/tf-sync.js';
import { createFetchRunGuard } from '../lib/utils/fetch-run-guard.js';
import {
  getTfSyncSourceRows,
  upsertTfSyncIndicatorRows,
} from '../lib/repositories/tf-sync-indicator.js';
import { failRunningFetchRuns, finishFetchRun, startFetchRun } from '../lib/repositories/fetch-runs.js';

ensureEnvLoaded();

const JOB_NAME = 'calculate_tf_sync';
const fetchRunGuard = createFetchRunGuard({
  finishRun: finishFetchRun,
  closePool,
  setExitCode(code) {
    process.exitCode = code;
  },
});

const unregisterSignalHandlers = fetchRunGuard.register(process);

function getCalculationOptions() {
  const ticker = process.env.CALCULATE_TICKER?.trim().toUpperCase() || null;
  const rawLimit = process.env.CALCULATE_TICKER_LIMIT;
  const parsedLimit = rawLimit ? Number(rawLimit) : null;
  const tickerLimit = Number.isFinite(parsedLimit) && parsedLimit > 0
    ? parsedLimit
    : null;

  return { ticker, tickerLimit };
}

async function run() {
  await failRunningFetchRuns(JOB_NAME, 'calculate:tf-sync interrupted before completion', {
    recoveredBy: JOB_NAME,
  });
  const fetchRunId = await startFetchRun(JOB_NAME);
  fetchRunGuard.setRunId(fetchRunId);

  try {
    const options = getCalculationOptions();
    const sourceRows = await getTfSyncSourceRows(options);

    if (!sourceRows.length) {
      throw new Error('No TF Sync source rows found. Run fetch:intraday-60m first.');
    }

    const indicatorRows = buildTfSyncIndicatorRows(sourceRows);
    const inserted = await upsertTfSyncIndicatorRows(null, indicatorRows);

    await fetchRunGuard.finish('success', {
      totalItems: indicatorRows.length,
      successfulItems: inserted,
      failedItems: 0,
      metadata: {
        sourceRowsRead: sourceRows.length,
        tfSyncRowsCalculated: indicatorRows.length,
        options,
      },
    });

    console.log(`Calculated ${indicatorRows.length} TF Sync rows.`);
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
    console.error('calculate:tf-sync failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    unregisterSignalHandlers();
    await closePool();
  });
